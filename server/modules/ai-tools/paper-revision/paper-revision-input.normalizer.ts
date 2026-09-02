import type { DocumentInputRef } from '@shared/document-input.interface';
import type { ChunkingPolicy } from '../../chunking/chunking.types';
import type {
  NormalizedPaperRevisionSubmission,
  PaperRevisionSubmissionRequest,
} from './paper-revision-input.types';

export const PAPER_REVISION_CHUNKING_POLICY = {
  maxSize: 2000,
} as const satisfies ChunkingPolicy;

export function normalizePaperRevisionSubmission(
  request: PaperRevisionSubmissionRequest,
): NormalizedPaperRevisionSubmission {
  if (!request.userId?.trim()) {
    throw new Error('Paper revision userId is required');
  }

  const input = request.inputData;
  if (!input || typeof input !== 'object') {
    throw new Error('Paper revision inputData is required');
  }

  const mode = resolveInputMode(input);
  const userInstructions = normalizeOptionalString(input.requirements);
  const options = {
    ...(input.revisionTypes === undefined
      ? {}
      : { revisionTypes: validateRevisionTypes(input.revisionTypes) }),
    ...(input.language === undefined
      ? {}
      : { language: validateLanguage(input.language) }),
  };

  if (mode === 'text') {
    if (typeof input.text !== 'string' || !input.text.trim()) {
      throw new Error('Paper revision text is required');
    }
    return {
      preparation: {
        userId: request.userId,
        taskType: 'paper-revision',
        ...(userInstructions === undefined ? {} : { userInstructions }),
        chunkingPolicy: PAPER_REVISION_CHUNKING_POLICY,
        source: { mode: 'text', text: input.text },
      },
      options,
    };
  }

  if (!isDocumentInputRef(input.documentRef)) {
    throw new Error('A valid DocumentInputRef is required for file mode');
  }

  return {
    preparation: {
      userId: request.userId,
      taskType: 'paper-revision',
      ...(userInstructions === undefined ? {} : { userInstructions }),
      chunkingPolicy: PAPER_REVISION_CHUNKING_POLICY,
      source: { mode: 'file', documentRef: input.documentRef },
    },
    options,
  };
}

function resolveInputMode(
  input: PaperRevisionSubmissionRequest['inputData'],
): 'text' | 'file' {
  if (input.inputMode === 'text' || input.inputMode === 'file') {
    return input.inputMode;
  }
  if (input.inputMode !== undefined) {
    throw new Error('Paper revision inputMode must be text or file');
  }

  const hasText = typeof input.text === 'string' && input.text.trim().length > 0;
  const hasFile = input.documentRef !== undefined;
  if (hasText && hasFile) {
    throw new Error('Paper revision input sources are ambiguous');
  }
  if (hasText) return 'text';
  if (hasFile) return 'file';
  throw new Error('Paper revision text or file source is required');
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('Paper revision requirements must be a string');
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function validateRevisionTypes(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Paper revision revisionTypes must be an array of strings');
  }
  return value;
}

function validateLanguage(value: unknown): 'zh' | 'en' {
  if (value !== 'zh' && value !== 'en') {
    throw new Error('Paper revision language must be zh or en');
  }
  return value;
}

function isDocumentInputRef(value: unknown): value is DocumentInputRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<Record<keyof DocumentInputRef, unknown>>;
  return ref.version === 1
    && (ref.provider === 'platform-file' || ref.provider === 'self-hosted-filesystem')
    && typeof ref.bucketId === 'string'
    && typeof ref.filePath === 'string'
    && typeof ref.fileName === 'string'
    && (ref.sourceType === 'docx'
      || ref.sourceType === 'pdf'
      || ref.sourceType === 'txt'
      || ref.sourceType === 'markdown')
    && (ref.mimeType === undefined || typeof ref.mimeType === 'string')
    && typeof ref.sizeBytes === 'number'
    && Number.isSafeInteger(ref.sizeBytes)
    && ref.sizeBytes >= 0
    && typeof ref.sha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(ref.sha256);
}
