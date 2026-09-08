jest.mock('../../client/src/api/http', () => ({
  productHttpClient: {
    post: jest.fn(),
  },
}));

import { productHttpClient } from '../../client/src/api/http';
import { search } from '../../client/src/api/academic-search';

describe('academic search client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts only accepted E5 request keys and passes cursor opaquely', async () => {
    const response = {
      provider: 'openalex',
      status: 'partial' as const,
      items: [],
      nextCursor: 'opaque.cursor%2Fnot-for-client-decoding',
      diagnostics: [],
      provenance: {
        provider: 'openalex' as const,
        queryFingerprint: 'fingerprint',
        retrievedAt: '2026-09-08T00:00:00.000Z',
      },
    };
    (productHttpClient.post as jest.Mock).mockResolvedValueOnce({ data: response });

    await expect(search({
      q: '  causal inference  ',
      fromPublicationDate: '2020-01-01',
      toPublicationDate: '2025-12-31',
      publicationYear: 2024,
      workType: 'article',
      isOpenAccess: true,
      pageSize: 20,
      cursor: response.nextCursor,
    })).resolves.toEqual(response);

    expect(productHttpClient.post).toHaveBeenCalledWith('/api/academic-search/search', {
      q: 'causal inference',
      fromPublicationDate: '2020-01-01',
      toPublicationDate: '2025-12-31',
      publicationYear: 2024,
      workType: 'article',
      isOpenAccess: true,
      pageSize: 20,
      cursor: response.nextCursor,
    });
    expect(productHttpClient.post.mock.calls[0][1]).not.toHaveProperty('userId');
    expect(productHttpClient.post.mock.calls[0][1]).not.toHaveProperty('indexed');
  });

  it('maps stable provider failures without exposing raw upstream details', async () => {
    (productHttpClient.post as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 502,
        data: {
          error: {
            code: 'ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE',
            message: 'raw upstream secret response',
          },
        },
      },
    });

    const request = search({ q: 'causal inference' });
    await expect(request).rejects.toMatchObject({
      name: 'ProductIntegrationError',
      code: 'ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE',
      retryable: true,
    });
    await expect(request).rejects.not.toThrow('raw upstream secret response');
  });
});
