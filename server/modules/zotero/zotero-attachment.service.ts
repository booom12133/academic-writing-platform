import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DocumentInputService } from '../document-input/document-input.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { ZoteroError } from './zotero.errors';
import { deriveAttachmentIdentity } from './zotero.identity';
import { assertSupportedPdfAttachment } from './zotero.metadata';
import { ZoteroClient } from './zotero.client';
import type { KnowledgeDocument } from '../knowledge/knowledge.types';

export interface ZoteroAttachmentSyncInput {
  userId: string;
  libraryId: string;
  apiKey: string;
  attachmentKey: string;
  sourceRecordId?: string;
}

@Injectable()
export class ZoteroAttachmentService {
  constructor(
    @Inject(ZoteroClient)
    private readonly client: Pick<ZoteroClient, 'getItem' | 'getFile'>,
    @Inject(DocumentInputService)
    private readonly documentInput: Pick<DocumentInputService, 'upload' | 'removeOwned'>,
    @Inject(KnowledgeService)
    private readonly knowledge: Pick<KnowledgeService, 'importDocument' | 'createNextVersion'>,
    @Inject(KnowledgeRepository)
    private readonly repository: Pick<KnowledgeRepository, 'findDocumentByExternalIdentity' | 'getLatestVersion' | 'updateExternalSyncState' | 'tombstoneDocument' | 'restoreDocument'>,
  ) {}

  async syncAttachment(input: ZoteroAttachmentSyncInput): Promise<{ document?: KnowledgeDocument; skipped?: boolean; stateOnly?: boolean; tombstoned?: boolean; restored?: boolean }> {
    const attachment = await this.client.getItem(input.libraryId, input.apiKey, input.attachmentKey, { includeTrashed: true });
    const externalIdentity = deriveAttachmentIdentity(input.libraryId, input.attachmentKey);
    const existing = await this.repository.findDocumentByExternalIdentity(input.userId, externalIdentity);
    if (this.isTrashed(attachment)) {
      if (existing && existing.lifecycleStatus === 'active') await this.repository.tombstoneDocument(input.userId, existing.id);
      return { ...(existing ? { document: existing } : {}), tombstoned: Boolean(existing) };
    }
    if (existing?.lifecycleStatus === 'active' && existing.externalVersion === String(attachment.version) && existing.externalChecksum === this.md5(attachment.data.md5)) {
      return { document: existing, skipped: true };
    }
    assertSupportedPdfAttachment(attachment);
    const expectedMd5 = this.md5(attachment.data.md5);
    const file = await this.client.getFile(input.libraryId, input.apiKey, input.attachmentKey);
    const actualMd5 = createHash('md5').update(file.buffer).digest('hex');
    if (!expectedMd5 || actualMd5 !== expectedMd5) throw new ZoteroError('ZOTERO_ATTACHMENT_INTEGRITY_FAILED', 'The Zotero attachment checksum did not match.');
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const previous = existing ? await this.repository.getLatestVersion(input.userId, existing.id) : null;
    let restored = false;
    if (existing?.lifecycleStatus === 'tombstoned') {
      await this.repository.restoreDocument(input.userId, existing.id);
      restored = true;
    }
    if (existing && previous?.sourceArtifactRef?.sha256 === sha256) {
      await this.repository.updateExternalSyncState(input.userId, existing.id, { externalVersion: String(attachment.version), externalChecksumAlgorithm: 'md5', externalChecksum: expectedMd5 });
      return { document: { ...existing, lifecycleStatus: 'active', externalVersion: String(attachment.version), externalChecksumAlgorithm: 'md5', externalChecksum: expectedMd5 }, stateOnly: true, ...(restored ? { restored: true } : {}) };
    }

    const uploaded = await this.documentInput.upload(input.userId, {
      buffer: file.buffer,
      originalname: this.fileName(attachment.data.filename, input.attachmentKey),
      mimetype: file.contentType ?? 'application/pdf',
    });
    try {
      const externalSyncState = { externalIdentity, externalVersion: String(attachment.version), externalChecksumAlgorithm: 'md5' as const, externalChecksum: expectedMd5 };
      const result = existing
        ? await this.knowledge.createNextVersion({ userId: input.userId, documentId: existing.id, idempotencyKey: this.idempotencyKey(externalIdentity, attachment.version, sha256), displayName: uploaded.document.fileName, originKind: 'external-attachment', input: { kind: 'stored-file', documentRef: uploaded.document }, chunkingPolicy: { maxSize: 2_000 }, externalSyncState })
        : await this.knowledge.importDocument({ userId: input.userId, idempotencyKey: this.idempotencyKey(externalIdentity, attachment.version, sha256), displayName: uploaded.document.fileName, originKind: 'external-attachment', input: { kind: 'stored-file', documentRef: uploaded.document }, ...(input.sourceRecordId ? { sourceRecordId: input.sourceRecordId } : {}), chunkingPolicy: { maxSize: 2_000 }, externalSyncState });
      return { document: result.document, ...(restored ? { restored: true } : {}) };
    } catch (error) {
      try { await this.documentInput.removeOwned(input.userId, uploaded.document); } catch { /* best-effort compensation must not mask import failure */ }
      if (restored) {
        try { await this.repository.tombstoneDocument(input.userId, existing!.id); } catch { /* preserve original import failure */ }
      }
      throw error;
    }
  }

  private md5(value: unknown): string | undefined {
    return typeof value === 'string' && /^[a-f0-9]{32}$/iu.test(value) ? value.toLowerCase() : undefined;
  }

  private isTrashed(item: { data: Record<string, unknown> }): boolean {
    return item.data.deleted === true || item.data.trashed === true;
  }

  private fileName(value: unknown, key: string): string {
    return typeof value === 'string' && value.trim().toLowerCase().endsWith('.pdf') ? value.trim() : `${key}.pdf`;
  }

  private idempotencyKey(identity: string, version: number, sha256: string): string {
    return `zotero:attachment:${identity}:${version}:${sha256}`;
  }
}
