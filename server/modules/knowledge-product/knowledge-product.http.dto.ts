import { z } from 'zod';

import type { ImportWorkspaceDocumentRequest } from '@shared/knowledge-product.interface';
import { MAX_DOCUMENT_INPUT_SIZE_BYTES } from '../document-input/document-input.service';
import { KnowledgeProductError } from './knowledge-product.errors';

const documentInputRefSchema = z.object({
  version: z.literal(1),
  provider: z.enum(['platform-file', 'self-hosted-filesystem']),
  bucketId: z.string().trim().min(1).max(255),
  filePath: z.string().trim().min(1).max(2_048),
  fileName: z.string().trim().min(1).max(255),
  sourceType: z.enum(['docx', 'pdf', 'txt', 'markdown']),
  mimeType: z.string().trim().min(1).max(255).optional(),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_INPUT_SIZE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

const importWorkspaceDocumentSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(1).max(255),
  documentRef: documentInputRefSchema,
  sourceRecordId: z.string().uuid().optional(),
  chunkingPolicy: z.object({
    maxSize: z.number().int().positive().max(100_000),
  }).strict().optional(),
}).strict();

export function parseImportWorkspaceDocumentRequest(
  input: unknown,
): ImportWorkspaceDocumentRequest {
  const parsed = importWorkspaceDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeProductError(
      'KNOWLEDGE_PRODUCT_INVALID_REQUEST',
      'The workspace document request is invalid.',
      400,
    );
  }
  return parsed.data as ImportWorkspaceDocumentRequest;
}

export function parseKnowledgeDocumentId(input: unknown): string {
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeProductError(
      'KNOWLEDGE_PRODUCT_INVALID_REQUEST',
      'The workspace document id is invalid.',
      400,
    );
  }
  return parsed.data;
}
