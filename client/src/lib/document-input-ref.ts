import type { DocumentInputRef } from '@shared/document-input.interface';

export function isValidDocumentInputRef(value: unknown): value is DocumentInputRef {
  if (!isRecord(value)) return false;
  return value.version === 1
    && (value.provider === 'platform-file' || value.provider === 'self-hosted-filesystem')
    && nonEmptyString(value.bucketId)
    && nonEmptyString(value.filePath)
    && nonEmptyString(value.fileName)
    && (value.sourceType === 'docx'
      || value.sourceType === 'pdf'
      || value.sourceType === 'txt'
      || value.sourceType === 'markdown')
    && (value.mimeType === undefined || typeof value.mimeType === 'string')
    && typeof value.sizeBytes === 'number'
    && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes > 0
    && typeof value.sha256 === 'string'
    && /^[a-f0-9]{64}$/.test(value.sha256);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
