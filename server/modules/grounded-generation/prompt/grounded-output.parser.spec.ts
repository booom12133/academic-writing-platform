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

  it('rejects empty segments and empty units as invalid provider responses', () => {
    expect(() => parseGroundedModelOutput(JSON.stringify({ segments: [] }))).toThrow(
      'invalid grounded response',
    );
    expect(() => parseGroundedModelOutput(JSON.stringify({
      segments: [{ segmentId: 'segment-1', units: [] }],
    }))).toThrow('invalid grounded response');
  });

  it('rejects duplicate segment and unit ids', () => {
    expect(() => parseGroundedModelOutput(JSON.stringify({
      segments: [
        { segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'claim', text: 'One.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }] },
        { segmentId: 'segment-1', units: [{ unitId: 'unit-2', unitType: 'claim', text: 'Two.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }] },
      ],
    }))).toThrow('invalid grounded response');
    expect(() => parseGroundedModelOutput(JSON.stringify({
      segments: [{
        segmentId: 'segment-1',
        units: [
          { unitId: 'unit-1', unitType: 'claim', text: 'One.', evidenceRefs: [{ evidenceId: 'chunk:one' }] },
          { unitId: 'unit-1', unitType: 'transition', text: 'Two.', evidenceRefs: [{ evidenceId: 'chunk:one' }] },
        ],
      }],
    }))).toThrow('invalid grounded response');
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
