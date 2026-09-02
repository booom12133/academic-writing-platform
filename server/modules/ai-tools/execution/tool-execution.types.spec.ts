import type {
  AcademicToolExecutionResult,
  PreparedToolInput,
  ToolChunkExecutionResult,
  ToolPreparationInput,
} from './tool-execution.types';
import { TOOL_EXECUTION_CONTRACT_VERSION } from './tool-execution.types';

describe('tool execution contracts', () => {
  it('represents prepared input and executor output without trusting executor provenance', () => {
    const preparation: ToolPreparationInput = {
      userId: 'user-1',
      taskType: 'polish',
      userInstructions: 'Keep the wording concise.',
      chunkingPolicy: { maxSize: 100 },
      source: { mode: 'text', text: 'A source sentence.' },
    };
    const prepared: PreparedToolInput = {
      context: {
        version: 1,
        task: { type: 'polish', userInstructions: preparation.userInstructions },
        source: {
          id: 'document-1',
          kind: 'parsed-document',
          fileName: 'pasted-text.txt',
          sourceType: 'txt',
          extension: '.txt',
          mimeType: 'text/plain',
          sizeBytes: 18,
          metadata: {},
          warnings: [],
        },
        policy: { version: 1, maxSize: 100, sizeMetric: 'unicode-code-points', overlap: 0 },
        chunks: [],
        warnings: [],
      },
    };
    const executorOutput: ToolChunkExecutionResult = {
      output: { revisedContent: 'A concise source sentence.' },
      warnings: ['model warning'],
      usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    };
    const aggregate: AcademicToolExecutionResult = {
      version: 1,
      task: prepared.context.task,
      source: prepared.context.source,
      chunks: [],
      warnings: executorOutput.warnings,
      validation: { status: 'PASS', results: [], summary: { errors: 0, warnings: 0 } },
      usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    };

    expect(preparation.source.mode).toBe('text');
    expect(prepared.context.task.userInstructions).toBe('Keep the wording concise.');
    expect(executorOutput).not.toHaveProperty('provenance');
    expect(aggregate.usage.totalTokens).toBe(18);
    expect(TOOL_EXECUTION_CONTRACT_VERSION).toBe(1);
  });
});
