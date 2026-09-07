import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  StandaloneAuthAdapter,
  StandaloneAuthConfiguration,
} from './standalone-auth.adapter';
import { StandaloneAuthGuard } from './standalone-auth.guard';

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

describe('StandaloneAuthAdapter', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key' };
  const config: StandaloneAuthConfiguration = {
    issuer: 'https://issuer.example.com',
    audience: 'academic-writing-platform',
    jwksUrl: 'https://issuer.example.com/.well-known/jwks.json',
    userIdClaim: 'sub',
    allowedAlgorithms: ['RS256'],
    timeoutMs: 500,
  };

  function token(payload: Record<string, unknown>, algorithm = 'RS256'): string {
    const header = base64Url(JSON.stringify({ alg: algorithm, typ: 'JWT', kid: 'test-key' }));
    const body = base64Url(JSON.stringify(payload));
    const input = `${header}.${body}`;
    const signature = sign('RSA-SHA256', Buffer.from(input), privateKey);
    return `${input}.${base64Url(signature)}`;
  }

  function adapter(fetchImpl: typeof fetch = jest.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }))) {
    return new StandaloneAuthAdapter(config, fetchImpl);
  }

  it('verifies a signed JWT and maps only the configured user id claim', async () => {
    const result = await adapter().verifyBearerToken(token({
      iss: config.issuer,
      aud: config.audience,
      sub: 'user-1',
      exp: Math.floor(Date.now() / 1000) + 60,
      email: 'must-not-leak@example.com',
    }));

    expect(result).toEqual({ userId: 'user-1' });
  });

  it.each([
    ['wrong issuer', { iss: 'https://attacker.example', aud: config.audience }],
    ['wrong audience', { iss: config.issuer, aud: 'other-service' }],
    ['expired token', { iss: config.issuer, aud: config.audience, exp: 1 }],
  ])('rejects %s', async (_name, claims) => {
    await expect(adapter().verifyBearerToken(token({ ...claims, sub: 'user-1' })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an algorithm outside the allowlist', async () => {
    await expect(adapter().verifyBearerToken(token({
      iss: config.issuer,
      aud: config.audience,
      sub: 'user-1',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, 'HS256'))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('StandaloneAuthGuard', () => {
  function context(metadata: unknown, authorization?: string) {
    const request: { headers: Record<string, string>; userContext?: { userId: string } } = {
      headers: authorization ? { authorization } : {},
    };
    const handler = () => undefined;
    const controller = class Controller {};
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(metadata);
    const executionContext = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => controller,
    } as unknown as ExecutionContext;
    return { request, executionContext, reflector };
  }

  it('rejects an anonymous request only when existing NeedLogin metadata is present', async () => {
    const { executionContext, reflector } = context({});
    const guard = new StandaloneAuthGuard(reflector, { verifyBearerToken: jest.fn() });

    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows an anonymous public route without NeedLogin metadata', async () => {
    const { executionContext, reflector } = context(undefined);
    const guard = new StandaloneAuthGuard(reflector, { verifyBearerToken: jest.fn() });

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
  });

  it('writes verified identity and never reads a client supplied user id', async () => {
    const { executionContext, request, reflector } = context({}, 'Bearer signed-token');
    const verifyBearerToken = jest.fn().mockResolvedValue({ userId: 'verified-user' });
    const guard = new StandaloneAuthGuard(reflector, { verifyBearerToken });

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request.userContext).toEqual({ userId: 'verified-user' });
  });
});
