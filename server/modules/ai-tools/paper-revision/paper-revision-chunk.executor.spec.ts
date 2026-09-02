import type { PaperRevisionGenerator, PaperRevisionOutput } from '../generators/paper-revision.generator';
import type { ToolChunkExecutionInput } from '../execution/tool-execution.types';
import { PaperRevisionChunkExecutor } from './paper-revision-chunk.executor';

const validation = {
  status: 'PASS' as const,
  summary: { errors: 0, warnings: 0 },
  violations: [],
};

const input = (overrides: Partial<ToolChunkExecutionInput> = {}): ToolChunkExecutionInput => ({
  taskType: 'paper-revision',
  userInstructions: 'Preserve citations.',
  options: { revisionTypes: ['logic', 'discussion'], language: 'en' },
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

describe('PaperRevisionChunkExecutor', () => {
  it('passes requirements and open revision types to the frozen generator', async () => {
    const generated: PaperRevisionOutput = {
      originalContent: 'Source text',
      revisedContent: 'Revised text',
      changeSummary: ['Improved logic'],
      unresolvedIssues: [],
      authorInputNeeded: false,
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
    const executor = new PaperRevisionChunkExecutor(
      generator as unknown as PaperRevisionGenerator,
    );

    const result = await executor.execute(input());

    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.generate).toHaveBeenCalledWith({
      text: 'Source text',
      requirements: 'Preserve citations.',
      revisionTypes: ['logic', 'discussion'],
      language: 'en',
    });
    expect(result).toEqual({
      output: {
        originalContent: 'Source text',
        revisedContent: 'Revised text',
        changeSummary: ['Improved logic'],
        unresolvedIssues: [],
        authorInputNeeded: false,
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
    expect((generator.generate.mock.calls[0][0] as Record<string, unknown>).requirements)
      .toBe('Preserve citations.');
  });

  it('does not copy requirements into options when they are absent', async () => {
    const generated = {
      originalContent: 'Source text',
      revisedContent: 'Revised text',
      changeSummary: [],
      unresolvedIssues: [],
      authorInputNeeded: false,
      warnings: [],
      validation,
      metadata: { provider: 'deepseek' as const, model: 'model', latencyMs: 0 },
    };
    const generator = { generate: jest.fn().mockResolvedValue(generated) };
    const executor = new PaperRevisionChunkExecutor(
      generator as unknown as PaperRevisionGenerator,
    );

    await executor.execute(input({ userInstructions: undefined, options: {} }));

    expect(generator.generate).toHaveBeenCalledWith({ text: 'Source text' });
  });

  it('rejects Reference and ineligible chunks without invoking the generator', async () => {
    const generator = { generate: jest.fn() };
    const executor = new PaperRevisionChunkExecutor(
      generator as unknown as PaperRevisionGenerator,
    );

    await expect(executor.execute(input({
      chunk: { ...input().chunk, section: 'references', eligibleForExecution: false },
    }))).rejects.toThrow('content chunk');

    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('propagates generator failures', async () => {
    const failure = new Error('generator failed');
    const generator = { generate: jest.fn().mockRejectedValue(failure) };
    const executor = new PaperRevisionChunkExecutor(
      generator as unknown as PaperRevisionGenerator,
    );

    await expect(executor.execute(input())).rejects.toBe(failure);
  });
});
