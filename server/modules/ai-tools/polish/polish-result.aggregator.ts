import type { PolishOutput } from '../generators/polish.generator';
import type {
  AcademicToolExecutionResult,
  ToolExecutionChunkRecord,
} from '../execution/tool-execution.types';
import {
  joinTrustedSegments,
  renderedChunksToTrustedSegments,
  type TrustedTextSegment,
} from './polish-source-boundary';
import type { PolishChunkOutput } from './polish-input.types';

export class PolishResultAggregator {
  aggregate(execution: AcademicToolExecutionResult): PolishOutput {
    const originalSegments = execution.chunks.flatMap((record) =>
      renderedChunksToTrustedSegments([record.chunk]),
    );
    const revisedSegments: TrustedTextSegment[] = [];
    const changes: PolishOutput['changes'] = [];
    const metadata: Array<PolishChunkOutput['metadata']> = [];

    for (const record of execution.chunks) {
      if (record.mode === 'pass-through') {
        revisedSegments.push(
          ...renderedChunksToTrustedSegments([record.chunk]),
        );
        continue;
      }

      const output = this.readOutput(record);
      const firstProvenance = record.provenance[0] ?? record.chunk.provenance[0];
      revisedSegments.push({
        section: record.chunk.section,
        sourceBlockId: firstProvenance?.sourceBlockId ?? record.chunk.chunkId,
        text: output.revisedContent,
      });
      changes.push(...output.changes);
      metadata.push(output.metadata);
    }

    const firstMetadata = metadata[0] ?? {
      provider: 'deepseek' as const,
      model: 'deepseek-v4-flash',
      latencyMs: 0,
    };

    return {
      originalContent: joinTrustedSegments(originalSegments),
      revisedContent: joinTrustedSegments(revisedSegments),
      changes,
      warnings: [...execution.warnings],
      validation: execution.validation as unknown as PolishOutput['validation'],
      metadata: {
        provider: firstMetadata.provider,
        model: firstMetadata.model,
        usage: execution.usage,
        latencyMs: metadata.reduce((total, item) => total + item.latencyMs, 0),
      },
    };
  }

  private readOutput(record: ToolExecutionChunkRecord): PolishChunkOutput {
    const output = record.result?.output as Partial<PolishChunkOutput> | undefined;
    if (
      !output ||
      typeof output.originalContent !== 'string' ||
      typeof output.revisedContent !== 'string' ||
      !Array.isArray(output.changes) ||
      !output.metadata ||
      output.metadata.provider !== 'deepseek' ||
      typeof output.metadata.model !== 'string' ||
      typeof output.metadata.latencyMs !== 'number'
    ) {
      throw new Error(`Invalid Polish chunk output for ${record.chunk.chunkId}`);
    }
    return output as PolishChunkOutput;
  }
}
