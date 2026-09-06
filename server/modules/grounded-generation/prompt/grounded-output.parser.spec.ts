import { parseGroundedModelOutput } from './grounded-output.parser';

describe('parseGroundedModelOutput', () => {
  it('accepts structured units with evidence ids only', () => {
    const result = parseGroundedModelOutput(JSON.stringify({
      segments: [{
        segmentId: 'segment-1',
        units: [{
          unitId: 'unit-1',
          unitType: 'claim',
          text: 'A grounded claim.',
          evidenceRefs: [{ evidenceId: 'chunk:one' }],
        }],
      }],
    }));

    expect(result.segments[0].units[0].evidenceRefs).toEqual([{ evidenceId: 'chunk:one' }]);
  });

  it('rejects an independent free-form content field', () => {
    expect(() => parseGroundedModelOutput(JSON.stringify({ content: 'free form', segments: [] }))).toThrow();
  });

  it('rejects units without evidence bindings', () => {
    expect(() => parseGroundedModelOutput(JSON.stringify({
      segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'transition', text: 'No source.', evidenceRefs: [] }] }],
    }))).toThrow();
  });

  it('rejects model-owned locator, provenance, and support type fields', () => {
    expect(() => parseGroundedModelOutput(JSON.stringify({
      segments: [{
        segmentId: 'segment-1',
        units: [{
          unitId: 'unit-1',
          unitType: 'claim',
          text: 'Claim.',
          evidenceRefs: [{ evidenceId: 'chunk:one', supportType: 'direct', citationLocator: {} }],
        }],
      }],
    }))).toThrow();
  });
});
