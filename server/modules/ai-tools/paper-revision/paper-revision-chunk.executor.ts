import { Injectable } from '@nestjs/common';

import { PaperRevisionGenerator } from '../generators/paper-revision.generator';
import type {
  ToolChunkExecutionInput,
  ToolChunkExecutionResult,
  ToolChunkExecutor,
} from '../execution/tool-execution.types';

@Injectable()
export class PaperRevisionChunkExecutor implements ToolChunkExecutor {
  constructor(private readonly generator: PaperRevisionGenerator) {}

  async execute(input: ToolChunkExecutionInput): Promise<ToolChunkExecutionResult> {
    if (
      input.chunk.section !== 'content'
      || !input.chunk.eligibleForExecution
    ) {
      throw new Error('PaperRevisionChunkExecutor accepts content chunk execution only');
    }

    const generated = await this.generator.generate({
      text: input.chunk.text,
      ...(input.userInstructions === undefined
        ? {}
        : { requirements: input.userInstructions }),
      ...(Array.isArray(input.options.revisionTypes)
        ? { revisionTypes: input.options.revisionTypes as string[] }
        : {}),
      ...(input.options.language === 'zh' || input.options.language === 'en'
        ? { language: input.options.language }
        : {}),
    });

    return {
      output: {
        originalContent: generated.originalContent,
        revisedContent: generated.revisedContent,
        changeSummary: generated.changeSummary,
        unresolvedIssues: generated.unresolvedIssues,
        authorInputNeeded: generated.authorInputNeeded,
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
