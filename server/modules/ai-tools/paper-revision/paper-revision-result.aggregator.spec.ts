import type {
  AcademicToolExecutionResult,
  AggregatedValidation,
  RenderedToolChunk,
  ToolExecutionChunkRecord,
} from '../execution/tool-execution.types';
import type { InvariantValidationResult } from '../skills/validators/invariant.types';
import { PaperRevisionResultAggregator } from './paper-revision-result.aggregator';

const chunkValidation: InvariantValidationResult = {
  status: 'PASS',
  violations: [],
  summary: { errors: 0, warnings: 0 },
};

const validation: AggregatedValidation = {
  status: 'PASS',
  results: [],
  summary: { errors: 0, warnings: 0 },
};

function item(
  chunkId: string,
  section: 'content' | 'references',
  sourceBlockId: string,
  text: string,
  sourceBlockIndex: number,
): RenderedToolChunk['items'][number] {
  return {
    itemId: `${chunkId}-${sourceBlockId}`,
    kind: 'whole-unit',
    text,
    provenance: {
      chunkId,
      section,
      sourceBlockId,
      sourceBlockIndex,
      headingPath: [],
    },
  };
}

function chunk(
  chunkId: string,
  section: 'content' | 'references',
  items: RenderedToolChunk['items'],
): RenderedToolChunk {
  return {
    chunkId,
    sourceId: 'document-1',
    section,
    eligibleForExecution: section === 'content',
    text: items.map((entry) => entry.text).join(''),
    items,
    provenance: items.map((entry) => entry.provenance),
  };
}

function executed(
  chunkValue: RenderedToolChunk,
  revisedContent: string,
  overrides: Partial<NonNullable<ToolExecutionChunkRecord['result']>> = {},
): ToolExecutionChunkRecord {
  return {
    chunk: chunkValue,
    mode: 'executed',
    provenance: chunkValue.provenance,
    result: {
      output: {
        originalContent: 'forged generator original',
        revisedContent,
        changeSummary: [`summary-${chunkValue.chunkId}`],
        unresolvedIssues: [],
        authorInputNeeded: false,
        metadata: { provider: 'deepseek', model: 'model', latencyMs: 5 },
      },
      warnings: [`chunk warning ${chunkValue.chunkId}`],
      validation: chunkValidation,
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      ...overrides,
    },
  };
}

function passThrough(chunkValue: RenderedToolChunk): ToolExecutionChunkRecord {
  return {
    chunk: chunkValue,
    mode: 'pass-through',
    provenance: chunkValue.provenance,
  };
}

function execution(
  chunks: ToolExecutionChunkRecord[],
  aggregateValidation: AggregatedValidation = validation,
): AcademicToolExecutionResult {
  return {
    version: 1,
    task: { type: 'paper-revision', userInstructions: 'Preserve citations.' },
    source: {
      id: 'document-1',
      kind: 'parsed-document',
      fileName: 'source.txt',
      sourceType: 'txt',
      extension: '.txt',
      sizeBytes: 42,
      metadata: {},
      warnings: [],
    },
    chunks,
    warnings: ['context warning', 'chunk warning chunk-1', 'chunk warning chunk-2'],
    validation: aggregateValidation,
    usage: { promptTokens: 3, completionTokens: 6, totalTokens: 9 },
  };
}

