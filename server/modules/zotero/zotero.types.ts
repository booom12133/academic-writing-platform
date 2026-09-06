export type ZoteroLibraryType = 'user';
export type ZoteroConnectionStatus = 'active' | 'disabled' | 'invalid' | 'revoked';

export interface ZoteroConfig {
  baseUrl: string;
  apiVersion: '3';
  timeoutMs: number;
  maxRetries: number;
  maxConcurrency: number;
  maxFileBytes: number;
}

export interface ZoteroKeyIntrospectionResult {
  userId: string;
  hasLibraryRead: boolean;
  hasFilesRead: boolean;
  hasNotesRead: boolean;
  hasWriteAccess: boolean;
  groupAccess: Record<string, unknown>;
}

export interface ZoteroConnection {
  id: string;
  userId: string;
  libraryType: ZoteroLibraryType;
  libraryId: string;
  keyFingerprint: string;
  encryptionKeyVersion: string;
  status: ZoteroConnectionStatus;
  lastCheckedAt?: string;
  lastSeenLibraryVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ZoteroConnectionUpsertInput {
  userId: string;
  libraryType: ZoteroLibraryType;
  libraryId: string;
  status: ZoteroConnectionStatus;
  encrypted: ZoteroEncryptedCredential;
  lastCheckedAt?: Date;
  lastSeenLibraryVersion?: string;
}

export interface ZoteroEncryptedCredential {
  ciphertext: string;
  nonce: string;
  authTag: string;
  algorithm: 'aes-256-gcm';
  encryptionKeyVersion: string;
  keyFingerprint: string;
}

export interface ZoteroItemDto {
  key: string;
  version: number;
  itemType: string;
  data: Record<string, unknown>;
}

export interface ZoteroAttachmentDto extends ZoteroItemDto {
  data: ZoteroItemDto['data'] & {
    linkMode?: string;
    contentType?: string;
    filename?: string;
    md5?: string;
    parentItem?: string;
  };
}

export interface ZoteroFileResponse {
  buffer: Buffer;
  contentType?: string;
  etag?: string;
}

export interface ZoteroItemsPage {
  items: ZoteroItemDto[];
  libraryVersion?: string;
}
