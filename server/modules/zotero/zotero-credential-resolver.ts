import { ZoteroError } from './zotero.errors';
import { ZoteroConnectionRepository } from './zotero-connection.repository';
import { ZoteroCredentialCrypto } from './zotero-crypto';
import { ZoteroCredentialIntrospectionClient } from './zotero-credential-introspection.client';
import { ZoteroClient } from './zotero.client';
import type { ZoteroConnection } from './zotero.types';

export class ZoteroCredentialResolver {
  constructor(
    private readonly introspection: Pick<ZoteroCredentialIntrospectionClient, 'introspect'>,
    private readonly crypto: Pick<ZoteroCredentialCrypto, 'encrypt' | 'decrypt'>,
    private readonly repository: Pick<ZoteroConnectionRepository, 'upsert' | 'findActiveCredential'>,
    private readonly libraryVerifier?: Pick<ZoteroClient, 'verifyLibraryRead'>,
  ) {}

  async connect(platformUserId: string, apiKey: string): Promise<ZoteroConnection> {
    const authority = await this.introspection.introspect(apiKey);
    if (!authority.hasLibraryRead || !authority.hasFilesRead) {
      throw new ZoteroError('ZOTERO_INSUFFICIENT_PRIVILEGES', 'The Zotero key lacks the required read access.');
    }
    if (this.libraryVerifier) await this.libraryVerifier.verifyLibraryRead(authority.userId, apiKey);
    return this.repository.upsert({
      userId: platformUserId,
      libraryType: 'user',
      libraryId: authority.userId,
      status: 'active',
      encrypted: this.crypto.encrypt(apiKey),
      lastCheckedAt: new Date(),
    });
  }

  async resolve(platformUserId: string): Promise<{ connection: ZoteroConnection; apiKey: string }> {
    const stored = await this.repository.findActiveCredential(platformUserId);
    if (!stored) throw new ZoteroError('ZOTERO_CONNECTION_DISABLED', 'The Zotero connection is disabled.');
    let apiKey: string;
    try { apiKey = this.crypto.decrypt(stored.encrypted); } catch { throw new ZoteroError('ZOTERO_CONNECTION_DISABLED', 'The Zotero connection is unavailable.'); }
    return { connection: stored.connection, apiKey };
  }
}
