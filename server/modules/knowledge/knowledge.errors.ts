export type KnowledgeErrorCode =
  | 'INVALID_KNOWLEDGE_INPUT'
  | 'INVALID_PROVENANCE'
  | 'KNOWLEDGE_NOT_FOUND'
  | 'KNOWLEDGE_OWNERSHIP_MISMATCH'
  | 'KNOWLEDGE_IDEMPOTENCY_CONFLICT'
  | 'KNOWLEDGE_EXTERNAL_IDENTITY_CONFLICT'
  | 'KNOWLEDGE_METADATA_CONFLICT'
  | 'KNOWLEDGE_IMMUTABLE_VERSION';

export class KnowledgeError extends Error {
  constructor(
    public readonly code: KnowledgeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
