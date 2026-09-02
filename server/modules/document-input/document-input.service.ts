import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';

import { DocumentParserService } from '../document-parsing/document-parser.service';
import { DocumentParseError } from '../document-parsing/document-parser.errors';
import { ContextBuilderService } from '../context-builder/context-builder.service';
import { ChunkingService } from '../chunking/chunking.service';
import type { ChunkingPolicy, ChunkedTaskContext } from '../chunking/chunking.types';
import type { ContextTaskType } from '../context-builder/context-builder.types';
import type {
  DocumentSourceType,
  ParsedDocument,
} from '../document-parsing/document-parser.types';
import type {
  DocumentInputDescriptor,
  DocumentInputProvider,
  DocumentInputRef,
  DocumentInputSourceType,
} from '@shared/document-input.interface';
import { DocumentInputError, type DocumentInputErrorCode } from './document-input.errors';
import {
  DOCUMENT_STORAGE,
  type DocumentStoragePort,
  type UploadedDocument,
} from './document-input.storage';

export const MAX_DOCUMENT_INPUT_SIZE_BYTES = 20 * 1024 * 1024;

const SOURCE_TYPES: Record<string, DocumentSourceType> = {
  '.docx': 'docx',
  '.pdf': 'pdf',
  '.txt': 'txt',
  '.md': 'markdown',
  '.markdown': 'markdown',
};

const MIME_TYPES: Record<string, Set<string>> = {
  '.docx': new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ]),
  '.pdf': new Set(['application/pdf', 'application/octet-stream']),
  '.txt': new Set(['text/plain', 'application/octet-stream']),
  '.md': new Set(['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream']),
  '.markdown': new Set(['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream']),
};

const PATH_PATTERN = /^academic-writing\/users\/([a-f0-9]{64})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([^/\\\u0000-\u001f\u007f]+)$/;
const ENCODED_PATH_SEPARATOR_PATTERN = /%(?:2f|5c)/iu;

export interface PrepareDocumentInput {
  userId: string;
  documentRef: DocumentInputRef;
  taskType: ContextTaskType;
  userInstructions?: string;
  chunkingPolicy: ChunkingPolicy;
}

export interface PreparedDocument {
  version: 1;
  document: DocumentInputRef;
  context: ChunkedTaskContext;
  summary: {
    blockCount: number;
    chunkCount: number;
    pageCount?: number;
    contentCodePoints: number;
    referenceCodePoints: number;
  };
}

