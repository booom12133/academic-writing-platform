import type { NextFunction, Request, Response } from 'express';
import { LOCAL_DEVELOPMENT_USER_ID } from '../config/local-development';

export class LocalDevelopmentAuthMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.userContext = {
      userId: LOCAL_DEVELOPMENT_USER_ID,
      appId: 'local-development-app',
      loginUrl: '',
      userType: 'local-development',
      env: 'runtime',
      userName: 'Local Development User',
      userNameEn: 'Local Development User',
      userNameI18n: {},
      isSystemAccount: false,
      roles: [],
    };
    next();
  }
}
