import type { ChunkedTaskContext } from '../../chunking/chunking.types';
import type {
  ToolChunkExecutionResult,
  ToolChunkExecutor,
} from './tool-execution.types';
import { AcademicToolExecutionService } from './academic-tool-execution.service';

const context: ChunkedTaskContext = {
  version: 1,
  task: { type: 'polish', userInstructions: 'Preserve citations.' },
  source: {
    id: 'document-1',
    kind: 'parsed-document',
    fileName: 'pasted-text.txt',
    sourceType: 'txt',
    extension: '.txt',
    mimeType: 'text/plain',
    sizeBytes: 35,
    metadata: {},
    warnings: [
      {
        code: 'REFERENCE_SECTION_HEURISTIC',
        message: 'Reference heading inferred.',
      },
    ],
  },
  policy: {
    version: 1,
    maxSize: 100,
    sizeMetric: 'unicode-code-points',
    overlap: 0,
  },
  warnings: [
    {
      code: 'OVERSIZED_ATOMIC_UNIT',
      message: 'Atomic unit retained.',
      chunkId: 'document-1:c000001',
      sourceUnitId: 'unit-1',
      sourceBlockId: 'block-1',
      size: 14,
      maxSize: 100,
    },
  ],
  chunks: [
    {
      id: 'document-1:c000001',
      sourceId: 'document-1',
      section: 'content',
      size: 14,
      items: [
        {
          kind: 'whole-unit',
          size: 14,
          unit: {
            id: 'unit-1',
            sourceId: 'document-1',
            sourceBlockId: 'block-1',
            sourceBlockIndex: 0,
            section: 'content',
            headingPath: [
              { sourceBlockId: 'heading-1', title: 'Introduction', level: 1 },
            ],
            block: {
              id: 'block-1',
              type: 'paragraph',
              text: 'Content sentence.',
            },
          },
        },
      ],
    },
    {
      id: 'document-1:c000002',
      sourceId: 'document-1',
      section: 'references',
      size: 19,
      items: [
        {
          kind: 'text-fragment',
          sourceUnitId: 'unit-2',
          sourceBlockId: 'block-2',
          sourceBlockIndex: 1,
          section: 'references',
          headingPath: [],
          blockType: 'paragraph',
          fragmentId: 'unit-2:f000001',
          text: '[1] Reference entry.',
          span: { start: 0, endExclusive: 19 },
          size: 19,
        },
      ],
    },
  ],
};

