import type { GroundedModelOutput } from '../grounded-generation.types';
import { CitationRenderer } from './citation-renderer';

describe('CitationRenderer', () => {
  it('renders content and inline citations from validated units only', () => {
    const output: GroundedModelOutput = {
      segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'transition', text: 'Rendered unit.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }] }],
    };

    const result = new CitationRenderer().render(output, {
      units: [{ unitId: 'unit-1', text: 'Rendered unit.', citationIds: ['citation-1'] }],
      citations: [{ citationId: 'citation-1', evidenceIds: ['chunk:one'] }],
      bibliography: [],
    });

    expect(result.content).toBe('Rendered unit. [1]');
    expect(result.content).not.toContain('undefined');
  });
});
