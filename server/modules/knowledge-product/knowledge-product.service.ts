import { Inject, Injectable } from '@nestjs/common';

import type {
  ImportWorkspaceDocumentRequest,
  KnowledgeWorkspaceDocument,
} from '@shared/knowledge-product.interface';
import type { DocumentInputRef } from '@shared/document-input.interface';
import { DocumentInputError } from '../document-input/document-input.errors';
import { DocumentInputService } from '../document-input/document-input.service';
import { KnowledgeError } from '../knowledge/knowledge.errors';
import { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { KnowledgeService } from '../knowledge/knowledge.service';
import type {
  KnowledgeDocument,
  KnowledgeDocumentVersion,
} from '../knowledge/knowledge.types';
import {
  parseImportWorkspaceDocumentRequest,
  parseKnowledgeDocumentId,
} from './knowledge-product.http.dto';
import { KnowledgeProductError } from './knowledge-product.errors';
import type { KnowledgeProductRepository } from './knowledge-product.types';

@Injectable()
export class KnowledgeProductService {
  constructor(
    @Inject(KnowledgeRepository)
    private readonly repository: KnowledgeProductRepository,
    @Inject(KnowledgeService)
    private readonly knowledge: Pick<KnowledgeService, 'importDocument' | 'tombstoneDocument'>,
    @Inject(DocumentInputService)
    private readonly documentInput: Pick<DocumentInputService, 'validateOwnedRef'>,
  ) {}

  async listDocuments(userId: string): Promise<KnowledgeWorkspaceDocument[]> {
    this.requireUser(userId);
    const documents = await this.repository.listDocuments(userId);
    const owned = documents.filter(
      (document) =>
        document.userId === userId && document.lifecycleStatus === 'active',
    );
    return Promise.all(owned.map((document) => this.project(userId, document)));
  }

  async getDocument(
    userId: string,
    documentId: string,
  ): Promise<KnowledgeWorkspaceDocument> {
    this.requireUser(userId);
    const parsedId = parseKnowledgeDocumentId(documentId);
    const document = await this.repository.getDocument(userId, parsedId);
    if (!document || document.userId !== userId) {
      throw this.notFound();
    }
    return this.project(userId, document);
  }

  async importDocument(
    userId: string,
    input: unknown,
  ): Promise<KnowledgeWorkspaceDocument> {
    this.requireUser(userId);
    const request = parseImportWorkspaceDocumentRequest(input);

    if (request.sourceRecordId) {
      const source = await this.repository.getSourceRecord(
        userId,
        request.sourceRecordId,
      );
      if (!source || source.userId !== userId) throw this.notFound();
    }

    let trustedRef: DocumentInputRef;
    try {
      trustedRef = await this.documentInput.validateOwnedRef(
        userId,
        request.documentRef,
      );
    } catch (error) {
      throw this.mapDependencyError(error);
    }

    try {
      const result = await this.knowledge.importDocument({
        userId,
        idempotencyKey: request.idempotencyKey,
        displayName: request.displayName,
        originKind: 'user-upload',
        input: { kind: 'stored-file', documentRef: trustedRef },
        ...(request.sourceRecordId === undefined
          ? {}
          : { sourceRecordId: request.sourceRecordId }),
        chunkingPolicy: {
          maxSize: request.chunkingPolicy?.maxSize ?? 2_000,
        },
      });
      return this.projectVersion(userId, result.document, result.version);
    } catch (error) {
      throw this.mapDependencyError(error);
    }
  }

  async deleteDocument(
    userId: string,
    documentId: string,
  ): Promise<{ documentId: string; status: 'tombstoned' }> {
    this.requireUser(userId);
    const parsedId = parseKnowledgeDocumentId(documentId);
    const document = await this.repository.getDocument(userId, parsedId);
    if (!document || document.userId !== userId) throw this.notFound();
    try {
      await this.knowledge.tombstoneDocument(userId, parsedId);
    } catch (error) {
      throw this.mapDependencyError(error);
    }
    return { documentId: parsedId, status: 'tombstoned' };
  }

  private async project(
    userId: string,
    document: KnowledgeDocument,
  ): Promise<KnowledgeWorkspaceDocument> {
    const version = document.activeVersionId
      ? await this.repository.getVersion(userId, document.activeVersionId)
      : null;
    return this.projectVersion(userId, document, version);
  }

  private projectVersion(
    userId: string,
    document: KnowledgeDocument,
    version: KnowledgeDocumentVersion | null,
  ): KnowledgeWorkspaceDocument {
    const activeVersion =
      version &&
      version.userId === userId &&
      version.documentId === document.id &&
      version.lifecycleStatus === 'active'
        ? {
            id: version.id,
            documentId: version.documentId,
            versionNumber: version.versionNumber,
            readinessStatus: version.readinessStatus,
            createdAt: version.createdAt,
          }
        : undefined;
    const documentRef = activeVersion
      ? this.reconstructDocumentRef(document, version!)
      : undefined;

    return {
      document: {
        id: document.id,
        userId: document.userId,
        ...(document.sourceRecordId === undefined
          ? {}
          : { sourceRecordId: document.sourceRecordId }),
        originKind: document.originKind,
        displayName: document.displayName,
        sourceType: document.sourceType,
        ...(document.activeVersionId === undefined
          ? {}
          : { activeVersionId: document.activeVersionId }),
        lifecycleStatus: document.lifecycleStatus,
        ...(document.createdAt === undefined ? {} : { createdAt: document.createdAt }),
        ...(document.updatedAt === undefined ? {} : { updatedAt: document.updatedAt }),
      },
      ...(activeVersion === undefined ? {} : { activeVersion }),
      ...(documentRef === undefined ? {} : { documentRef }),
    };
  }

  private reconstructDocumentRef(
    document: KnowledgeDocument,
    version: KnowledgeDocumentVersion,
  ): DocumentInputRef | undefined {
    const artifact = version.sourceArtifactRef;
    if (
      !artifact ||
      artifact.version !== 1 ||
      !['platform-file', 'self-hosted-filesystem'].includes(artifact.provider) ||
      !artifact.bucketId ||
      !artifact.filePath ||
      !artifact.fileName ||
      !Number.isSafeInteger(artifact.sizeBytes) ||
      artifact.sizeBytes <= 0 ||
      !/^[a-f0-9]{64}$/u.test(artifact.sha256)
    ) {
      return undefined;
    }
    return {
      version: 1,
      provider: artifact.provider as DocumentInputRef['provider'],
      bucketId: artifact.bucketId,
      filePath: artifact.filePath,
      fileName: artifact.fileName,
      sourceType: document.sourceType,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
    };
  }

  private requireUser(userId: string): void {
    if (!userId) {
      throw new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_FORBIDDEN',
        'Authentication is required.',
        403,
      );
    }
  }

  private notFound(): KnowledgeProductError {
    return new KnowledgeProductError(
      'KNOWLEDGE_PRODUCT_NOT_FOUND',
      'The workspace document was not found.',
      404,
    );
  }

  private mapDependencyError(error: unknown): KnowledgeProductError {
    if (error instanceof KnowledgeProductError) return error;
    if (error instanceof DocumentInputError) {
      if (error.code === 'DOCUMENT_OWNERSHIP_MISMATCH') {
        return new KnowledgeProductError(
          'KNOWLEDGE_PRODUCT_FORBIDDEN',
          'The document does not belong to the current user.',
          403,
        );
      }
      if (error.code === 'DOCUMENT_STORAGE_FAILED') {
        return new KnowledgeProductError(
          'KNOWLEDGE_PRODUCT_UNAVAILABLE',
          'The document storage is unavailable.',
          503,
        );
      }
      return new KnowledgeProductError(
        'KNOWLEDGE_PRODUCT_INVALID_DOCUMENT_REF',
        'The document reference is invalid or unavailable.',
        422,
      );
    }
    if (error instanceof KnowledgeError) {
      if (error.code === 'KNOWLEDGE_NOT_FOUND') return this.notFound();
      if (error.code === 'KNOWLEDGE_OWNERSHIP_MISMATCH') {
        return new KnowledgeProductError(
          'KNOWLEDGE_PRODUCT_FORBIDDEN',
          'The knowledge resource does not belong to the current user.',
          403,
        );
      }
      if (error.code === 'KNOWLEDGE_IDEMPOTENCY_CONFLICT') {
        return new KnowledgeProductError(
          'KNOWLEDGE_PRODUCT_IDEMPOTENCY_CONFLICT',
          'The idempotency key belongs to a different import.',
          409,
        );
      }
      if (error.code === 'INVALID_KNOWLEDGE_INPUT') {
        return new KnowledgeProductError(
          'KNOWLEDGE_PRODUCT_INVALID_REQUEST',
          'The workspace document request is invalid.',
          400,
        );
      }
    }
    throw error;
  }
}
