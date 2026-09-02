import type { AcademicToolExecutionResult, RenderedToolChunk, ToolExecutionChunkRecord } from '../execution/tool-execution.types';
import { PolishResultAggregator } from './polish-result.aggregator';

const validation = {
  status: 'PASS' as const,
  violations: [],
  summary: { errors: 0, warnings: 0 },
  results: [],
};

function chunk(
  chunkId: string,
  section: 'content' | 'references',
  sourceBlockId: string,
  text: string,
): RenderedToolChunk {
  return {
    chunkId,
    sourceId: 'document-1',
    section,
    eligibleForExecution: section === 'content',
    text,
    items: [{
      itemId: `${chunkId}-item`,
      kind: 'whole-unit',
      text,
      provenance: {
        chunkId,
        section,
        sourceBlockId,
        sourceBlockIndex: Number(chunkId.slice(-1)),
        headingPath: [],
      },
    }],
    provenance: [{
      chunkId,
      section,
      sourceBlockId,
      sourceBlockIndex: Number(chunkId.slice(-1)),
      headingPath: [],
    }],
  };
}

function contentRecord(
  chunkValue: RenderedToolChunk,
  revisedContent: string,
  originalContent: string,
): ToolExecutionChunkRecord {
  return {
    chunk: chunkValue,
    mode: 'executed',
    provenance: chunkValue.provenance,
    result: {
      output: {
        originalContent,
        revisedContent,
        changes: [{ original: chunkValue.text, revised: revisedContent, reason: 'clarity' }],
        metadata: {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          latencyMs: 5,
        },
      },
      warnings: [`warning-${chunkValue.chunkId}`],
      validation,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    },
  };
}

function referenceRecord(chunkValue: RenderedToolChunk): ToolExecutionChunkRecord {
  return {
    chunk: chunkValue,
    mode: 'pass-through',
    provenance: chunkValue.provenance,
  };
}

function execution(records: ToolExecutionChunkRecord[]): AcademicToolExecutionResult {
  return {
    version: 1,
    task: { type: 'polish', userInstructions: 'Keep terminology stable.' },
    source: {
      id: 'document-1',
      kind: 'parsed-document',
      extension: '.txt',
      sizeBytes: 42,
      metadata: {},
      sourceType: 'txt',
      fileName: 'source.txt',
      warnings: [],
    },
    chunks: records,
    warnings: [
      'context warning',
      ...records.flatMap((record) => record.result?.warnings ?? []),
    ],
    validation,
    usage: { promptTokens: 30, completionTokens: 60, totalTokens: 90 },
  };
}

describe('PolishResultAggregator', () => {
  it('reconstructs trusted source and revised output with deterministic cross-chunk boundaries', () => {
    const records = [
      contentRecord(chunk('chunk-1', 'content', 'block-a', 'A1'), 'R1', 'FORGED-1'),
      contentRecord(chunk('chunk-2', 'content', 'block-a', 'A2'), 'R2', 'FORGED-2'),
      contentRecord(chunk('chunk-3', 'content', 'block-b', 'B'), 'RB', 'FORGED-3'),
      referenceRecord(chunk('chunk-4', 'references', 'ref-a', 'Ref A')),
      referenceRecord(chunk('chunk-5', 'references', 'ref-b', 'Ref B')),
    ];
    const aggregator = new PolishResultAggregator();

    const result = aggregator.aggregate(execution(records));

    expect(result.originalContent).toBe('A1A2\n\nB\n\nRef A\nRef B');
    expect(result.revisedContent).toBe('R1R2\n\nRB\n\nRef A\nRef B');
    expect(result.changes).toHaveLength(3);
    expect(result.warnings).toEqual(['context warning', 'warning-chunk-1', 'warning-chunk-2', 'warning-chunk-3']);
    expect(result.validation).toBe(validation);
    expect(result.metadata).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 30, completionTokens: 60, totalTokens: 90 },
      latencyMs: 15,
    });
  });

  it('never uses a chunk generator original as the global original content', () => {
    const record = contentRecord(chunk('chunk-1', 'content', 'block-a', 'Trusted source'), 'Revised', 'forged');
    const aggregator = new PolishResultAggregator();

    const result = aggregator.aggregate(execution([record]));

    expect(result.originalContent).toBe('Trusted source');
    expect(result.originalContent).not.toContain('forged');
  });

  it('does not add provenance or invoke side effects while aggregating', () => {
    const record = contentRecord(chunk('chunk-1', 'content', 'block-a', 'Source'), 'Revised', 'ignored');
    const result = new PolishResultAggregator().aggregate(execution([record]));

    expect(result).not.toHaveProperty('provenance');
    expect(result.metadata.usage).toEqual({
      promptTokens: 30,
      completionTokens: 60,
      totalTokens: 90,
    });
  });
});
