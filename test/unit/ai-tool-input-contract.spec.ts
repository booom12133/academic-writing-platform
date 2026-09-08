import {
  AI_TOOL_INPUT_INVALID,
  validateToolInputContract,
} from '../../client/src/pages/Tools/tool-input-contract';

const documentRef = {
  version: 1 as const,
  provider: 'platform-file' as const,
  bucketId: 'bucket-1',
  filePath: 'academic-writing/users/user-1/file-1/source.pdf',
  fileName: 'source.pdf',
  sourceType: 'pdf' as const,
  mimeType: 'application/pdf',
  sizeBytes: 12,
  sha256: 'a'.repeat(64),
};

describe('AI tool input contracts', () => {
  it('requires DocumentInputRef for Polish document mode', () => {
    expect(validateToolInputContract('polish', {
      inputMode: 'file',
      documentRef,
    })).toEqual({ valid: true });

    expect(validateToolInputContract('polish', {
      inputMode: 'file',
      fileName: 'source.pdf',
    })).toMatchObject({ valid: false, code: AI_TOOL_INPUT_INVALID });
  });

  it('requires DocumentInputRef for Paper Revision document mode', () => {
    expect(validateToolInputContract('paper-revision', {
      inputMode: 'file',
      documentRef,
    })).toEqual({ valid: true });

    expect(validateToolInputContract('paper-revision', {
      inputMode: 'file',
      fileSize: 12,
    })).toMatchObject({ valid: false, code: AI_TOOL_INPUT_INVALID });
  });

  it('accepts topic generation text fields and rejects metadata-only file input', () => {
    expect(validateToolInputContract('topic-generation', {
      field: 'computer science',
      educationLevel: 'master',
    })).toEqual({ valid: true });
    expect(validateToolInputContract('topic-generation', {
      fileName: 'source.pdf',
      fileCount: 1,
    })).toMatchObject({ valid: false, code: AI_TOOL_INPUT_INVALID });
  });

  it('rejects metadata-only payloads for disabled or preview tool contracts', () => {
    for (const taskType of ['literature', 'outline', 'format'] as const) {
      expect(validateToolInputContract(taskType, {
        fileName: 'source.pdf',
        resourceCount: 1,
      })).toMatchObject({ valid: false, code: AI_TOOL_INPUT_INVALID });
    }
  });
});
