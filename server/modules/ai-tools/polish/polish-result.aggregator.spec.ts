import type { AcademicToolExecutionResult, RenderedToolChunk, ToolExecutionChunkRecord } from '../execution/tool-execution.types';
import type { InvariantValidationResult } from '../skills/validators/invariant.types';
import { PolishResultAggregator } from './polish-result.aggregator';

const chunkValidation: InvariantValidationResult = {
  status: 'PASS' as const,
  violations: [],
  summary: { errors: 0, warnings: 0 },
};

const aggregatedValidation = {
  status: 'PASS' as const,
  results: [] as Array<{ chunkId: string; validation: InvariantValidationResult }>,
  summary: { errors: 0, warnings: 0 },
};

function renderedItem(
  chunkId: string,
  itemId: string,
  sourceBlockId: string,
  text: string,
  sourceBlockIndex: number,
): RenderedToolChunk['items'][number] {
  return {
    itemId,
    kind: 'whole-unit',
    text,
    provenance: {
      chunkId,
      section: 'content',
      sourceBlockId,
      sourceBlockIndex,
      headingPath: [],
    },
  };
}

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

function chunkWithItems(
  chunkId: string,
  section: 'content' | 'references',
  items: RenderedToolChunk['items'],
): RenderedToolChunk {
  return {
    chunkId,
    sourceId: 'document-1',
    section,
    eligibleForExecution: section === 'content',
    text: items.map((item) => item.text).join(''),
    items,
    provenance: items.map((item) => item.provenance),
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
      validation: chunkValidation,
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

function execution(
  records: ToolExecutionChunkRecord[],
  validation = aggregatedValidation,
): AcademicToolExecutionResult {
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
      contentRecord(
        chunkWithItems('chunk-1', 'content', [
          renderedItem('chunk-1', 'chunk-1-a', 'block-a', 'A1', 0),
          renderedItem('chunk-1', 'chunk-1-b', 'block-b', 'B1', 1),
        ]),
        'RA\n\nRB1',
        'FORGED-1',
      ),
      contentRecord(chunk('chunk-2', 'content', 'block-b', 'B2'), 'RB2', 'FORGED-2'),
      contentRecord(chunk('chunk-3', 'content', 'block-c', 'C'), 'RC', 'FORGED-3'),
      referenceRecord(chunk('chunk-4', 'references', 'ref-a', 'Ref A')),
      referenceRecord(chunk('chunk-5', 'references', 'ref-b', 'Ref B')),
    ];
    const aggregator = new PolishResultAggregator();

    const result = aggregator.aggregate(execution(records));

    expect(result.originalContent).toBe('A1\n\nB1B2\n\nC\n\nRef A\nRef B');
    expect(result.revisedContent).toBe('RA\n\nRB1RB2\n\nRC\n\nRef A\nRef B');
    expect(result.changes).toHaveLength(3);
    expect(result.warnings).toEqual(['context warning', 'warning-chunk-1', 'warning-chunk-2', 'warning-chunk-3']);
    expect(result.validation).toEqual({
      status: 'PASS',
      violations: [],
      summary: { errors: 0, warnings: 0 },
    });
    expect(result.metadata).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 30, completionTokens: 60, totalTokens: 90 },
      latencyMs: 15,
    });
  });

  it('restores the legacy validation contract from real D1 aggregated validation', () => {
    const firstViolation = {
      type: 'citation' as const,
      severity: 'WARN' as const,
      message: 'first chunk warning',
    };
    const secondViolation = {
      type: 'doi' as const,
      severity: 'ERROR' as const,
      message: 'second chunk error',
    };
    const validation = {
      status: 'ERROR' as const,
      results: [
        {
          chunkId: 'chunk-1',
          validation: {
            status: 'WARN' as const,
            violations: [firstViolation],
            summary: { errors: 0, warnings: 1 },
          },
        },
        {
          chunkId: 'chunk-2',
          validation: {
            status: 'ERROR' as const,
            violations: [secondViolation],
            summary: { errors: 1, warnings: 0 },
          },
        },
      ],
      summary: { errors: 1, warnings: 1 },
    };
    const records = [
      contentRecord(chunk('chunk-1', 'content', 'block-a', 'A'), 'RA', 'ignored'),
      contentRecord(chunk('chunk-2', 'content', 'block-b', 'B'), 'RB', 'ignored'),
    ];

    const result = new PolishResultAggregator().aggregate(execution(records, validation));

    expect(result.validation).toEqual({
      status: 'ERROR',
      violations: [firstViolation, secondViolation],
      summary: { errors: 1, warnings: 1 },
    });
    expect(Object.keys(result.validation).sort()).toEqual([
      'status',
      'summary',
      'violations',
    ]);
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
