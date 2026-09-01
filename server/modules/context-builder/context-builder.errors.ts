export type ContextBuilderErrorCode =
  | 'INVALID_CONTEXT_INPUT'
  | 'INVALID_PARSED_DOCUMENT';

export class ContextBuilderError extends Error {
  constructor(
    public readonly code: ContextBuilderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContextBuilderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
