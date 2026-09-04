export type ChunkingErrorCode =
  | 'INVALID_CHUNKING_INPUT'
  | 'INVALID_TASK_CONTEXT'
  | 'INVALID_STRUCTURAL_CONTEXT'
  | 'INVALID_CHUNKING_POLICY';

export class ChunkingError extends Error {
  constructor(
    public readonly code: ChunkingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ChunkingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
