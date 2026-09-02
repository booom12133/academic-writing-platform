import type { DocumentInputRef } from '@shared/document-input.interface';
import {
  normalizePolishSubmission,
  POLISH_CHUNKING_POLICY,
} from './polish-input.normalizer';
import type { PolishSubmissionRequest } from './polish-input.types';

const documentRef: DocumentInputRef = {
  version: 1,
  provider: 'platform-file',
  bucketId: 'bucket-1',
  filePath: 'academic-writing/users/scope/file-1/note.txt',
  fileName: 'note.txt',
  sourceType: 'txt',
  mimeType: 'text/plain',
  sizeBytes: 12,
  sha256: 'a'.repeat(64),
};

describe('normalizePolishSubmission', () => {
  it('maps text and requirements into the D1 preparation contract', () => {
    const result = normalizePolishSubmission({
      userId: 'user-1',
      title: 'Text polish',
      inputData: {
        inputMode: 'text',
        text: '  Academic text.  ',
        requirements: '  Keep terminology stable.  ',
        polishType: 'academic',
        language: 'en',
        wordCount: 9999,
        pointsCost: 1,
      },
    });

    expect(result.preparation).toEqual({
      userId: 'user-1',
      taskType: 'polish',
      userInstructions: 'Keep terminology stable.',
      chunkingPolicy: POLISH_CHUNKING_POLICY,
      source: { mode: 'text', text: '  Academic text.  ' },
    });
    expect(result.options).toEqual({
      polishType: 'academic',
      language: 'en',
    });
  });

  it('maps a structured DocumentInputRef for file preparation', () => {
    const result = normalizePolishSubmission({
      userId: 'user-1',
      inputData: {
        inputMode: 'file',
        documentRef,
        polishType: 'grammar',
      },
    });

    expect(result.preparation.source).toEqual({ mode: 'file', documentRef });
    expect(result.preparation.userId).toBe('user-1');
    expect(result.preparation.chunkingPolicy).toBe(POLISH_CHUNKING_POLICY);
  });

  it('rejects a string-only document reference', () => {
    expect(() => normalizePolishSubmission({
      userId: 'user-1',
      inputData: {
        inputMode: 'file',
        documentRef: 'not-a-document-ref' as never,
      },
    })).toThrow('DocumentInputRef');
  });

  it('rejects missing text and missing file reference before preparation', () => {
    expect(() => normalizePolishSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'text', text: '   ' },
    })).toThrow('Academic polish text is required');

    expect(() => normalizePolishSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'file' },
    })).toThrow('DocumentInputRef');
  });

  it('does not treat client price, count, or policy fields as trusted output', () => {
    const result = normalizePolishSubmission({
      userId: 'user-1',
      inputData: {
        inputMode: 'text',
        text: 'Trusted source',
        wordCount: 1,
        pointsCost: 1,
        chunkingPolicy: { maxSize: 1 },
      } as PolishSubmissionRequest['inputData'] & { chunkingPolicy: unknown },
    });

    expect(result).not.toHaveProperty('pointsCost');
    expect(result).not.toHaveProperty('charCount');
    expect(result.preparation.chunkingPolicy).toEqual({ maxSize: 2000 });
  });
});
