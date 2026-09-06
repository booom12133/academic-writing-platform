import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';
import type { GroundedModelOutput } from '../grounded-generation.types';
import { ClaimBindingValidator } from './claim-binding.validator';

function evidenceSet(): EvidenceSet {
  return {
    status: 'complete',
    selectedVersionIds: [],
    items: [{
      evidenceId: 'chunk:one',
      text: 'Evidence text.',
      citationLocator: { chunkId: 'one', documentVersionId: 'version-1' },
      provenance: { documentId: 'document-1', documentVersionId: 'version-1', sourceBlockId: 'block-1', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'unit-1', sourceChunkOrdinal: 0, itemOrdinal: 0 },
    } as never],
    diagnostics: [],
    profile: undefined,
  };
}

function modelOutput(evidenceId = 'chunk:one'): GroundedModelOutput {
  return {
    segments: [{
      segmentId: 'segment-1',
      units: [
        { unitId: 'unit-1', unitType: 'claim', text: 'Claim.', evidenceRefs: [{ evidenceId }] },
        { unitId: 'unit-2', unitType: 'transition', text: 'Transition.', evidenceRefs: [{ evidenceId }] },
      ],
    }],
  };
}

describe('ClaimBindingValidator', () => {
  it('binds every unit from server evidence and preserves separate trace fields', () => {
    const result = new ClaimBindingValidator().validate(modelOutput(), evidenceSet());

    expect(result.bindingStatus).toBe('bound');
    expect(result.groundingCoverage).toBe('complete');
    expect(result.evidenceTrace[0].citationLocator).toEqual({ chunkId: 'one', documentVersionId: 'version-1' });
    expect(result.evidenceTrace[0].provenance.documentId).toBe('document-1');
  });

  it('reports an unknown evidence id as unbound without semantic support claims', () => {
    const result = new ClaimBindingValidator().validate(modelOutput('chunk:missing'), evidenceSet());

    expect(result.bindingStatus).toBe('unbound');
    expect(result.groundingCoverage).toBe('none');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('unknown-evidence-id');
    expect(result).not.toHaveProperty('supportStatus');
  });

  it('does not classify incomplete binding as insufficient evidence when evidence exists', () => {
    const output = modelOutput();
    output.segments[0].units[1].evidenceRefs = [] as never;

    const result = new ClaimBindingValidator().validate(output, evidenceSet());

    expect(result.groundingCoverage).toBe('partial');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('unbound-unit');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('empty-evidence');
  });
});
