import 'reflect-metadata';

import { Test } from '@nestjs/testing';

import { PaperRevisionGenerator } from '../generators/paper-revision.generator';
import { PolishGenerator } from '../generators/polish.generator';
import { TopicGenerationGenerator } from '../generators/topic-generation.generator';
import { LlmService } from './llm.service';
import {
  TEXT_GENERATION_PROVIDER,
  type TextGenerationProvider,
} from './text-generation.provider';

describe('D4 provider decoupling integration', () => {
  it('traverses the real LlmService into all three real generators', async () => {
    const fakeProvider: TextGenerationProvider = {
      generate: jest.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            topics: [{
              title: 'A topic',
              researchDirection: 'A direction',
              innovation: 'An angle',
              difficulty: 'medium',
              keyIdeas: ['An idea'],
            }],
          }),
          provider: 'fake-generation',
          model: 'fake-model',
          usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ revisedContent: 'Polished text', changes: [], warnings: [] }),
          provider: 'fake-generation',
          model: 'fake-model',
          usage: { promptTokens: 4, completionTokens: 5, totalTokens: 9 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            revisedContent: 'Revised text',
            changeSummary: [],
            unresolvedIssues: [],
            authorInputNeeded: false,
            warnings: [],
          }),
          provider: 'fake-generation',
          model: 'fake-model',
          usage: { promptTokens: 6, completionTokens: 7, totalTokens: 13 },
        }),
      checkHealth: jest.fn(),
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
    const llmService = moduleRef.get(LlmService);
    const composer = { compose: jest.fn().mockReturnValue({ system: 'system', user: 'user' }) };
    const registry = {
      getStackFor: jest.fn()
        .mockReturnValueOnce({ id: 'topic', validatorProfile: 'topic' })
        .mockReturnValueOnce({ id: 'polish', validatorProfile: 'polish-strict' })
        .mockReturnValueOnce({ id: 'revision', validatorProfile: 'revision-conservative' }),
    };
    const validator = {
      validate: jest.fn().mockReturnValue({
        status: 'PASS',
        violations: [],
        summary: { errors: 0, warnings: 0 },
      }),
    };

    const topic = await new TopicGenerationGenerator(llmService).generate({ field: 'education' });
    const polish = await new PolishGenerator(
      llmService,
      composer as never,
      registry as never,
      validator as never,
    ).generate({ text: 'Original text' });
    const revision = await new PaperRevisionGenerator(
      llmService,
      composer as never,
      registry as never,
      validator as never,
    ).generate({ text: 'Original text' });

    expect(topic.metadata).toMatchObject({
      provider: 'fake-generation',
      model: 'fake-model',
      usage: { totalTokens: 3 },
    });
    expect(polish.metadata).toMatchObject({
      provider: 'fake-generation',
      model: 'fake-model',
      usage: { totalTokens: 9 },
    });
    expect(revision.metadata).toMatchObject({
      provider: 'fake-generation',
      model: 'fake-model',
      usage: { totalTokens: 13 },
    });

    expect(fakeProvider.generate).toHaveBeenCalledTimes(3);
    for (const [request] of (fakeProvider.generate as jest.Mock).mock.calls) {
      expect(request.jsonMode).toBe(true);
      expect(request).not.toHaveProperty('thinking');
    }
  });
});
