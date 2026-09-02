import type { PolishGenerator, PolishOutput } from '../generators/polish.generator';
import type { ToolChunkExecutionInput } from '../execution/tool-execution.types';
import { PolishChunkExecutor } from './polish-chunk.executor';

const validation = {
  status: 'PASS' as const,
  summary: { errors: 0, warnings: 0 },
  violations: [],
};

const input = (overrides: Partial<ToolChunkExecutionInput> = {}): ToolChunkExecutionInput => ({
  taskType: 'polish',
  userInstructions: 'Keep terminology stable.',
  options: { polishType: 'academic', language: 'en' },
  chunk: {
    chunkId: 'chunk-000001',
    sourceId: 'document-1',
    section: 'content',
    eligibleForExecution: true,
    text: 'Source text',
    items: [],
    provenance: [],
  },
  ...overrides,
});

describe('PolishChunkExecutor', () => {
  it('executes one eligible content chunk and preserves the legacy output mapping', async () => {
    const generated: PolishOutput = {
      originalContent: 'Source text',
      revisedContent: 'Revised text',
      changes: [{ original: 'Source', revised: 'Revised', reason: 'clarity' }],
      warnings: ['one warning'],
      validation,
      metadata: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        latencyMs: 12,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      },
    };
    const generator = { generate: jest.fn().mockResolvedValue(generated) };
    const executor = new PolishChunkExecutor(generator as unknown as PolishGenerator);

    const result = await executor.execute(input());

    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.generate).toHaveBeenCalledWith({
      text: 'Source text',
      requirements: 'Keep terminology stable.',
      polishType: 'academic',
      language: 'en',
    });
    expect(result).toEqual({
      output: {
        originalContent: 'Source text',
        revisedContent: 'Revised text',
        changes: [{ original: 'Source', revised: 'Revised', reason: 'clarity' }],
        metadata: {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          latencyMs: 12,
        },
      },
      warnings: ['one warning'],
      validation,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
  });

  it('rejects direct non-content or non-eligible calls without invoking the generator', async () => {
    const generator = { generate: jest.fn() };
    const executor = new PolishChunkExecutor(generator as unknown as PolishGenerator);

    await expect(executor.execute(input({
      chunk: {
        ...input().chunk,
        section: 'references',
        eligibleForExecution: false,
      },
    }))).rejects.toThrow('content chunk');

    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('propagates generator failures for the D1 orchestrator to stop', async () => {
    const failure = new Error('generator failed');
    const generator = { generate: jest.fn().mockRejectedValue(failure) };
    const executor = new PolishChunkExecutor(generator as unknown as PolishGenerator);

    await expect(executor.execute(input())).rejects.toBe(failure);
  });
});
