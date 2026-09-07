export const RUNTIME_PROFILES = ['local', 'platform', 'standalone'] as const;

export type RuntimeProfile = (typeof RUNTIME_PROFILES)[number];

export class RuntimeProfileConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeProfileConfigurationError';
  }
}

export function parseRuntimeProfile(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeProfile {
  const rawProfile = env.RUNTIME_PROFILE?.trim();
  if (!rawProfile) {
    throw new RuntimeProfileConfigurationError(
      'RUNTIME_PROFILE is required and must be local, platform, or standalone.',
    );
  }
  if (!RUNTIME_PROFILES.includes(rawProfile as RuntimeProfile)) {
    throw new RuntimeProfileConfigurationError(
      `Unsupported RUNTIME_PROFILE: ${rawProfile}. Expected local, platform, or standalone.`,
    );
  }
  return rawProfile as RuntimeProfile;
}
