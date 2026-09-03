import type { PaperRevisionOutput } from '../generators/paper-revision.generator';
import type {
  AcademicToolExecutionResult,
  ToolExecutionChunkRecord,
} from '../execution/tool-execution.types';
import {
  joinTrustedSegments,
  renderedChunksToTrustedSegments,
  type TrustedTextSegment,
} from './paper-revision-source-boundary';

interface PaperRevisionChunkOutput {
  originalContent: string;
  revisedContent: string;
  changeSummary: string[];
  unresolvedIssues: string[];
  authorInputNeeded: boolean;
  metadata: {
    provider: string;
    model: string;
    latencyMs: number;
  };
}

export class PaperRevisionResultAggregator {
  aggregate(execution: AcademicToolExecutionResult): PaperRevisionOutput {
    const originalSegments = execution.chunks.flatMap((record) =>
      renderedChunksToTrustedSegments([record.chunk]),
    );
    const revisedSegments: TrustedTextSegment[] = [];
    const changeSummary: string[] = [];
    const unresolvedIssues: string[] = [];
    const metadata: PaperRevisionChunkOutput['metadata'][] = [];
    let authorInputNeeded = false;

    for (const record of execution.chunks) {
      if (record.mode === 'pass-through') {
        revisedSegments.push(...renderedChunksToTrustedSegments([record.chunk]));
        continue;
      }

      const output = this.readOutput(record);
      const provenance = record.provenance.length > 0
        ? record.provenance
        : record.chunk.provenance;
      const first = provenance[0];
      const last = provenance[provenance.length - 1];
      revisedSegments.push({
        section: record.chunk.section,
        firstSourceBlockId: first?.sourceBlockId ?? record.chunk.chunkId,
        lastSourceBlockId: last?.sourceBlockId ?? record.chunk.chunkId,
        text: output.revisedContent,
      });
      changeSummary.push(...output.changeSummary);
      unresolvedIssues.push(...output.unresolvedIssues);
      authorInputNeeded ||= output.authorInputNeeded;
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
      changeSummary,
      unresolvedIssues,
      authorInputNeeded,
      warnings: [...execution.warnings],
      validation: {
        status: execution.validation.status,
        violations: execution.validation.results.flatMap(
          (item) => item.validation.violations,
        ),
        summary: execution.validation.summary,
      },
      metadata: {
        provider: firstMetadata.provider,
        model: firstMetadata.model,
        usage: execution.usage,
        latencyMs: metadata.reduce((total, item) => total + item.latencyMs, 0),
      },
    };
  }

  private readOutput(record: ToolExecutionChunkRecord): PaperRevisionChunkOutput {
    const output = record.result?.output as Partial<PaperRevisionChunkOutput> | undefined;
    if (
      !output
      || typeof output.originalContent !== 'string'
      || typeof output.revisedContent !== 'string'
      || !Array.isArray(output.changeSummary)
      || !output.changeSummary.every((item) => typeof item === 'string')
      || !Array.isArray(output.unresolvedIssues)
      || !output.unresolvedIssues.every((item) => typeof item === 'string')
      || typeof output.authorInputNeeded !== 'boolean'
      || !output.metadata
      || typeof output.metadata.provider !== 'string'
      || output.metadata.provider.trim().length === 0
      || typeof output.metadata.model !== 'string'
      || output.metadata.model.trim().length === 0
      || typeof output.metadata.latencyMs !== 'number'
    ) {
      throw new Error(`Invalid Paper Revision chunk output for ${record.chunk.chunkId}`);
    }
    return output as PaperRevisionChunkOutput;
  }
}
