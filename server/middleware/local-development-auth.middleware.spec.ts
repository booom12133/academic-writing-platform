import { LocalDevelopmentAuthMiddleware } from './local-development-auth.middleware';

describe('LocalDevelopmentAuthMiddleware', () => {
  it('provides an explicit local development user context', () => {
    const request: any = { userContext: {} };
    const next = jest.fn();

    new LocalDevelopmentAuthMiddleware().use(request, {} as any, next);

    expect(request.userContext).toMatchObject({
      userId: 'local-development-user',
      userName: 'Local Development User',
      userType: 'local-development',
      env: 'runtime',
      loginUrl: '',
      isSystemAccount: false,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
