import 'reflect-metadata';

import { Test } from '@nestjs/testing';

import { LlmService } from './llm.service';
import {
  TEXT_GENERATION_PROVIDER,
  type TextGenerationProvider,
} from './text-generation.provider';

describe('LlmService', () => {
  it('delegates generation and health through the provider token', async () => {
    const fakeProvider: TextGenerationProvider = {
      generate: jest.fn().mockResolvedValue({
        content: '{"ok":true}',
        provider: 'fake-generation',
        model: 'fake-model',
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
      }),
      checkHealth: jest.fn().mockResolvedValue({
        configured: true,
        provider: 'fake-generation',
        reachable: true,
        defaultModel: 'fake-model',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: TEXT_GENERATION_PROVIDER, useValue: fakeProvider },
        {
          provide: LlmService,
          useFactory: (provider: TextGenerationProvider) => new LlmService(provider),
          inject: [TEXT_GENERATION_PROVIDER],
        },
      ],
    }).compile();

    const service = moduleRef.get(LlmService);
    const request = { messages: [{ role: 'user' as const, content: 'test' }] };

    await expect(service.generate(request)).resolves.toEqual({
      content: '{"ok":true}',
      provider: 'fake-generation',
      model: 'fake-model',
      usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
    });
    await expect(service.checkHealth()).resolves.toEqual({
      configured: true,
      provider: 'fake-generation',
      reachable: true,
      defaultModel: 'fake-model',
    });

    expect(fakeProvider.generate).toHaveBeenCalledWith(request);
    expect(fakeProvider.generate).toHaveBeenCalledTimes(1);
    expect(fakeProvider.checkHealth).toHaveBeenCalledTimes(1);
  });
});
