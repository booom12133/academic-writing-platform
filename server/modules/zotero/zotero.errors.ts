export type ZoteroErrorCode =
  | 'ZOTERO_INVALID_CREDENTIAL'
  | 'ZOTERO_INSUFFICIENT_PRIVILEGES'
  | 'ZOTERO_CONNECTION_DISABLED'
  | 'ZOTERO_ITEM_NOT_FOUND'
  | 'ZOTERO_ATTACHMENT_UNSUPPORTED'
  | 'ZOTERO_ATTACHMENT_UNAVAILABLE'
  | 'ZOTERO_ATTACHMENT_TOO_LARGE'
  | 'ZOTERO_ATTACHMENT_INTEGRITY_FAILED'
  | 'ZOTERO_RATE_LIMITED'
  | 'ZOTERO_UPSTREAM_TIMEOUT'
  | 'ZOTERO_UPSTREAM_FAILED'
  | 'ZOTERO_METADATA_INVALID';

export class ZoteroError extends Error {
  constructor(public readonly code: ZoteroErrorCode, message: string, options?: { retryAfterMs?: number }) {
    super(message);
    this.name = 'ZoteroError';
    Object.setPrototypeOf(this, new.target.prototype);
    this.retryAfterMs = options?.retryAfterMs;
  }

  readonly retryAfterMs?: number;
}
