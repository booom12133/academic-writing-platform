import { ZoteroError } from './zotero.errors';
import type { ZoteroKeyIntrospectionResult } from './zotero.types';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class ZoteroCredentialIntrospectionClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(options: { baseUrl: string; fetchImpl?: FetchLike }) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async introspect(apiKey: string): Promise<ZoteroKeyIntrospectionResult> {
    if (!apiKey) throw new ZoteroError('ZOTERO_INVALID_CREDENTIAL', 'The Zotero credential is invalid.');
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/keys/current`, {
        headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' },
      });
    } catch {
      throw new ZoteroError('ZOTERO_UPSTREAM_TIMEOUT', 'The Zotero credential check timed out.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new ZoteroError('ZOTERO_INVALID_CREDENTIAL', 'The Zotero credential is invalid.');
    }
    if (!response.ok) throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero credential check failed.');
    let body: unknown;
    try { body = await response.json(); } catch { throw new ZoteroError('ZOTERO_UPSTREAM_FAILED', 'The Zotero credential response was invalid.'); }
    const record = body as Record<string, any>;
    const user = record.access?.user as Record<string, unknown> | undefined;
    if ((typeof record.userID !== 'number' && typeof record.userID !== 'string') || !user) {
      throw new ZoteroError('ZOTERO_INVALID_CREDENTIAL', 'The Zotero credential response was invalid.');
    }
    return {
      userId: String(record.userID),
      hasLibraryRead: user.library === true,
      hasFilesRead: user.files === true,
      hasNotesRead: user.notes === true,
      hasWriteAccess: user.write === true,
      groupAccess: (record.access?.groups as Record<string, unknown> | undefined) ?? {},
    };
  }
}
