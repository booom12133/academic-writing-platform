export const STANDALONE_AUTH_CONFIGURATION = Symbol('STANDALONE_AUTH_CONFIGURATION');

export interface StandaloneAuthConfiguration {
  issuer: string;
  audience: string;
  jwksUrl: string;
  userIdClaim: string;
  allowedAlgorithms: readonly string[];
  timeoutMs: number;
}

export interface VerifiedUserContext {
  userId: string;
}

export interface StandaloneAuthVerifier {
  verifyBearerToken(token: string): Promise<VerifiedUserContext>;
}
