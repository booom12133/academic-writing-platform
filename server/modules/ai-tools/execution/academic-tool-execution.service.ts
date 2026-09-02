import { Injectable } from '@nestjs/common';

import type {
  ChunkedTaskContext,
  TextFragmentChunkItem,
  WholeUnitChunkItem,
} from '../../chunking/chunking.types';
import type {
  AcademicToolExecutionResult,
  AggregatedValidation,
  RenderableChunkItem,
  RenderedToolChunk,
  ToolChunkExecutionResult,
  ToolChunkExecutor,
  ToolChunkProvenance,
  ToolExecutionChunkRecord,
} from './tool-execution.types';
import { TOOL_EXECUTION_CONTRACT_VERSION } from './tool-execution.types';

@Injectable()
export class AcademicToolExecutionService {
  render(context: ChunkedTaskContext): RenderedToolChunk[] {
    return context.chunks.map((chunk) => {
      const items = chunk.items.map((item) => this.renderItem(chunk.id, item));
      return {
        chunkId: chunk.id,
        sourceId: chunk.sourceId,
        section: chunk.section,
        eligibleForExecution: chunk.section === 'content',
        text: items
          .map((item) => item.text)
          .join(chunk.section === 'references' ? '' : '\n'),
        items,
        provenance: items.map((item) => item.provenance),
      };
    });
  }

  async execute(
    context: ChunkedTaskContext,
    executor: ToolChunkExecutor,
    options: Record<string, unknown> = {},
  ): Promise<AcademicToolExecutionResult> {
    const renderedChunks = this.render(context);
    const records: ToolExecutionChunkRecord[] = [];
    const warnings: string[] = [
      ...context.source.warnings.map(
        (warning) => `${warning.code}: ${warning.message}`,
      ),
      ...context.warnings.map(
        (warning) => `${warning.code}: ${warning.message}`,
      ),
    ];
    const validationResults: AggregatedValidation['results'] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (const chunk of renderedChunks) {
      if (!chunk.eligibleForExecution) {
        records.push({
          chunk,
          mode: 'pass-through',
          provenance: chunk.provenance,
        });
        continue;
      }

      const result = await executor.execute({
        taskType: context.task.type,
        userInstructions: context.task.userInstructions,
        options,
        chunk,
      });
      records.push({
        chunk,
        mode: 'executed',
        provenance: chunk.provenance,
        result,
      });
      this.collectResult(
        result,
        chunk.chunkId,
        warnings,
        validationResults,
        (usage) => {
          promptTokens += usage.promptTokens ?? 0;
          completionTokens += usage.completionTokens ?? 0;
          totalTokens += usage.totalTokens ?? 0;
        },
      );
    }

    const validation = this.aggregateValidation(validationResults);
    return {
      version: TOOL_EXECUTION_CONTRACT_VERSION,
      task: context.task,
      source: context.source,
      chunks: records,
      warnings,
      validation,
      usage: { promptTokens, completionTokens, totalTokens },
    };
  }

  private renderItem(chunkId: string, item: RenderableChunkItem) {
    const provenance = this.provenanceForItem(chunkId, item);
    if (item.kind === 'whole-unit') {
      return {
        itemId: item.unit.id,
        kind: item.kind,
        text: item.unit.block.text,
        provenance,
      };
    }
    return {
      itemId: item.fragmentId,
      kind: item.kind,
      text: item.text,
      provenance,
    };
  }

  private provenanceForItem(
    chunkId: string,
    item: RenderableChunkItem,
  ): ToolChunkProvenance {
    if (item.kind === 'whole-unit') {
      return this.provenanceForWholeUnit(chunkId, item);
    }
    return this.provenanceForFragment(chunkId, item);
  }

  private provenanceForWholeUnit(
    chunkId: string,
    item: WholeUnitChunkItem,
  ): ToolChunkProvenance {
    return {
      chunkId,
      section: item.unit.section,
      sourceBlockId: item.unit.sourceBlockId,
      sourceBlockIndex: item.unit.sourceBlockIndex,
      headingPath: item.unit.headingPath.map((heading) => ({ ...heading })),
      ...(item.unit.block.pageNumber === undefined
        ? {}
        : { pageNumber: item.unit.block.pageNumber }),
    };
  }

  private provenanceForFragment(
    chunkId: string,
    item: TextFragmentChunkItem,
  ): ToolChunkProvenance {
    return {
      chunkId,
      section: item.section,
      sourceBlockId: item.sourceBlockId,
      sourceBlockIndex: item.sourceBlockIndex,
      fragmentId: item.fragmentId,
      span: { ...item.span },
      headingPath: item.headingPath.map((heading) => ({ ...heading })),
      ...(item.pageNumber === undefined ? {} : { pageNumber: item.pageNumber }),
    };
  }

  private collectResult(
    result: ToolChunkExecutionResult,
    chunkId: string,
    warnings: string[],
    validationResults: AggregatedValidation['results'],
    addUsage: (usage: NonNullable<ToolChunkExecutionResult['usage']>) => void,
  ): void {
    warnings.push(...(result.warnings ?? []));
    if (result.validation)
      validationResults.push({ chunkId, validation: result.validation });
    if (result.usage) addUsage(result.usage);
  }

  private aggregateValidation(
    results: AggregatedValidation['results'],
  ): AggregatedValidation {
    const errors = results.reduce(
      (sum, item) => sum + item.validation.summary.errors,
      0,
    );
    const warnings = results.reduce(
      (sum, item) => sum + item.validation.summary.warnings,
      0,
    );
    return {
      status: errors > 0 ? 'ERROR' : warnings > 0 ? 'WARN' : 'PASS',
      results,
      summary: { errors, warnings },
    };
  }
}
