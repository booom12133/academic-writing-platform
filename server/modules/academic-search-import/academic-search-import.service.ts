import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { AcademicSearchImportRequest } from '@shared/academic-search.interface';
import type { AcademicSearchImportResult, KnowledgeWorkspaceSource } from '@shared/knowledge-product.interface';
import { DocumentInputService } from '../document-input/document-input.service';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../knowledge/knowledge.repository';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { KnowledgeProductService } from '../knowledge-product/knowledge-product.service';
import { OpenAlexImportGateway } from '../academic-search/openalex-import.gateway';
import { mapOpenAlexSource } from './openalex-source.mapper';
import { AcademicSearchImportError } from './academic-search-import.errors';

function parseRequest(value: unknown): AcademicSearchImportRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AcademicSearchImportError('ACADEMIC_SEARCH_IMPORT_INVALID_REQUEST', 'Academic search import request is invalid.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['provider', 'externalRecordId'].includes(key)) || record.provider !== 'openalex' || typeof record.externalRecordId !== 'string' || !/^(?:https:\/\/openalex\.org\/)?W[1-9][0-9]*$/iu.test(record.externalRecordId.trim())) {
    throw new AcademicSearchImportError('ACADEMIC_SEARCH_IMPORT_INVALID_REQUEST', 'Academic search import request is invalid.');
  }
  return { provider: 'openalex', externalRecordId: record.externalRecordId.trim() };
}

@Injectable()
export class AcademicSearchImportService {
  constructor(
    private readonly gateway: OpenAlexImportGateway,
    @Inject(KnowledgeRepository) private readonly repository: Pick<KnowledgeRepositoryPort, 'createSourceRecord' | 'findSourceRecordByExternalIdentity' | 'findDocumentByExternalIdentity'>,
    @Inject(DocumentInputService) private readonly documentInput: Pick<DocumentInputService, 'upload' | 'removeOwned'>,
    @Inject(KnowledgeService) private readonly knowledge: Pick<KnowledgeService, 'importDocument' | 'createNextVersion'>,
    @Inject(KnowledgeProductService) private readonly product: Pick<KnowledgeProductService, 'getDocument' | 'listSources'>,
  ) {}

  async import(userId: string, body: unknown): Promise<AcademicSearchImportResult> {
    if (!userId) throw new AcademicSearchImportError('ACADEMIC_SEARCH_IMPORT_INVALID_REQUEST', 'Authentication is required.');
    const request = parseRequest(body);
    const work = await this.gateway.resolveWork(request.externalRecordId);
    const sourceInput = mapOpenAlexSource(work);
    const existingSource = await this.repository.findSourceRecordByExternalIdentity?.({
      userId, connectorKind: 'academic-discovery', provider: 'openalex', externalRecordId: work.result.externalRecordId,
    });
    const source = existingSource ?? await this.repository.createSourceRecord({ userId, ...sourceInput });

    if (!work.result.pdfUrl) return this.metadataOnly(userId, source.id, 'not-advertised');
    const fetched = await this.gateway.fetchPdf(work.result.pdfUrl);
    if (fetched.kind !== 'downloaded') return this.metadataOnly(userId, source.id, fetched.kind);

    const externalIdentity = `openalex:work:${work.result.externalRecordId}:primary-pdf`;
    const md5 = createHash('md5').update(fetched.buffer).digest('hex');
    const existingDocument = await this.repository.findDocumentByExternalIdentity?.(userId, externalIdentity);
    if (existingDocument?.externalVersion === work.updatedAtEpochMs && existingDocument.externalChecksum === md5) {
      return this.fullText(userId, source.id, existingDocument.id);
    }

    const uploaded = await this.documentInput.upload(userId, {
      buffer: fetched.buffer,
      originalname: `${work.result.externalRecordId.replace(/^https:\/\/openalex\.org\//iu, '')}.pdf`,
      mimetype: 'application/pdf',
    });
    try {
      const common = {
        userId,
        idempotencyKey: `openalex:${work.result.externalRecordId}:${work.updatedAtEpochMs}:${uploaded.document.sha256}`,
        displayName: work.result.title,
        originKind: 'external-attachment' as const,
        input: { kind: 'stored-file' as const, documentRef: uploaded.document },
        sourceRecordId: source.id,
        chunkingPolicy: { maxSize: 2_000 },
        externalSyncState: {
          externalIdentity,
          externalVersion: work.updatedAtEpochMs,
          externalChecksumAlgorithm: 'md5' as const,
          externalChecksum: md5,
        },
      };
      const imported = existingDocument
        ? await this.knowledge.createNextVersion({ ...common, documentId: existingDocument.id })
        : await this.knowledge.importDocument(common);
      if (imported.idempotent) await this.documentInput.removeOwned(userId, uploaded.document).catch(() => undefined);
      return this.fullText(userId, source.id, imported.document.id);
    } catch {
      await this.documentInput.removeOwned(userId, uploaded.document).catch(() => undefined);
      return this.metadataOnly(userId, source.id, 'processing-failed');
    }
  }

  private async sourceProjection(userId: string, sourceId: string): Promise<KnowledgeWorkspaceSource> {
    const source = (await this.product.listSources(userId)).find((item) => item.id === sourceId);
    if (!source) throw new Error('Imported source could not be projected.');
    return source;
  }

  private async metadataOnly(userId: string, sourceId: string, reason: 'not-advertised' | 'unavailable' | 'invalid-pdf' | 'processing-failed'): Promise<AcademicSearchImportResult> {
    return { kind: 'metadata-only', source: await this.sourceProjection(userId, sourceId), fullTextReason: reason, uploadRequired: true };
  }

  private async fullText(userId: string, sourceId: string, documentId: string): Promise<AcademicSearchImportResult> {
    return {
      kind: 'full-text', source: await this.sourceProjection(userId, sourceId),
      document: await this.product.getDocument(userId, documentId), indexStatus: 'not-indexed', uploadRequired: false,
    };
  }
}
