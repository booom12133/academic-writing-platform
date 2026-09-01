import { LlmService } from '../llm/llm.service';
import { SkillComposer } from '../skills/skill.composer';
import { SkillRegistry } from '../skills/skill.registry';
import { InvariantValidator } from '../skills/validators/invariant.validator';
import type { InvariantValidationResult } from '../skills/validators/invariant.types';
import { PolishGenerator } from './polish.generator';

describe('PolishGenerator', () => {
  const input = {
    text: 'On DvXray, RT-DETR achieved 92.4% mAP (p = 0.032) [12].',
    polishType: 'academic',
  };

  const createGenerator = (llmResponse = {
    content: JSON.stringify({
      revisedContent: 'On DvXray, RT-DETR achieved 92.4% mAP (p = 0.032) [12].',
      changes: [],
      warnings: [],
    }),
    model: 'deepseek-v4-flash',
    usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
  }, validation: InvariantValidationResult = { status: 'PASS', violations: [], summary: { errors: 0, warnings: 0 } }) => {
    const llmService = { generate: jest.fn().mockResolvedValue(llmResponse) };
    const composer = { compose: jest.fn().mockReturnValue({ system: 'system', user: 'user', skillIds: ['academic-polish'] }) };
    const registry = { getStackFor: jest.fn().mockReturnValue({ id: 'academic-polish-en', validatorProfile: 'polish-strict' }) };
    const validator = { validate: jest.fn().mockReturnValue(validation) };
    return {
      generator: new PolishGenerator(
        llmService as unknown as LlmService,
        composer as unknown as SkillComposer,
        registry as unknown as SkillRegistry,
        validator as unknown as InvariantValidator,
      ),
      llmService,
      composer,
      registry,
      validator,
    };
  };

  it('selects the language stack, calls LlmService, validates JSON, and returns real metadata', async () => {
    const context = createGenerator();

    const result = await context.generator.generate(input);

    expect(context.registry.getStackFor).toHaveBeenCalledWith('polish', 'en');
    expect(context.composer.compose).toHaveBeenCalledWith('academic-polish-en', expect.objectContaining({
      sourceText: input.text,
    }));
    expect(context.llmService.generate).toHaveBeenCalledWith(expect.objectContaining({
      jsonMode: true,
      messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'user' }],
    }));
    expect(context.validator.validate).toHaveBeenCalledWith(expect.objectContaining({
      profile: 'polish-strict',
      original: input.text,
      revised: expect.any(String),
    }));
    expect(result).toMatchObject({
      originalContent: input.text,
      revisedContent: input.text,
      metadata: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
        latencyMs: expect.any(Number),
      },
    });
  });

  it('fails delivery when polish-strict reports an invariant error', async () => {
    const context = createGenerator(undefined, {
      status: 'ERROR',
      violations: [{ type: 'p-value', severity: 'ERROR', message: 'changed' }],
      summary: { errors: 1, warnings: 0 },
    });

    await expect(context.generator.generate(input)).rejects.toThrow('Invariant validation failed');
  });
});