describe('PaperRevisionResultAggregator', () => {
  it('reconstructs trusted original and revised content across source boundaries', () => {
    const chunk1 = chunk('chunk-1', 'content', [
      item('chunk-1', 'content', 'block-a', 'A1', 0),
      item('chunk-1', 'content', 'block-b', 'B1', 1),
    ]);
    const chunk2 = chunk('chunk-2', 'content', [
      item('chunk-2', 'content', 'block-b', 'B2', 1),
    ]);
    const chunk3 = chunk('chunk-3', 'content', [
      item('chunk-3', 'content', 'block-c', 'C', 2),
    ]);
    const refA = chunk('chunk-4', 'references', [
      item('chunk-4', 'references', 'ref-a', 'Ref A', 0),
    ]);
    const refB = chunk('chunk-5', 'references', [
      item('chunk-5', 'references', 'ref-b', 'Ref B', 1),
    ]);

    const result = new PaperRevisionResultAggregator().aggregate(execution([
      executed(chunk1, 'RA\n\nRB1'),
      executed(chunk2, 'RB2'),
      executed(chunk3, 'RC'),
      passThrough(refA),
      passThrough(refB),
    ]));

    expect(result.originalContent).toBe('A1\n\nB1B2\n\nC\n\nRef A\nRef B');
    expect(result.revisedContent).toBe('RA\n\nRB1RB2\n\nRC\n\nRef A\nRef B');
    expect(result.changeSummary).toEqual([
      'summary-chunk-1',
      'summary-chunk-2',
      'summary-chunk-3',
    ]);
    expect(result.warnings).toEqual([
      'context warning',
      'chunk warning chunk-1',
      'chunk warning chunk-2',
    ]);
    expect(result.metadata).toEqual({
      provider: 'deepseek',
      model: 'model',
      usage: { promptTokens: 3, completionTokens: 6, totalTokens: 9 },
      latencyMs: 15,
    });
  });

  it('flattens validation violations and ORs author input requirements', () => {
    const firstViolation = { type: 'citation' as const, severity: 'WARN' as const, message: 'first' };
    const secondViolation = { type: 'doi' as const, severity: 'ERROR' as const, message: 'second' };
    const aggregateValidation: AggregatedValidation = {
      status: 'ERROR',
      results: [
        { chunkId: 'chunk-1', validation: { status: 'WARN', violations: [firstViolation], summary: { errors: 0, warnings: 1 } } },
        { chunkId: 'chunk-2', validation: { status: 'ERROR', violations: [secondViolation], summary: { errors: 1, warnings: 0 } } },
      ],
      summary: { errors: 1, warnings: 1 },
    };
    const first = chunk('chunk-1', 'content', [item('chunk-1', 'content', 'a', 'A', 0)]);
    const second = chunk('chunk-2', 'content', [item('chunk-2', 'content', 'b', 'B', 1)]);

    const result = new PaperRevisionResultAggregator().aggregate(execution([
      executed(first, 'RA', {
        output: {
          originalContent: 'ignored', revisedContent: 'RA', changeSummary: [],
          unresolvedIssues: ['first issue'], authorInputNeeded: false,
          metadata: { provider: 'deepseek', model: 'model', latencyMs: 1 },
        },
      }),
      executed(second, 'RB', {
        output: {
          originalContent: 'ignored', revisedContent: 'RB', changeSummary: [],
          unresolvedIssues: ['second issue'], authorInputNeeded: true,
          metadata: { provider: 'deepseek', model: 'model', latencyMs: 2 },
        },
      }),
    ], aggregateValidation));

    expect(result.unresolvedIssues).toEqual(['first issue', 'second issue']);
    expect(result.authorInputNeeded).toBe(true);
    expect(result.validation).toEqual({
      status: 'ERROR',
      violations: [firstViolation, secondViolation],
      summary: { errors: 1, warnings: 1 },
    });
  });

  it('never uses generator originals or exposes internal provenance', () => {
    const source = chunk('chunk-1', 'content', [item('chunk-1', 'content', 'a', 'Trusted', 0)]);
    const result = new PaperRevisionResultAggregator().aggregate(execution([
      executed(source, 'Revised'),
    ]));

    expect(result.originalContent).toBe('Trusted');
    expect(result.originalContent).not.toContain('forged');
    expect(result).not.toHaveProperty('provenance');
  });

  it('rejects malformed executed output before returning a legacy result', () => {
    const source = chunk('chunk-1', 'content', [item('chunk-1', 'content', 'a', 'A', 0)]);
    const malformed = executed(source, 'RA', {
      output: { revisedContent: 'RA' },
    });

    expect(() => new PaperRevisionResultAggregator().aggregate(execution([malformed])))
      .toThrow('Invalid Paper Revision chunk output');
  });
});
