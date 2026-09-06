import type { EvidenceSet } from '../knowledge/retrieval/evidence-assembly';
import type { TextGenerationResult } from '../ai-tools/llm/llm.types';
import { GroundedEvidenceAdapter } from './evidence/grounded-evidence.adapter';
import { GroundedGenerationService } from './grounded-generation.service';

describe('grounded generation integration', () => {
  it('keeps E3 evidence provenance through generation, citation, and bibliography', async () => {
    const evidenceSet = {
      status: 'complete', selectedVersionIds: ['version-1'], diagnostics: [],
      items: [{
        evidenceId: 'chunk:one', text: 'Zotero PDF evidence.',
        citationLocator: { chunkId: 'one', documentVersionId: 'version-1', sourceRecordId: 'source-1' },
        provenance: { documentId: 'document-1', documentVersionId: 'version-1', sourceBlockId: 'block-1', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'unit-1', sourceChunkOrdinal: 0, itemOrdinal: 0 },
        sourceIdentity: {
          id: 'source-1', userId: 'user-1', kind: 'scholarly-work', externalProvenance: [], status: 'active', createdAt: '', updatedAt: '',
          canonicalMetadata: { title: { value: 'Resolved Zotero title', assertionIds: [], resolutionStatus: 'resolved' } },
        },
      } as never],
      profile: undefined,
    } as unknown as EvidenceSet;
    const facade = { retrieve: jest.fn().mockResolvedValue(evidenceSet) };
    const modelResult: TextGenerationResult = {
      content: JSON.stringify({ segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'claim', text: 'Generated claim.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }] }] }),
      provider: 'test-provider', model: 'test-model',
    };
    const service = new GroundedGenerationService(new GroundedEvidenceAdapter(facade), { generate: jest.fn().mockResolvedValue(modelResult) });

    const result = await service.generate('user-1', { instructions: 'Draft.', queryText: 'query' });

    expect(result.content).toBe('Generated claim. [1]');
    expect(result.evidenceTrace[0].provenance.documentId).toBe('document-1');
    expect(result.evidenceTrace[0].citationLocator.sourceRecordId).toBe('source-1');
    expect(result.bibliography).toEqual([{ citationId: 'citation-1', fields: { title: 'Resolved Zotero title' } }]);
  });
});
