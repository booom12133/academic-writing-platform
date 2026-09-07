import { GroundedGenerationError } from './grounded-generation.errors';

describe('GroundedGenerationError', () => {
  it('exposes the stable E6 error code and HTTP status', () => {
    const error = new GroundedGenerationError(
      'GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE',
      'No usable evidence was found.',
      422,
    );

    expect(error.code).toBe('GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE');
    expect(error.httpStatus).toBe(422);
  });
});
