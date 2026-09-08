jest.mock('../../client/src/api/http', () => ({
  productHttpClient: {
    post: jest.fn(),
  },
}));

import { productHttpClient } from '../../client/src/api/http';
import {
  generate,
  GroundedGenerationApiError,
  type GroundedGenerationResult,
} from '../../client/src/api/grounded-generation';
import { mapGroundedGenerationResult } from '../../client/src/lib/grounded-writing';

const groundedResult: GroundedGenerationResult = {
  schemaVersion: 1,
  status: 'grounded',
  content: '结论见正文 [1]。',
  claims: [{
    claimId: 'claim-1',
    text: '结论见正文。',
    bindingStatus: 'bound',
    evidenceRefs: [{ evidenceId: 'evidence-1' }],
  }],
  citations: [{ citationId: 'citation-1', evidenceIds: ['evidence-1'] }],
  bibliography: [{
    citationId: 'citation-1',
    fields: { title: 'A source', author: 'An author', doi: '10.1234/example' },
  }],
  evidenceTrace: [{
    evidenceId: 'evidence-1',
    citationLocator: {
      section: 'Results',
      sourceBlockId: 'block-1',
      sourceBlockIndex: 2,
    },
    provenance: {
      documentId: 'document-1',
      documentVersionId: 'version-1',
      sourceBlockId: 'block-1',
      sourceBlockIndex: 2,
      section: 'Results',
      headingPath: ['Results'],
      sourceUnitId: 'unit-1',
      sourceChunkOrdinal: 0,
      itemOrdinal: 0,
    },
    sourceRecord: { title: 'A source' },
  }],
  grounding: {
    groundingCoverage: 'complete',
    diagnostics: [],
  },
  provenance: {
    selectedVersionIds: ['version-1'],
    retrievalProfile: {
      distanceMetric: 'cosine',
      embeddingProfileFingerprint: 'profile-fp',
      identity: { provider: 'test', model: 'test-v1', modelRevision: '1', dimensions: 2 },
      embeddingProfile: {
        provider: 'test',
        model: 'test-v1',
        modelRevision: '1',
        dimensions: 2,
      },
      policy: { topK: 5, candidateLimit: 20 },
    },
  },
  generation: {
    provider: 'test',
    model: 'test-v1',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  },
};

