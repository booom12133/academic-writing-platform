import type { DocumentInputRef } from '@shared/document-input.interface';
import {
  normalizePaperRevisionSubmission,
  PAPER_REVISION_CHUNKING_POLICY,
} from './paper-revision-input.normalizer';
import type { PaperRevisionSubmissionRequest } from './paper-revision-input.types';

const documentRef: DocumentInputRef = {
  version: 1,
  provider: 'platform-file',
  bucketId: 'bucket-1',
  filePath: 'academic-writing/users/user-1/file-1/source.txt',
  fileName: 'source.txt',
  sourceType: 'txt',
  mimeType: 'text/plain',
  sizeBytes: 12,
  sha256: 'a'.repeat(64),
};

describe('normalizePaperRevisionSubmission', () => {
  it('maps text requirements and applies the server-owned policy', () => {
    const result = normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: {
        inputMode: 'text',
        text: '  source text  ',
        requirements: '  preserve citations  ',
        revisionTypes: [],
        wordCount: 1,
        pointsCost: 1,
      },
    });

    expect(result.preparation).toEqual({
      userId: 'user-1',
      taskType: 'paper-revision',
      userInstructions: 'preserve citations',
      chunkingPolicy: PAPER_REVISION_CHUNKING_POLICY,
      source: { mode: 'text', text: '  source text  ' },
    });
    expect(result.options).toEqual({ revisionTypes: [] });
  });

  it('accepts a structured file reference for explicit file mode', () => {
    const result = normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'file', documentRef },
    });

    expect(result.preparation.source).toEqual({ mode: 'file', documentRef });
  });

  it('infers legacy text mode when inputMode is omitted', () => {
    const result = normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { text: 'source', requirements: 'revise' },
    });

    expect(result.preparation.source).toEqual({ mode: 'text', text: 'source' });
    expect(result.preparation.userInstructions).toBe('revise');
  });

  it('allows omitted and empty revisionTypes without applying a UI whitelist', () => {
    expect(normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'text', text: 'source' },
    }).options).toEqual({});

    expect(normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: {
        inputMode: 'text',
        text: 'source',
        revisionTypes: ['logic', 'discussion'],
      },
    }).options).toEqual({ revisionTypes: ['logic', 'discussion'] });
  });

  it('rejects missing, ambiguous, malformed, and invalid inputs', () => {
    expect(() => normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'text', text: '   ' },
    })).toThrow('text is required');

    expect(() => normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { text: 'source', documentRef },
    })).toThrow('ambiguous');

    expect(() => normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'file', documentRef: 'not-a-ref' as never },
    })).toThrow('DocumentInputRef');

    expect(() => normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'text', text: 'source', language: 'fr' as never },
    })).toThrow('language must be zh or en');

    expect(() => normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: { inputMode: 'text', text: 'source', revisionTypes: ['logic', 1] as never },
    })).toThrow('revisionTypes');
  });

  it('ignores client billing and chunking policy fields', () => {
    const result = normalizePaperRevisionSubmission({
      userId: 'user-1',
      inputData: {
        inputMode: 'text',
        text: 'source',
        wordCount: 1,
        pointsCost: 1,
        chunkingPolicy: { maxSize: 1 },
      } as PaperRevisionSubmissionRequest['inputData'] & { chunkingPolicy: unknown },
    });

    expect(result).not.toHaveProperty('pointsCost');
    expect(result.preparation.chunkingPolicy).toEqual({ maxSize: 2000 });
  });
});
