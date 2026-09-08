export type ZoteroConnectionStatus = 'active' | 'disabled' | 'invalid' | 'revoked';

export interface ZoteroConnection {
  id: string;
  libraryType: 'user';
  libraryId: string;
  keyFingerprint: string;
  status: ZoteroConnectionStatus;
  lastCheckedAt?: string;
  lastSeenLibraryVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ZoteroItem {
  key: string;
  version: number;
  itemType: string;
  data: Record<string, unknown>;
}

export interface ZoteroItemsPage {
  items: ZoteroItem[];
  libraryVersion?: string;
}

export interface ZoteroKnowledgeDocument {
  id?: string;
  displayName?: string;
  lifecycleStatus?: string;
  activeVersionId?: string;
}

export interface ZoteroImportResult {
  source?: Record<string, unknown>;
  document?: ZoteroKnowledgeDocument;
  upstreamStatus?: 'active' | 'trashed';
  attachments?: Array<ZoteroImportResult & {
    skipped?: boolean;
    stateOnly?: boolean;
    tombstoned?: boolean;
    restored?: boolean;
  }>;
  skipped?: boolean;
  stateOnly?: boolean;
  tombstoned?: boolean;
  restored?: boolean;
}
