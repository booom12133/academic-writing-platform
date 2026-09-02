import type { DocumentInputRef } from '@shared/document-input.interface';
import type { ChunkingPolicy } from '../../chunking/chunking.types';
import type {
  NormalizedPolishSubmission,
  PolishSubmissionRequest,
} from './polish-input.types';

export const POLISH_CHUNKING_POLICY = {
  maxSize: 2000,
} as const satisfies ChunkingPolicy;

export function normalizePolishSubmission(
  request: PolishSubmissionRequest,
): NormalizedPolishSubmission {
  if (!request.userId?.trim()) {
    throw new Error('Polish userId is required');
  }

  const input = request.inputData;
  if (!input || (input.inputMode !== 'text' && input.inputMode !== 'file')) {
    throw new Error('Academic polish inputMode must be text or file');
  }

  const userInstructions = normalizeOptional(input.requirements);
  const polishType = normalizeOptional(input.polishType);
  const options = {
    ...(polishType === undefined ? {} : { polishType }),
    ...(input.language === undefined ? {} : { language: validateLanguage(input.language) }),
  };

  if (input.inputMode === 'text') {
    if (typeof input.text !== 'string' || !input.text.trim()) {
      throw new Error('Academic polish text is required');
    }
    return {
      preparation: {
        userId: request.userId,
        taskType: 'polish',
        ...(userInstructions === undefined ? {} : { userInstructions }),
        chunkingPolicy: POLISH_CHUNKING_POLICY,
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
      taskType: 'polish',
      ...(userInstructions === undefined ? {} : { userInstructions }),
      chunkingPolicy: POLISH_CHUNKING_POLICY,
      source: { mode: 'file', documentRef: input.documentRef },
    },
    options,
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function validateLanguage(value: 'zh' | 'en'): 'zh' | 'en' {
  if (value !== 'zh' && value !== 'en') {
    throw new Error('Academic polish language must be zh or en');
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
