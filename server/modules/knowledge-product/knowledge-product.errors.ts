export type KnowledgeProductErrorCode =
  | 'KNOWLEDGE_PRODUCT_INVALID_REQUEST'
  | 'KNOWLEDGE_PRODUCT_INVALID_DOCUMENT_REF'
  | 'KNOWLEDGE_PRODUCT_FORBIDDEN'
  | 'KNOWLEDGE_PRODUCT_NOT_FOUND'
  | 'KNOWLEDGE_PRODUCT_IDEMPOTENCY_CONFLICT'
  | 'KNOWLEDGE_PRODUCT_UNAVAILABLE';

export class KnowledgeProductError extends Error {
  constructor(
    public readonly code: KnowledgeProductErrorCode,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'KnowledgeProductError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
