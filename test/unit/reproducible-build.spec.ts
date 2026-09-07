import { assertProductionToolingPinned } from '../../scripts/test-reproducible-build';

describe('production reproducible-build gate', () => {
  it('has no dynamic package installer in the production build path', () => {
    expect(() => assertProductionToolingPinned()).not.toThrow();
  });
});