describe('grounded generation client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts only the accepted request shape with explicit version selection', async () => {
    (productHttpClient.post as jest.Mock).mockResolvedValueOnce({ data: groundedResult });

    await expect(generate({
      instructions: '  Write a concise discussion  ',
      queryText: '  What does the evidence show? ',
      retrieval: {
        selection: { mode: 'explicit', documentVersionIds: ['version-1'] },
      },
      output: { format: 'plain', citationStyle: 'numeric-inline' },
      grounding: { onUnbound: 'annotate' },
    })).resolves.toEqual(groundedResult);

    expect(productHttpClient.post).toHaveBeenCalledWith(
      '/api/grounded-generation/generate',
      {
        instructions: 'Write a concise discussion',
        queryText: 'What does the evidence show?',
        retrieval: {
          selection: { mode: 'explicit', documentVersionIds: ['version-1'] },
        },
        output: { format: 'plain', citationStyle: 'numeric-inline' },
        grounding: { onUnbound: 'annotate' },
      },
    );
    const payload = (productHttpClient.post as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('ownerId');
    expect(payload).not.toHaveProperty('taskId');
    expect(JSON.stringify(payload)).not.toContain('filePath');
  });

  it('defaults the output citation style without sending a File or document path', async () => {
    (productHttpClient.post as jest.Mock).mockResolvedValueOnce({ data: groundedResult });

    await generate({
      instructions: 'Write a summary',
      queryText: 'What is supported?',
      retrieval: { selection: { mode: 'active' } },
    });

    expect(productHttpClient.post).toHaveBeenCalledWith(
      '/api/grounded-generation/generate',
      expect.objectContaining({
        output: { format: 'markdown', citationStyle: 'numeric-inline' },
      }),
    );
    const payload = (productHttpClient.post as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('file');
    expect(payload).not.toHaveProperty('documentPath');
  });

  it('preserves the complete E6 result contract in the mapper', () => {
    expect(mapGroundedGenerationResult(groundedResult)).toEqual(groundedResult);
    expect(mapGroundedGenerationResult(groundedResult)?.claims[0].claimId).toBe('claim-1');
    expect(mapGroundedGenerationResult(groundedResult)?.citations[0].evidenceIds).toEqual(['evidence-1']);
    expect(mapGroundedGenerationResult(groundedResult)?.bibliography[0].fields).toEqual(
      groundedResult.bibliography[0].fields,
    );
    expect(mapGroundedGenerationResult(groundedResult)?.evidenceTrace[0].provenance).toEqual(
      groundedResult.evidenceTrace[0].provenance,
    );
    expect(mapGroundedGenerationResult({ ...groundedResult, status: 'unexpected' })).toBeNull();
    expect(mapGroundedGenerationResult({ ...groundedResult, content: 42 })).toBeNull();
  });

  it.each([null, 42, { code: 42 }])('rejects malformed grounding diagnostic %p', (diagnostic) => {
    expect(mapGroundedGenerationResult({
      ...groundedResult,
      grounding: { ...groundedResult.grounding, diagnostics: [diagnostic] },
    })).toBeNull();
  });

  it.each([
    { provenance: { ...groundedResult.provenance, retrievalProfile: null } },
    { generation: { ...groundedResult.generation, usage: null } },
  ])('rejects malformed optional nested metadata', (override) => {
    expect(mapGroundedGenerationResult({ ...groundedResult, ...override })).toBeNull();
  });

  it('maps the accepted citation-invalid transport to blocked with safe diagnostics', async () => {
    (productHttpClient.post as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error: {
            code: 'GROUNDED_GENERATION_CITATION_INVALID',
            message: 'raw provider or server detail',
            details: [{ code: 'unbound-unit', unitId: 'unit-1' }],
          },
        },
      },
    });

    try {
      await generate({ instructions: 'Write', queryText: 'Explain' });
      fail('generate should reject');
    } catch (error) {
      expect(error).toBeInstanceOf(GroundedGenerationApiError);
      expect(error).toMatchObject({
        code: 'GROUNDED_GENERATION_CITATION_INVALID',
        status: 422,
        uiState: 'blocked',
        diagnostics: [{ code: 'unbound-unit', unitId: 'unit-1' }],
      });
      expect((error as Error).message).not.toContain('raw provider or server detail');
    }
  });

  it.each([null, [{ code: 42 }]])('fails closed for malformed blocked details %p', async (details) => {
    (productHttpClient.post as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 422,
        data: { error: { code: 'GROUNDED_GENERATION_CITATION_INVALID', details } },
      },
    });

    await expect(generate({ instructions: 'Write', queryText: 'Explain' })).rejects.toMatchObject({
      code: 'GROUNDED_GENERATION_CITATION_INVALID',
      uiState: 'blocked',
      diagnostics: [],
    });
  });

  it('maps stable server failures without exposing raw provider details', async () => {
    (productHttpClient.post as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          error: {
            code: 'GROUNDED_GENERATION_RATE_LIMITED',
            message: 'raw provider secret response',
          },
        },
      },
    });

    await expect(generate({ instructions: 'Write', queryText: 'Explain' })).rejects.toMatchObject({
      name: 'GroundedGenerationApiError',
      code: 'GROUNDED_GENERATION_RATE_LIMITED',
      status: 429,
      retryable: true,
    });
    await expect(generate({ instructions: 'Write', queryText: 'Explain' })).rejects.not.toThrow('raw provider secret response');
  });
});
