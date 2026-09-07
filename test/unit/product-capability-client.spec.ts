import {
  PRODUCT_CAPABILITY_CATALOG,
  getProductCapabilities,
  productCapabilityFor,
} from '../../shared/product-capability.catalog';

describe('product capability catalog', () => {
  it('marks only the accepted AI execution paths as production', () => {
    expect(
      getProductCapabilities()
        .filter((capability) => capability.readiness === 'production')
        .map((capability) => capability.type),
    ).toEqual(expect.arrayContaining(['topic-generation', 'polish', 'paper-revision']));
    expect(
      getProductCapabilities().filter(
        (capability) => capability.readiness === 'production',
      ),
    ).toHaveLength(3);
  });

  it('replaces fictional literature generation with Academic Search', () => {
    expect(productCapabilityFor('literature')).toMatchObject({
      readiness: 'disabled',
      replacementRoute: '/academic-search',
    });
  });

  it('contains one defensive catalog entry for every legacy task type', () => {
    const firstRead = getProductCapabilities();
    const secondRead = getProductCapabilities();

    expect(firstRead).toHaveLength(PRODUCT_CAPABILITY_CATALOG.length);
    expect(new Set(firstRead.map((capability) => capability.type)).size).toBe(
      firstRead.length,
    );
    expect(firstRead).not.toBe(PRODUCT_CAPABILITY_CATALOG);
    expect(secondRead).not.toBe(firstRead);
  });
});
