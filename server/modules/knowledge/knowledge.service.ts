import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ContextBuilderService } from '../context-builder/context-builder.service';
import { ChunkingService } from '../chunking/chunking.service';
import { DocumentParserService } from '../document-parsing/document-parser.service';
import { DocumentInputService } from '../document-input/document-input.service';
import { computeDerivationFingerprint, hashTextInputExact } from './knowledge.hash';
import { finalizeKnowledgeChunkDraft, mapStructuralChunksToKnowledgeChunkDrafts } from './knowledge.provenance';
import { KnowledgeError } from './knowledge.errors';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from './knowledge.repository';
import type { ImportKnowledgeDocumentInput, KnowledgeImportResult } from './knowledge.types';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(KnowledgeRepository) private readonly repository: KnowledgeRepositoryPort,
    @Inject(DocumentParserService) private readonly parser: Pick<DocumentParserService, 'parse'>,
    @Inject(ContextBuilderService) private readonly contextBuilder: Pick<ContextBuilderService, 'buildStructural'>,
    @Inject(ChunkingService) private readonly chunker: Pick<ChunkingService, 'chunkStructural'>,
    @Inject(DocumentInputService) private readonly documentInput: Pick<DocumentInputService, 'readVerified'>,
  ) {}

  async createSourceRecord(input: Parameters<KnowledgeRepositoryPort['createSourceRecord']>[0]) {
    return this.repository.createSourceRecord(input);
  }

  async importDocument(input: ImportKnowledgeDocumentInput): Promise<KnowledgeImportResult> {
    if (!input || !input.userId || !input.idempotencyKey || !input.displayName || !input.chunkingPolicy) {
      throw new KnowledgeError('INVALID_KNOWLEDGE_INPUT', 'Knowledge import input is invalid.');
    }
    const prepared = await this.prepareInput(input);
    const parserProfile = { name: 'c1-document-parser-v1' as const, version: '1' as const };
    const chunkingProfile = { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: prepared.chunked.policy.maxSize } };
    const requestFingerprint = hashTextInputExact(stableSerialize({
      userId: input.userId,
      sourceRecordId: input.sourceRecordId,
      newSourceRecord: input.newSourceRecord,
      displayName: input.displayName,
      originKind: input.originKind,
      inputIdentity: input.input.kind === 'text' ? { kind: 'text', fileName: input.input.fileName } : { kind: 'stored-file', document: input.input.documentRef },
      originalContentHash: prepared.originalContentHash,
      parserProfile,
      chunkingProfile,
    }));
    const derivationFingerprint = computeDerivationFingerprint({
      originalContentHash: prepared.originalContentHash,
      parserProfile,
      chunkingProfile,
    });

    const previous = await this.repository.findImport(input.userId, input.idempotencyKey);
    if (previous) {
      if (previous.requestFingerprint !== requestFingerprint) {
        throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'Idempotency key belongs to a different import.');
      }
      return this.rehydrateImport(this.repository, previous, input.userId);
    }

    const persist = async (repository: KnowledgeRepositoryPort): Promise<KnowledgeImportResult> => {
      let importId: string;
      let markerCreated = true;
      if (repository.claimImportMarker) {
        const marker = await repository.claimImportMarker({ userId: input.userId, idempotencyKey: input.idempotencyKey, requestFingerprint });
        importId = marker.id;
        markerCreated = marker.created;
      } else {
        importId = await repository.createImportMarker({ userId: input.userId, idempotencyKey: input.idempotencyKey, requestFingerprint });
      }
      if (!markerCreated) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const completed = await repository.findImport(input.userId, input.idempotencyKey);
          if (completed?.status === 'completed') return this.rehydrateImport(repository, completed, input.userId);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'The prior import has not completed.');
      }
      const sourceRecordId = await this.resolveSourceRecord(repository, input);
      const document = await repository.createDocument({
        userId: input.userId,
        ...(sourceRecordId === undefined ? {} : { sourceRecordId }),
        originKind: input.originKind,
        displayName: input.displayName,
        sourceType: prepared.parsed.source.type,
      });
      const version = await repository.createVersion({
        userId: input.userId,
        documentId: document.id,
        versionNumber: 1,
        originalContentHash: prepared.originalContentHash,
        parserProfile,
        chunkingProfile,
        ...(input.input.kind === 'text' ? { sourceText: input.input.text } : { sourceArtifactRef: prepared.verifiedArtifact?.document }),
        lifecycleStatus: 'active',
        readinessStatus: 'content-ready-for-indexing',
        indexInputFingerprint: derivationFingerprint,
      });
      const drafts = mapStructuralChunksToKnowledgeChunkDrafts({
        userId: input.userId,
        ...(sourceRecordId === undefined ? {} : { sourceRecordId }),
        documentId: document.id,
        documentVersionId: version.id,
        chunks: prepared.chunked.chunks,
      });
      const storedChunks = await repository.createChunks(drafts.map((draft) => finalizeKnowledgeChunkDraft({ draft, chunkId: randomUUID() })));
      await repository.activateVersion(input.userId, document.id, version.id);
      await repository.completeImport(input.userId, importId, document.id, version.id);
      return { document: { ...document, activeVersionId: version.id }, version, chunks: storedChunks, idempotent: false, readiness: 'content-ready-for-indexing' };
    };
    return this.repository.withTransaction ? this.repository.withTransaction(persist) : persist(this.repository);
  }

  async tombstoneDocument(userId: string, documentId: string): Promise<void> {
    await this.repository.tombstoneDocument(userId, documentId);
  }

  async createNextVersion(input: ImportKnowledgeDocumentInput & { documentId: string }): Promise<KnowledgeImportResult> {
    if (!this.repository.getDocument || !this.repository.getLatestVersion) {
      throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Versioning support is unavailable.');
    }
    const prepared = await this.prepareInput(input);
    const parserProfile = { name: 'c1-document-parser-v1' as const, version: '1' as const };
    const chunkingProfile = { name: 'c3-deterministic-v1', version: '1', parameters: { maxSize: prepared.chunked.policy.maxSize } };
    const derivationFingerprint = computeDerivationFingerprint({
      originalContentHash: prepared.originalContentHash,
      parserProfile,
      chunkingProfile,
    });

    const persist = async (repository: KnowledgeRepositoryPort): Promise<KnowledgeImportResult> => {
      if (!repository.getDocument || !repository.getLatestVersion) {
        throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Versioning support is unavailable.');
      }
      const document = await repository.getDocument(input.userId, input.documentId);
      const previous = await repository.getLatestVersion(input.userId, input.documentId);
      if (!document || !previous) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Document was not found.');
      if (previous.indexInputFingerprint === derivationFingerprint) {
        const chunks = repository.getChunks ? await repository.getChunks(input.userId, previous.id) : [];
        return { document, version: previous, chunks, idempotent: true, readiness: previous.readinessStatus };
      }
      const version = await repository.createVersion({
        userId: input.userId, documentId: input.documentId, versionNumber: previous.versionNumber + 1,
        originalContentHash: prepared.originalContentHash, parserProfile, chunkingProfile,
        ...(input.input.kind === 'text' ? { sourceText: input.input.text } : { sourceArtifactRef: prepared.verifiedArtifact?.document }),
        supersedesVersionId: previous.id, lifecycleStatus: 'active', readinessStatus: 'content-ready-for-indexing', indexInputFingerprint: derivationFingerprint,
      });
      const drafts = mapStructuralChunksToKnowledgeChunkDrafts({
        userId: input.userId, ...(document.sourceRecordId === undefined ? {} : { sourceRecordId: document.sourceRecordId }),
        documentId: document.id, documentVersionId: version.id, chunks: prepared.chunked.chunks,
      });
      const chunks = await repository.createChunks(drafts.map((draft) => finalizeKnowledgeChunkDraft({ draft, chunkId: randomUUID() })));
      await repository.activateVersion(input.userId, document.id, version.id);
      return { document: { ...document, activeVersionId: version.id }, version, chunks, idempotent: false, readiness: 'content-ready-for-indexing' };
    };
    return this.repository.withTransaction ? this.repository.withTransaction(persist) : persist(this.repository);
  }

  private async rehydrateImport(repository: KnowledgeRepositoryPort, importRecord: { documentId?: string; documentVersionId?: string }, userId: string): Promise<KnowledgeImportResult> {
    if (!importRecord.documentId || !importRecord.documentVersionId || !repository.getDocument || !repository.getVersion || !repository.getChunks) {
      throw new KnowledgeError('KNOWLEDGE_IDEMPOTENCY_CONFLICT', 'The prior import result is unavailable.');
    }
    const document = await repository.getDocument(userId, importRecord.documentId);
    const version = await repository.getVersion(userId, importRecord.documentVersionId);
    if (!document || !version) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'The prior import result is no longer available.');
    const chunks = await repository.getChunks(userId, version.id);
    return { document, version, chunks, idempotent: true, readiness: version.readinessStatus };
  }

  private async resolveSourceRecord(repository: KnowledgeRepositoryPort, input: ImportKnowledgeDocumentInput): Promise<string | undefined> {
    if (input.sourceRecordId) {
      const source = await repository.getSourceRecord(input.userId, input.sourceRecordId);
      if (!source) throw new KnowledgeError('KNOWLEDGE_NOT_FOUND', 'Source record was not found.');
      return source.id;
    }
    if (input.newSourceRecord) {
      const source = await repository.createSourceRecord({ userId: input.userId, ...input.newSourceRecord });
      return source.id;
    }
    return undefined;
  }

  private async prepareInput(input: ImportKnowledgeDocumentInput): Promise<{
    buffer: Buffer;
    originalContentHash: string;
    parsed: Awaited<ReturnType<DocumentParserService['parse']>>;
    chunked: ReturnType<ChunkingService['chunkStructural']>;
    verifiedArtifact: Awaited<ReturnType<DocumentInputService['readVerified']>> | undefined;
  }> {
    let buffer: Buffer;
    let verifiedArtifact: Awaited<ReturnType<DocumentInputService['readVerified']>> | undefined;
    let fileName: string;
    let mimeType: string | undefined;
    if (input.input.kind === 'text') {
      buffer = Buffer.from(input.input.text, 'utf8');
      fileName = this.safeTextFileName(input.input.fileName);
    } else {
      verifiedArtifact = await this.documentInput.readVerified(input.userId, input.input.documentRef);
      buffer = verifiedArtifact.buffer;
      fileName = verifiedArtifact.document.fileName;
      mimeType = verifiedArtifact.document.mimeType;
    }
    const parsed = await this.parser.parse({ buffer, fileName, ...(mimeType === undefined ? {} : { mimeType }) });
    const context = this.contextBuilder.buildStructural(parsed);
    const chunked = this.chunker.chunkStructural({ context, policy: input.chunkingPolicy });
    return {
      buffer,
      originalContentHash: verifiedArtifact?.document.sha256 ?? hashTextInputExact(buffer.toString('utf8')),
      parsed,
      chunked,
      verifiedArtifact,
    };
  }

  private safeTextFileName(fileName: string): string {
    const base = String(fileName ?? '').split(/[\\/]/u).pop()?.trim() ?? '';
    const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/gu, '_');
    return cleaned.toLowerCase().endsWith('.txt') ? cleaned : `${cleaned || 'document'}.txt`;
  }
}
