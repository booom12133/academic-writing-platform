export type DocumentInputSourceType = 'docx' | 'pdf' | 'txt' | 'markdown';

export interface DocumentInputRef {
  version: 1;
  provider: 'platform-file';
  bucketId: string;
  filePath: string;
  fileName: string;
  sourceType: DocumentInputSourceType;
  mimeType?: string;
  sizeBytes: number;
  sha256: string;
}

export interface DocumentInputDescriptor {
  document: DocumentInputRef;
  summary: {
    title?: string;
    sourceType: DocumentInputSourceType;
    pageCount?: number;
    blockCount: number;
    warningCount: number;
  };
}
