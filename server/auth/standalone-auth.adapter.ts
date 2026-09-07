import {
  createPublicKey,
  verify as verifySignature,
  type KeyObject,
} from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { STANDALONE_AUTH_CONFIGURATION } from './standalone-auth.types';
import type {
  StandaloneAuthConfiguration,
  StandaloneAuthVerifier,
  VerifiedUserContext,
} from './standalone-auth.types';

export type { StandaloneAuthConfiguration } from './standalone-auth.types';

interface JsonWebKeySet {
  keys?: readonly Record<string, unknown>[];
}

interface JwtHeader {
  alg?: unknown;
  kid?: unknown;
}

interface JwtClaims {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  [claim: string]: unknown;
}

interface CachedKey {
  key: KeyObject;
  expiresAt: number;
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_TOKEN_LENGTH = 16 * 1024;
const SIGNATURE_ALGORITHMS: Readonly<Record<string, string>> = {
  RS256: 'RSA-SHA256',
  RS384: 'RSA-SHA384',
  RS512: 'RSA-SHA512',
};

function decodeJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

@Injectable()
export class StandaloneAuthAdapter implements StandaloneAuthVerifier {
  private readonly cachedKeys = new Map<string, CachedKey>();
  private readonly fetchImpl: typeof fetch;

  constructor(
    @Inject(STANDALONE_AUTH_CONFIGURATION)
    private readonly configuration: StandaloneAuthConfiguration,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.fetchImpl = fetchImpl;
  }

  async verifyBearerToken(token: string): Promise<VerifiedUserContext> {
    try {
      if (!isNonEmptyString(token) || token.length > MAX_TOKEN_LENGTH) {
        throw new Error('invalid token');
      }

      const segments = token.split('.');
      if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
        throw new Error('invalid token');
      }

      const header = decodeJson<JwtHeader>(segments[0]);
      const claims = decodeJson<JwtClaims>(segments[1]);
      const algorithm = header.alg;
      const keyId = header.kid;
      if (
        !isNonEmptyString(algorithm) ||
        !isNonEmptyString(keyId) ||
        !this.configuration.allowedAlgorithms.includes(algorithm) ||
        !(algorithm in SIGNATURE_ALGORITHMS)
      ) {
        throw new Error('algorithm rejected');
      }

      const key = await this.getKey(keyId);
      const signature = Buffer.from(segments[2], 'base64url');
      const signedPayload = Buffer.from(`${segments[0]}.${segments[1]}`);
      if (
        signature.length === 0 ||
        !verifySignature(
          SIGNATURE_ALGORITHMS[algorithm],
          signedPayload,
          key,
          signature,
        )
      ) {
        throw new Error('signature rejected');
      }

      if (claims.iss !== this.configuration.issuer) {
        throw new Error('issuer rejected');
      }
      if (!this.hasAudience(claims.aud)) {
        throw new Error('audience rejected');
      }
      if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
        throw new Error('expiry rejected');
      }
      if (claims.exp <= Math.floor(Date.now() / 1000)) {
        throw new Error('token expired');
      }

      const userId = claims[this.configuration.userIdClaim];
      if (!isNonEmptyString(userId)) {
        throw new Error('user id rejected');
      }
      return { userId: userId.trim() };
    } catch (_error) {
      throw new UnauthorizedException('Invalid bearer token.');
    }
  }

  private hasAudience(audience: unknown): boolean {
    return (
      audience === this.configuration.audience ||
      (Array.isArray(audience) && audience.includes(this.configuration.audience))
    );
  }

  private async getKey(keyId: string): Promise<KeyObject> {
    const cached = this.cachedKeys.get(keyId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.key;

    const keys = await this.fetchKeys();
    for (const key of keys) {
      const id = key.kid;
      if (!isNonEmptyString(id) || !isNonEmptyString(key.kty as unknown)) continue;
      try {
        const publicKey = createPublicKey({
          key: key as unknown as import('node:crypto').JsonWebKey,
          format: 'jwk',
        });
        this.cachedKeys.set(id, {
          key: publicKey,
          expiresAt: now + JWKS_CACHE_TTL_MS,
        });
      } catch (_error) {
        // Ignore malformed keys and continue looking for the requested key.
      }
    }

    const refreshed = this.cachedKeys.get(keyId);
    if (!refreshed) throw new Error('signing key unavailable');
    return refreshed.key;
  }

  private async fetchKeys(): Promise<readonly Record<string, unknown>[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.fetchImpl(this.configuration.jwksUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('jwks request failed');
      const body = (await response.json()) as JsonWebKeySet;
      if (!body || !Array.isArray(body.keys)) throw new Error('jwks response invalid');
      return body.keys;
    } finally {
      clearTimeout(timeout);
    }
  }
}
