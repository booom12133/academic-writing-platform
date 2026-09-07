import { GroundedGenerationError } from './grounded-generation.errors';
import { parseGroundedGenerationRequest } from './grounded-generation.http.dto';

describe('parseGroundedGenerationRequest', () => {
  const valid = {
    instructions: 'Draft a paragraph.',
    queryText: 'retrieval query',
  };

  it('accepts the approved request shape and defaults optional controls', () => {
    expect(parseGroundedGenerationRequest(valid)).toEqual(valid);
  });

  it('requires all fields inside optional output and grounding objects', () => {
    expect(() => parseGroundedGenerationRequest({
      ...valid,
      output: { format: 'markdown' },
    })).toThrow();
    expect(() => parseGroundedGenerationRequest({
      ...valid,
      grounding: {},
    })).toThrow();
  });

  it.each([
    ['unknown root key', { ...valid, extra: true }],
    ['unknown retrieval key', { ...valid, retrieval: { unexpected: true } }],
    ['unknown policy key', { ...valid, retrieval: { policy: { topK: 2, nope: 1 } } }],
    ['invalid selection', { ...valid, retrieval: { selection: { mode: 'latest' } } }],
    ['invalid filter', { ...valid, retrieval: { filters: { sourceKinds: ['not-a-source'] } } }],
    ['invalid output format', { ...valid, output: { format: 'html', citationStyle: 'numeric-inline' } }],
    ['invalid citation style', { ...valid, output: { format: 'markdown', citationStyle: 'author-date' } }],
    ['invalid onUnbound', { ...valid, grounding: { onUnbound: 'allow' } }],
  ])('rejects %s with the stable 400 error', (_label, request) => {
    expect(() => parseGroundedGenerationRequest(request)).toThrow(
      expect.objectContaining({
        code: 'GROUNDED_GENERATION_INVALID_QUERY',
        httpStatus: 400,
      }) as GroundedGenerationError,
    );
  });

  it('validates retrieval policy bounds before the request reaches E3', () => {
    expect(() => parseGroundedGenerationRequest({ ...valid, retrieval: { policy: { topK: 40 } } })).toThrow(
      expect.objectContaining({ code: 'GROUNDED_GENERATION_INVALID_QUERY', httpStatus: 400 }),
    );
    expect(() => parseGroundedGenerationRequest({ ...valid, retrieval: { policy: { topK: 100, candidateLimit: 100 } } })).toThrow(
      expect.objectContaining({ code: 'GROUNDED_GENERATION_INVALID_QUERY', httpStatus: 400 }),
    );
    expect(() => parseGroundedGenerationRequest({ ...valid, retrieval: { policy: { candidateLimit: 201 } } })).toThrow(
      expect.objectContaining({ code: 'GROUNDED_GENERATION_INVALID_QUERY', httpStatus: 400 }),
    );
    expect(() => parseGroundedGenerationRequest({ ...valid, retrieval: { policy: { topK: 0 } } })).toThrow();
    expect(() => parseGroundedGenerationRequest({ ...valid, retrieval: { policy: { topK: 3, candidateLimit: 2 } } })).toThrow();
  });
});
