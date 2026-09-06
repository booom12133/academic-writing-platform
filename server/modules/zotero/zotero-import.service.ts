import { Injectable } from '@nestjs/common';
import { ZoteroAttachmentService, type ZoteroAttachmentSyncInput } from './zotero-attachment.service';
import { ZoteroClient } from './zotero.client';
import { ZoteroCredentialResolver } from './zotero-credential-resolver';
import { ZoteroConnectionRepository } from './zotero-connection.repository';
import { ZoteroSourceService } from './zotero-source.service';
import { ZoteroError } from './zotero.errors';

@Injectable()
export class ZoteroImportService {
  constructor(
    private readonly credentials: ZoteroCredentialResolver,
    private readonly client: ZoteroClient,
    private readonly sources: ZoteroSourceService,
    private readonly attachments: ZoteroAttachmentService,
    private readonly connections: ZoteroConnectionRepository,
  ) {}

  connect(userId: string, apiKey: string) {
    return this.credentials.connect(userId, apiKey);
  }

  health(userId: string) {
    return this.connections.findByUser(userId);
  }

  async disconnect(userId: string): Promise<void> {
    const connections = await this.connections.findByUser(userId);
    for (const connection of connections) await this.connections.disable(userId, connection.libraryId, 'revoked');
  }

  async listItems(userId: string) {
    const { connection, apiKey } = await this.credentials.resolve(userId);
    return this.client.listItems(connection.libraryId, apiKey, { includeTrashed: true });
  }

  async importItem(userId: string, itemKey: string) {
    return this.syncItem(userId, itemKey);
  }

  async syncItem(userId: string, itemKey: string) {
    const { connection, apiKey } = await this.credentials.resolve(userId);
    const sourceResult = await this.sources.syncItem(userId, connection.libraryId, apiKey, itemKey);
    const source = sourceResult.sourceRecord;
    const children = await this.client.getChildren(connection.libraryId, apiKey, itemKey, { includeTrashed: true });
    const attachmentInputs: ZoteroAttachmentSyncInput[] = children.map((child) => ({
      userId,
      libraryId: connection.libraryId,
      apiKey,
      attachmentKey: child.key,
      ...(source === undefined ? {} : { sourceRecordId: source.id }),
      ...(sourceResult.upstreamStatus === 'trashed' ? { parentTrashed: true } : {}),
    }));
    const attachments = await this.client.mapWithConcurrency(attachmentInputs, (input) => this.attachments.syncAttachment(input));
    return { source, upstreamStatus: sourceResult.upstreamStatus, attachments };
  }

  async importAttachment(userId: string, attachmentKey: string) {
    const { connection, apiKey } = await this.credentials.resolve(userId);
    const attachment = await this.client.getItem(connection.libraryId, apiKey, attachmentKey, { includeTrashed: true });
    const parentItem = attachment.data.parentItem;
    if (typeof parentItem !== 'string' || !parentItem) {
      throw new ZoteroError('ZOTERO_ATTACHMENT_UNSUPPORTED', 'Top-level Zotero attachments are not supported in E4 v1.');
    }
    const sourceResult = await this.sources.syncItem(userId, connection.libraryId, apiKey, parentItem);
    if (!sourceResult.sourceRecord && sourceResult.upstreamStatus === 'active') {
      throw new ZoteroError('ZOTERO_METADATA_INVALID', 'The Zotero attachment parent could not be resolved.');
    }
    return this.attachments.syncAttachment({
      userId,
      libraryId: connection.libraryId,
      apiKey,
      attachmentKey,
      ...(sourceResult.sourceRecord === undefined ? {} : { sourceRecordId: sourceResult.sourceRecord.id }),
      ...(sourceResult.upstreamStatus === 'trashed' ? { parentTrashed: true } : {}),
    });
  }
}
