import { isLocalDevelopmentWithoutPlatformDomain } from './local-development';

describe('isLocalDevelopmentWithoutPlatformDomain', () => {
  it('is true only for the explicit local development launcher without a platform domain', () => {
    expect(
      isLocalDevelopmentWithoutPlatformDomain({
        NODE_ENV: 'development',
        MIAODA_LOCAL_DEV: '1',
      }),
    ).toBe(true);

    expect(
      isLocalDevelopmentWithoutPlatformDomain({
        NODE_ENV: 'development',
        MIAODA_LOCAL_DEV: '1',
        FORCE_AUTHN_INNERAPI_DOMAIN: 'https://real-platform.example',
      }),
    ).toBe(false);

    expect(
      isLocalDevelopmentWithoutPlatformDomain({
        NODE_ENV: 'production',
        MIAODA_LOCAL_DEV: '1',
      }),
    ).toBe(false);
  });
});
