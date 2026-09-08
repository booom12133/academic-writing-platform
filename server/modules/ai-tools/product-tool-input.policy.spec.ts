import { BadRequestException } from '@nestjs/common';
import { productCapabilityFor } from '../../../shared/product-capability.catalog';
import {
  AI_TOOL_INPUT_INVALID,
  validateProductToolInput,
} from './product-capability.policy';

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

function capability(type: 'topic-generation' | 'polish' | 'paper-revision') {
  return productCapabilityFor(type)!;
}

describe('product tool input policy', () => {
  it('accepts the real text contract for topic generation', () => {
    expect(() => validateProductToolInput(capability('topic-generation'), {
      field: 'computer science',
      educationLevel: 'master',
    })).not.toThrow();
  });

  it('accepts Polish document mode only with a structured DocumentInputRef', () => {
    expect(() => validateProductToolInput(capability('polish'), {
      inputMode: 'file',
      documentRef,
    })).not.toThrow();
  });

  it('rejects Polish metadata-only file payloads before execution', () => {
    expect(() => validateProductToolInput(capability('polish'), {
      inputMode: 'file',
      fileName: 'source.pdf',
      fileSize: 12,
    })).toThrow(BadRequestException);

    try {
      validateProductToolInput(capability('polish'), {
        inputMode: 'file',
        fileName: 'source.pdf',
      });
    } catch (error) {
      expect(error).toMatchObject({
        response: { code: AI_TOOL_INPUT_INVALID },
      });
    }
  });

  it('rejects Paper Revision file mode without a structured ref', () => {
    expect(() => validateProductToolInput(capability('paper-revision'), {
      inputMode: 'file',
      fileName: 'source.pdf',
      fileCount: 1,
    })).toThrow(BadRequestException);
  });

  it('rejects malformed refs and metadata-only payloads for disabled tools', () => {
    expect(() => validateProductToolInput(capability('paper-revision'), {
      inputMode: 'file',
      documentRef: { fileName: 'source.pdf' },
    })).toThrow(BadRequestException);

    expect(() => validateProductToolInput(
      productCapabilityFor('literature')!,
      { fileName: 'source.pdf', refCount: 2 },
    )).toThrow(BadRequestException);
  });
});
