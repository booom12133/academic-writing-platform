import { Injectable } from '@nestjs/common';

import { PolishGenerator } from '../generators/polish.generator';
import type {
  ToolChunkExecutionInput,
  ToolChunkExecutionResult,
  ToolChunkExecutor,
} from '../execution/tool-execution.types';

@Injectable()
export class PolishChunkExecutor implements ToolChunkExecutor {
  constructor(private readonly generator: PolishGenerator) {}

  async execute(input: ToolChunkExecutionInput): Promise<ToolChunkExecutionResult> {
    if (
      input.chunk.section !== 'content' ||
      !input.chunk.eligibleForExecution
    ) {
      throw new Error('PolishChunkExecutor accepts content chunk execution only');
    }

    const generated = await this.generator.generate({
      text: input.chunk.text,
      ...(input.userInstructions === undefined
        ? {}
        : { requirements: input.userInstructions }),
      ...(typeof input.options.polishType === 'string'
        ? { polishType: input.options.polishType }
        : {}),
      ...(input.options.language === 'zh' || input.options.language === 'en'
        ? { language: input.options.language }
        : {}),
    });

    return {
      output: {
        originalContent: generated.originalContent,
        revisedContent: generated.revisedContent,
        changes: generated.changes,
        metadata: {
          provider: generated.metadata.provider,
          model: generated.metadata.model,
          latencyMs: generated.metadata.latencyMs,
        },
      },
      warnings: generated.warnings,
      validation: generated.validation,
      ...(generated.metadata.usage === undefined
        ? {}
        : { usage: generated.metadata.usage }),
    };
  }
}
