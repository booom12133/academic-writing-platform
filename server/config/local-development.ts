export const LOCAL_DEVELOPMENT_USER_ID = 'local-development-user';

export function isLocalDevelopmentWithoutPlatformDomain(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NODE_ENV === 'development' &&
    env.MIAODA_LOCAL_DEV === '1' &&
    !env.FORCE_AUTHN_INNERAPI_DOMAIN
  );
}
