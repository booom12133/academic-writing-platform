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
    expect(result.citationPlacements).toEqual([{
      schemaVersion: 1,
      citationId: 'citation-1',
      localNumber: 1,
      start: 15,
      end: 18,
      markerText: '[1]',
    }]);
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

  it('records UTF-16 offsets for adjacent markers after emoji and CJK text', () => {
    const result = new CitationRenderer().render({ segments: [] }, {
      units: [{ unitId: 'unit-1', text: '😀研究', citationIds: ['citation-1', 'citation-2'], bindingStatus: 'bound', diagnostics: [] }],
      citations: [
        { citationId: 'citation-1', evidenceIds: ['one'] },
        { citationId: 'citation-2', evidenceIds: ['two'] },
      ],
    });

    expect(result.content).toBe('😀研究 [1][2]');
    expect(result.citationPlacements.map(({ citationId, start, end, markerText }) => ({ citationId, start, end, markerText }))).toEqual([
      { citationId: 'citation-1', start: 5, end: 8, markerText: '[1]' },
      { citationId: 'citation-2', start: 8, end: 11, markerText: '[2]' },
    ]);
  });
});
