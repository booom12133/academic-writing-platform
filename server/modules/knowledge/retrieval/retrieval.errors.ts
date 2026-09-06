export type RetrievalErrorCode =
  | 'RETRIEVAL_INVALID_QUERY'
  | 'RETRIEVAL_QUERY_EMBEDDING_FAILED'
  | 'RETRIEVAL_VERSION_SCOPE_INVALID';

export class RetrievalError extends Error {
  constructor(
    public readonly code: RetrievalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RetrievalError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
