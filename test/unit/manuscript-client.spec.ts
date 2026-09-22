jest.mock('../../client/src/api/http', () => ({ productHttpClient: { get: jest.fn(), post: jest.fn() } }));
import { productHttpClient } from '../../client/src/api/http';
import { generateDerivedContent, getManuscript, refreshConclusion } from '../../client/src/api/paper-projects';
import { getHeadingAnchor, getManuscriptReadinessLabel, getManuscriptWarningLabel } from '../../client/src/lib/manuscript';

describe('manuscript client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses owner-scoped fingerprint-bearing manuscript routes without user ids', async () => {
    (productHttpClient.get as jest.Mock).mockResolvedValue({ data: { projectId: 'p/1' } });
    (productHttpClient.post as jest.Mock).mockResolvedValue({ data: { revision: { id: 'r' } } });
    await getManuscript('p/1');
    await generateDerivedContent('p/1', 'ABSTRACT', { expectedBodyFingerprint: 'a'.repeat(64), expectedCurrentRevisionNumber: 0 });
    await refreshConclusion('p/1', 's/1', { expectedConclusionBasisFingerprint: 'b'.repeat(64), expectedCurrentRevisionNumber: 2 });
    expect(productHttpClient.get).toHaveBeenCalledWith('/api/paper-projects/p%2F1/manuscript');
    expect(productHttpClient.post).toHaveBeenNthCalledWith(1, '/api/paper-projects/p%2F1/derived/abstract/generate', expect.not.objectContaining({ userId: expect.anything() }));
    expect(productHttpClient.post).toHaveBeenNthCalledWith(2, '/api/paper-projects/p%2F1/sections/s%2F1/conclusion-refresh', expect.objectContaining({ expectedCurrentRevisionNumber: 2 }));
  });

  it('maps readiness and warning codes to explicit user-facing text and stable anchors', () => {
    expect(getManuscriptReadinessLabel('BLOCKED')).toBe('导出受阻');
    expect(getManuscriptWarningLabel('CITATION_RENUMBER_UNSAFE')).toContain('引用编号');
    expect(getHeadingAnchor('node/一')).toBe('manuscript-node-node%2F%E4%B8%80');
  });
});