@Injectable()
export class DocumentInputService {
  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStoragePort,
    private readonly parser: DocumentParserService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly chunker: ChunkingService,
  ) {}

  async upload(userId: string, file: UploadedDocument): Promise<DocumentInputDescriptor> {
    if (!userId || !file || !Buffer.isBuffer(file.buffer)) {
      throw new DocumentInputError('INVALID_DOCUMENT_UPLOAD', 'A document file is required.');
    }
    if (file.buffer.length === 0) {
      throw new DocumentInputError('INVALID_DOCUMENT_UPLOAD', 'The document file is empty.');
    }
    if (file.buffer.length > MAX_DOCUMENT_INPUT_SIZE_BYTES) {
      throw new DocumentInputError('DOCUMENT_TOO_LARGE', 'The document exceeds the 20 MB size limit.');
    }

    const fileName = this.sanitizeFileName(file.originalname);
    const extension = this.getExtension(fileName);
    const sourceType = SOURCE_TYPES[extension];
    if (!sourceType) {
      throw new DocumentInputError('UNSUPPORTED_DOCUMENT_TYPE', 'The document file type is not supported.');
    }

    const mimeType = this.normalizeMimeType(file.mimetype);
    if (mimeType && !MIME_TYPES[extension].has(mimeType)) {
      throw new DocumentInputError('UNSUPPORTED_DOCUMENT_TYPE', 'The MIME type does not match the file extension.');
    }

    let parsed: ParsedDocument;
    try {
      parsed = await this.parser.parse({ buffer: file.buffer, fileName, mimeType });
    } catch (error) {
      throw this.mapParseError(error, 'The document could not be validated.');
    }

    const bucketId = await this.getBucketId();
    const provider = this.storage.getProvider();
    const filePath = `academic-writing/users/${this.userScope(userId)}/${randomUUID()}/${fileName}`;
    const document: DocumentInputRef = {
      version: 1,
      provider,
      bucketId,
      filePath,
      fileName,
      sourceType,
      ...(mimeType === undefined ? {} : { mimeType }),
      sizeBytes: file.buffer.length,
      sha256: this.hash(file.buffer),
    };

    try {
      await this.storage.upload({
        bucketId,
        filePath,
        fileName,
        buffer: file.buffer,
        mimeType,
      });
    } catch (error) {
      await this.bestEffortRemove(bucketId, filePath);
      throw new DocumentInputError('DOCUMENT_STORAGE_FAILED', 'The document could not be stored.', error);
    }

    return {
      document,
      summary: {
        title: parsed.title,
        sourceType: parsed.source.type,
        pageCount: parsed.metadata.pageCount,
        blockCount: parsed.blocks.length,
        warningCount: parsed.warnings.length,
      },
    };
  }

  async prepare(input: PrepareDocumentInput): Promise<PreparedDocument> {
    if (!input || !input.userId || !['polish', 'paper-revision'].includes(input.taskType)) {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'Document preparation input is invalid.');
    }

    const trusted = await this.validateRef(input.userId, input.documentRef);
    let buffer: Buffer | null;
    try {
      buffer = await this.storage.download({ bucketId: trusted.bucketId, filePath: trusted.filePath });
    } catch (error) {
      throw new DocumentInputError('DOCUMENT_STORAGE_FAILED', 'The document could not be downloaded.', error);
    }
    if (!buffer) {
      throw new DocumentInputError('DOCUMENT_NOT_FOUND', 'The document was not found.');
    }
    if (buffer.length !== trusted.sizeBytes || buffer.length > MAX_DOCUMENT_INPUT_SIZE_BYTES) {
      throw new DocumentInputError('DOCUMENT_INTEGRITY_MISMATCH', 'The stored document size does not match its descriptor.');
    }
    if (this.hash(buffer) !== trusted.sha256) {
      throw new DocumentInputError('DOCUMENT_INTEGRITY_MISMATCH', 'The stored document hash does not match its descriptor.');
    }

    let parsed: ParsedDocument;
    try {
      parsed = await this.parser.parse({
        buffer,
        fileName: trusted.fileName,
        mimeType: trusted.mimeType,
      });
      const context = this.contextBuilder.build({
        taskType: input.taskType,
        document: parsed,
        userInstructions: input.userInstructions,
      });
      const chunked = this.chunker.chunk({ context, policy: input.chunkingPolicy });
      return {
        version: 1,
        document: { ...trusted },
        context: chunked,
        summary: {
          blockCount: context.units.length,
          chunkCount: chunked.chunks.length,
          pageCount: parsed.metadata.pageCount,
          contentCodePoints: this.countSectionCodePoints(context, 'content'),
          referenceCodePoints: this.countSectionCodePoints(context, 'references'),
        },
      };
    } catch (error) {
      if (error instanceof DocumentInputError) throw error;
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document could not be prepared.', error);
    }
  }

  private async validateRef(userId: string, ref: unknown): Promise<{
    version: 1;
    provider: DocumentInputProvider;
    bucketId: string;
    filePath: string;
    fileName: string;
    sourceType: DocumentInputSourceType;
    mimeType?: string;
    sizeBytes: number;
    sha256: string;
  }> {
    const provider = this.storage.getProvider();
    if (!this.isRecord(ref) || ref.version !== 1 || ref.provider !== provider) {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document descriptor is invalid.');
    }

    if (typeof ref.filePath !== 'string' || ENCODED_PATH_SEPARATOR_PATTERN.test(ref.filePath)) {
      throw new DocumentInputError('DOCUMENT_OWNERSHIP_MISMATCH', 'The document does not belong to the current user.');
    }

    const match = ref.filePath.match(PATH_PATTERN);
    if (!match || match[1] !== this.userScope(userId)) {
      throw new DocumentInputError('DOCUMENT_OWNERSHIP_MISMATCH', 'The document does not belong to the current user.');
    }

    const fileName = match[3];
    const canonicalPath = `academic-writing/users/${match[1]}/${match[2]}/${fileName}`;
    if (ref.filePath !== canonicalPath || fileName === '.' || fileName === '..') {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document descriptor path is not canonical.');
    }

    const bucketId = await this.getBucketId();
    if (ref.bucketId !== bucketId) {
      throw new DocumentInputError('DOCUMENT_OWNERSHIP_MISMATCH', 'The document does not belong to the current user.');
    }

    const extension = this.getExtension(fileName);
    const sourceType = SOURCE_TYPES[extension] as DocumentInputSourceType | undefined;
    if (!sourceType || ref.fileName !== fileName || ref.sourceType !== sourceType) {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document descriptor metadata is inconsistent.');
    }

    const mimeType = ref.mimeType === undefined ? undefined : this.normalizeMimeType(ref.mimeType);
    if (mimeType && !MIME_TYPES[extension].has(mimeType)) {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document descriptor MIME type is invalid.');
    }
    if (!this.isSafePositiveInteger(ref.sizeBytes) || ref.sizeBytes > MAX_DOCUMENT_INPUT_SIZE_BYTES) {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document descriptor size is invalid.');
    }
    if (typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256)) {
      throw new DocumentInputError('DOCUMENT_PREPARATION_FAILED', 'The document descriptor hash is invalid.');
    }

    return {
      version: 1,
      provider,
      bucketId,
      filePath: ref.filePath,
      fileName,
      sourceType,
      mimeType,
      sizeBytes: ref.sizeBytes,
      sha256: ref.sha256,
    };
  }

  private async getBucketId(): Promise<string> {
    try {
      const bucketId = await this.storage.getDefaultBucketId();
      if (!bucketId) throw new Error('The platform default bucket is unavailable.');
      return bucketId;
    } catch (error) {
      throw new DocumentInputError('DOCUMENT_STORAGE_FAILED', 'The document storage is unavailable.', error);
    }
  }

  private mapParseError(error: unknown, message: string): DocumentInputError {
    if (error instanceof DocumentParseError) {
      const code: DocumentInputErrorCode = error.code === 'UNSUPPORTED_FILE_TYPE' || error.code === 'MIME_EXTENSION_MISMATCH'
        ? 'UNSUPPORTED_DOCUMENT_TYPE'
        : error.code === 'FILE_TOO_LARGE'
          ? 'DOCUMENT_TOO_LARGE'
          : 'INVALID_DOCUMENT_UPLOAD';
      return new DocumentInputError(code, message, error);
    }
    return new DocumentInputError('INVALID_DOCUMENT_UPLOAD', message, error);
  }

  private async bestEffortRemove(bucketId: string, filePath: string): Promise<void> {
    try {
      await this.storage.remove({ bucketId, filePath });
    } catch {
      // Compensation must not mask the original storage failure.
    }
  }

  private sanitizeFileName(fileName: string): string {
    const finalName = String(fileName ?? '').split(/[\\/]/u).pop()?.trim() ?? '';
    const cleaned = finalName
      .replace(/[\u0000-\u001f\u007f]/gu, '_')
      .replace(/\.{2,}/gu, '.')
      .replace(/[<>:"|?*]/gu, '_');
    return cleaned.slice(0, 200) || 'document';
  }

  private getExtension(fileName: string): string {
    const index = fileName.lastIndexOf('.');
    return index === -1 ? '' : fileName.slice(index).toLowerCase();
  }

  private normalizeMimeType(mimeType?: string): string | undefined {
    const normalized = mimeType?.split(';', 1)[0].trim().toLowerCase();
    return normalized || undefined;
  }

  private userScope(userId: string): string {
    return this.hash(Buffer.from(userId));
  }

  private hash(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private countSectionCodePoints(
    context: { units: Array<{ section: 'content' | 'references'; block: { text: string } }> },
    section: 'content' | 'references',
  ): number {
    return context.units
      .filter((unit) => unit.section === section)
      .reduce((sum, unit) => sum + Array.from(unit.block.text).length, 0);
  }

  private isSafePositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
