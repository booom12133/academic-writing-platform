import type {
  ImportWorkspaceDocumentRequest,
  KnowledgeWorkspaceDocument,
} from '@shared/knowledge-product.interface';

import { productHttpClient } from './http';

export type {
  ImportWorkspaceDocumentRequest,
  KnowledgeWorkspaceDocument,
  WorkspaceDocumentSelection,
} from '@shared/knowledge-product.interface';

export class ProductApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | undefined,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProductApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProductApiError(error: unknown): ProductApiError {
  if (error instanceof ProductApiError) return error;
  const response = isRecord(error) && isRecord(error.response)
    ? error.response
    : undefined;
  const status = typeof response?.status === 'number' ? response.status : undefined;
  const data = isRecord(response?.data) ? response.data : undefined;
  const payload = isRecord(data?.error) ? data.error : undefined;
  const code = typeof payload?.code === 'string'
    ? payload.code
    : 'KNOWLEDGE_PRODUCT_REQUEST_FAILED';
  const message = typeof payload?.message === 'string'
    ? payload.message
    : 'The knowledge workspace request failed.';
  return new ProductApiError(
    code,
    message,
    status,
    status === undefined || status === 429 || status >= 500,
  );
}

async function productRequest<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw normalizeProductApiError(error);
  }
}

export async function importDocument(
  request: ImportWorkspaceDocumentRequest,
): Promise<KnowledgeWorkspaceDocument> {
  return productRequest(async () => {
    const response = await productHttpClient.post<KnowledgeWorkspaceDocument>(
      '/api/knowledge/documents',
      request,
    );
    return response.data;
  });
}

export async function listDocuments(): Promise<KnowledgeWorkspaceDocument[]> {
  return productRequest(async () => {
    const response = await productHttpClient.get<KnowledgeWorkspaceDocument[]>(
      '/api/knowledge/documents',
    );
    return response.data;
  });
}

export async function getDocument(
  documentId: string,
): Promise<KnowledgeWorkspaceDocument> {
  return productRequest(async () => {
    const response = await productHttpClient.get<KnowledgeWorkspaceDocument>(
      `/api/knowledge/documents/${encodeURIComponent(documentId)}`,
    );
    return response.data;
  });
}

export async function deleteDocument(
  documentId: string,
): Promise<{ documentId: string; status: 'tombstoned' }> {
  return productRequest(async () => {
    const response = await productHttpClient.delete<{
      documentId: string;
      status: 'tombstoned';
    }>(`/api/knowledge/documents/${encodeURIComponent(documentId)}`);
    return response.data;
  });
}
