import type { GroundedModelOutput } from '../grounded-generation.types';
import { CitationRenderer } from './citation-renderer';

describe('CitationRenderer', () => {
  it('renders content and inline citations from validated units only', () => {
    const output: GroundedModelOutput = {
      segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'transition', text: 'Rendered unit.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }] }],
    };

    const result = new CitationRenderer().render(output, {
      units: [{ unitId: 'unit-1', text: 'Rendered unit.', citationIds: ['citation-1'], bindingStatus: 'bound', diagnostics: [] }],
      citations: [{ citationId: 'citation-1', evidenceIds: ['chunk:one'] }],
    });

    expect(result.content).toBe('Rendered unit. [1]');
    expect(result.content).not.toContain('undefined');
  });

  it('marks every non-bound unit in annotated content', () => {
    const output = { segments: [] } as GroundedModelOutput;
    const result = new CitationRenderer().render(output, {
      units: [
        { unitId: 'unit-1', text: 'Partial.', citationIds: ['citation-1'], bindingStatus: 'partially-bound', diagnostics: [{ code: 'unknown-evidence-id', unitId: 'unit-1', evidenceId: 'missing' }] },
        { unitId: 'unit-2', text: 'Unbound.', citationIds: [], bindingStatus: 'unbound', diagnostics: [{ code: 'unbound-unit', unitId: 'unit-2' }] },
      ],
      citations: [{ citationId: 'citation-1', evidenceIds: ['chunk:one'] }],
    });

    expect(result.content).toContain('Partial. [1] [partially-bound]');
    expect(result.content).toContain('Unbound. [unbound]');
  });
});
