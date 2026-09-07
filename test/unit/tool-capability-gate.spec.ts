import { getCapabilityGateState } from '../../client/src/pages/Tools/CapabilityGate';

describe('tool capability gate', () => {
  it('renders a replacement state for disabled literature', () => {
    expect(getCapabilityGateState('literature')).toEqual({
      kind: 'disabled',
      replacementRoute: '/academic-search',
    });
  });

  it('renders a non-submittable preview state', () => {
    expect(getCapabilityGateState('outline')).toEqual({ kind: 'preview' });
  });

  it('allows only production capabilities to render an executable tool', () => {
    expect(getCapabilityGateState('topic-generation')).toEqual({
      kind: 'production',
    });
  });
});
