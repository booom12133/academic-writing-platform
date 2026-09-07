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

  it('preserves per-unit non-bound status and does not use duplicate-id lookup semantics', () => {
    const mixedOutput: GroundedModelOutput = {
      segments: [{
        segmentId: 'segment-1',
        units: [
          { unitId: 'unit-1', unitType: 'claim', text: 'Bound.', evidenceRefs: [{ evidenceId: 'chunk:one' }] },
          { unitId: 'unit-2', unitType: 'transition', text: 'Unknown.', evidenceRefs: [{ evidenceId: 'chunk:missing' }] },
        ],
      }],
    };
    const validation = new ClaimBindingValidator().validate(mixedOutput, evidenceSet);
    const result = new CitationSemanticsService().create(mixedOutput, validation);

    expect(result.units).toEqual([
      expect.objectContaining({ unitId: 'unit-1', bindingStatus: 'bound', citationIds: ['citation-1'] }),
      expect.objectContaining({ unitId: 'unit-2', bindingStatus: 'unbound', citationIds: [] }),
    ]);
  });
});
