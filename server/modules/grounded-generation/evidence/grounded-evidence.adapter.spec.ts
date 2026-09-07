import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';
import type { KnowledgeRetrievalInput } from '../../knowledge/retrieval/knowledge-retrieval.service';
import { GroundedEvidenceAdapter } from './grounded-evidence.adapter';

describe('GroundedEvidenceAdapter', () => {
  it('delegates evidence resolution to the existing E3 public facade', async () => {
    const evidenceSet = { status: 'complete', items: [] } as unknown as EvidenceSet;
    const facade = { retrieve: jest.fn().mockResolvedValue(evidenceSet) };
    const input: KnowledgeRetrievalInput = { userId: 'user-1', queryText: 'grounded query' };

    const result = await new GroundedEvidenceAdapter(facade).retrieve(input);

    expect(result).toBe(evidenceSet);
    expect(facade.retrieve).toHaveBeenCalledWith(input);
  });
});
