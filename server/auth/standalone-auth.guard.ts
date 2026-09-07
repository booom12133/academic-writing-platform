import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { StandaloneAuthVerifier } from './standalone-auth.types';

export const NEED_LOGIN_METADATA_KEY = 'authnpaas:needLogin';

interface AuthenticatedRequest {
  headers?: { authorization?: string };
  userContext?: { userId: string };
}

@Injectable()
export class StandaloneAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: StandaloneAuthVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const needsLogin = this.reflector.getAllAndOverride<unknown>(
      NEED_LOGIN_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!needsLogin) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers?.authorization;
    if (!authorization) throw new UnauthorizedException('Authentication required.');

    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (!match) throw new UnauthorizedException('Authentication required.');

    const verified = await this.verifier.verifyBearerToken(match[1].trim());
    request.userContext = { userId: verified.userId };
    return true;
  }
}