describe('AcademicToolExecutionService', () => {
  it('renders chunks deterministically and derives provenance from chunk items', () => {
    const service = new AcademicToolExecutionService();

    expect(service.render(context)).toEqual([
      {
        chunkId: 'document-1:c000001',
        sourceId: 'document-1',
        section: 'content',
        eligibleForExecution: true,
        text: 'Content sentence.',
        items: [
          {
            itemId: 'unit-1',
            kind: 'whole-unit',
            text: 'Content sentence.',
            provenance: {
              chunkId: 'document-1:c000001',
              section: 'content',
              sourceBlockId: 'block-1',
              sourceBlockIndex: 0,
              headingPath: [
                { sourceBlockId: 'heading-1', title: 'Introduction', level: 1 },
              ],
            },
          },
        ],
        provenance: [
          {
            chunkId: 'document-1:c000001',
            section: 'content',
            sourceBlockId: 'block-1',
            sourceBlockIndex: 0,
            headingPath: [
              { sourceBlockId: 'heading-1', title: 'Introduction', level: 1 },
            ],
          },
        ],
      },
      {
        chunkId: 'document-1:c000002',
        sourceId: 'document-1',
        section: 'references',
        eligibleForExecution: false,
        text: '[1] Reference entry.',
        items: [
          {
            itemId: 'unit-2:f000001',
            kind: 'text-fragment',
            text: '[1] Reference entry.',
            provenance: {
              chunkId: 'document-1:c000002',
              section: 'references',
              sourceBlockId: 'block-2',
              sourceBlockIndex: 1,
              fragmentId: 'unit-2:f000001',
              span: { start: 0, endExclusive: 19 },
              headingPath: [],
            },
          },
        ],
        provenance: [
          {
            chunkId: 'document-1:c000002',
            section: 'references',
            sourceBlockId: 'block-2',
            sourceBlockIndex: 1,
            fragmentId: 'unit-2:f000001',
            span: { start: 0, endExclusive: 19 },
            headingPath: [],
          },
        ],
      },
    ]);
  });

  it('executes content sequentially, passes references through, and aggregates diagnostics and usage', async () => {
    const service = new AcademicToolExecutionService();
    const calls: string[] = [];
    const executor: ToolChunkExecutor = {
      execute: jest.fn(async (input): Promise<ToolChunkExecutionResult> => {
        calls.push(input.chunk.chunkId);
        expect(input.taskType).toBe('polish');
        expect(input.userInstructions).toBe('Preserve citations.');
        return {
          output: { revisedContent: `Revised ${input.chunk.text}` },
          warnings: ['content warning'],
          validation: {
            status: 'WARN',
            violations: [],
            summary: { errors: 0, warnings: 1 },
          },
          usage: { promptTokens: 4, completionTokens: 3, totalTokens: 7 },
        };
      }),
    };

    const result = await service.execute(context, executor, { preserve: true });

    expect(calls).toEqual(['document-1:c000001']);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ options: { preserve: true } }),
    );
    expect(result.chunks[0]).toMatchObject({
      mode: 'executed',
      result: { output: { revisedContent: 'Revised Content sentence.' } },
    });
    expect(result.chunks[1]).toMatchObject({
      mode: 'pass-through',
      chunk: { text: '[1] Reference entry.' },
    });
    expect(result.task.userInstructions).toBe('Preserve citations.');
    expect(result.warnings).toEqual([
      'REFERENCE_SECTION_HEURISTIC: Reference heading inferred.',
      'OVERSIZED_ATOMIC_UNIT: Atomic unit retained.',
      'content warning',
    ]);
    expect(result.validation).toMatchObject({
      status: 'WARN',
      summary: { errors: 0, warnings: 1 },
    });
    expect(result.usage).toEqual({
      promptTokens: 4,
      completionTokens: 3,
      totalTokens: 7,
    });
  });

  it('drops executor-supplied provenance before storing the chunk result', async () => {
    const service = new AcademicToolExecutionService();
    const executor: ToolChunkExecutor = {
      execute: jest.fn().mockResolvedValue({
        output: { revisedContent: 'Revised content.' },
        provenance: [{ sourceBlockId: 'untrusted-block' }],
      } as ToolChunkExecutionResult & { provenance: unknown }),
    };

    const result = await service.execute(context, executor);

    expect(result.chunks[0].result).toEqual({
      output: { revisedContent: 'Revised content.' },
    });
    expect(result.chunks[0].result).not.toHaveProperty('provenance');
  });

  it('keeps fragmented reference text contiguous and separates reference units deterministically', () => {
    const service = new AcademicToolExecutionService();
    const referenceChunk = context.chunks[1];
    const referenceContext: ChunkedTaskContext = {
      ...context,
      chunks: [
        {
          ...referenceChunk,
          items: [
            {
              kind: 'text-fragment',
              sourceUnitId: 'unit-2',
              sourceBlockId: 'block-2',
              sourceBlockIndex: 1,
              section: 'references',
              headingPath: [],
              blockType: 'paragraph',
              fragmentId: 'unit-2:f000001',
              text: '[1] Reference entry',
              span: { start: 0, endExclusive: 20 },
              size: 20,
            },
            {
              kind: 'text-fragment',
              sourceUnitId: 'unit-2',
              sourceBlockId: 'block-2',
              sourceBlockIndex: 1,
              section: 'references',
              headingPath: [],
              blockType: 'paragraph',
              fragmentId: 'unit-2:f000002',
              text: ' continued.',
              span: { start: 20, endExclusive: 31 },
              size: 11,
            },
            {
              kind: 'whole-unit',
              size: 22,
              unit: {
                id: 'unit-3',
                sourceId: 'document-1',
                sourceBlockId: 'block-3',
                sourceBlockIndex: 2,
                section: 'references',
                headingPath: [],
                block: {
                  id: 'block-3',
                  type: 'paragraph',
                  text: '[2] Another reference.',
                },
              },
            },
          ],
        },
      ],
    };

    const [rendered] = service.render(referenceContext);

    expect(rendered.text).toBe(
      '[1] Reference entry continued.\n[2] Another reference.',
    );
    expect(rendered.items.map((item) => item.text)).toEqual([
      '[1] Reference entry',
      ' continued.',
      '[2] Another reference.',
    ]);
  });
});
