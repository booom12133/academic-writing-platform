import { Test } from '@nestjs/testing';

import { StandaloneAuthAdapter } from './standalone-auth.adapter';
import { StandaloneAuthModule } from './standalone-auth.module';

describe('StandaloneAuthModule', () => {
  it('resolves the configured adapter and global guard dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        StandaloneAuthModule.forRoot({
          issuer: 'https://issuer.example.com',
          audience: 'academic-writing-platform',
          jwksUrl: 'https://issuer.example.com/.well-known/jwks.json',
          userIdClaim: 'sub',
          allowedAlgorithms: ['RS256'],
          timeoutMs: 500,
        }),
      ],
    }).compile();

    expect(moduleRef.get(StandaloneAuthAdapter)).toBeInstanceOf(StandaloneAuthAdapter);
    await moduleRef.close();
  });
});
