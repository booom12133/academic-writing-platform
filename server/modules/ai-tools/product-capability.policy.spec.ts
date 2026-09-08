import { BadRequestException } from '@nestjs/common';
import { assertToolSubmissionAllowed } from './product-capability.policy';

describe('product capability submission policy', () => {
  it('rejects disabled literature submissions with a stable sanitized error', () => {
    expect(() =>
      assertToolSubmissionAllowed('literature', { topic: 'neural networks' }),
    ).toThrow(BadRequestException);

    try {
      assertToolSubmissionAllowed('literature', { topic: 'neural networks' });
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: 'AI_TOOL_NOT_PRODUCTION_READY',
        },
      });
    }
  });

  it('rejects preview submissions even when the test runtime is active', () => {
    expect(() => assertToolSubmissionAllowed('outline', { topic: 'outline' })).toThrow(
      BadRequestException,
    );
  });

  it('allows each accepted production capability', () => {
    expect(() =>
      assertToolSubmissionAllowed('topic-generation', { requirements: 'scope' }),
    ).not.toThrow();
    expect(() => assertToolSubmissionAllowed('polish', {
      inputMode: 'text',
      text: 'text',
    })).not.toThrow();
    expect(() =>
      assertToolSubmissionAllowed('paper-revision', { inputMode: 'text', text: 'text' }),
    ).not.toThrow();
  });
});
