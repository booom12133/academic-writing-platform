import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';
import type { GroundedModelOutput } from '../grounded-generation.types';
import { ClaimBindingValidator } from '../validation/claim-binding.validator';
import { CitationSemanticsService } from './citation-semantics.service';

const output: GroundedModelOutput = {
  segments: [{
    segmentId: 'segment-1',
    units: [{ unitId: 'unit-1', unitType: 'claim', text: 'Claim.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }],
  }],
};

const evidenceSet = {
  items: [{ evidenceId: 'chunk:one', text: 'Evidence.', citationLocator: { chunkId: 'one', documentVersionId: 'version-1' }, provenance: { documentId: 'document-1' } }],
} as unknown as EvidenceSet;

describe('CitationSemanticsService', () => {
  it('creates citation semantics from validated units and server evidence', () => {
    const validation = new ClaimBindingValidator().validate(output, evidenceSet);
    const result = new CitationSemanticsService().create(output, validation);

    expect(result.claims[0]).toMatchObject({ claimId: 'unit-1', bindingStatus: 'bound' });
    expect(result.citations).toEqual([{ citationId: 'citation-1', evidenceIds: ['chunk:one'] }]);
    expect(result.evidenceTrace[0].citationLocator).toEqual({ chunkId: 'one', documentVersionId: 'version-1' });
  });
});
