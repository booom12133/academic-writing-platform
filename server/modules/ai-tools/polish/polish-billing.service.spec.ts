import type { ChunkedTaskContext } from '../../chunking/chunking.types';
import type { RenderedToolChunk } from '../execution/tool-execution.types';
import { AcademicToolExecutionService } from '../execution/academic-tool-execution.service';
import { PolishBillingService } from './polish-billing.service';

const rendered = (overrides: Partial<RenderedToolChunk>): RenderedToolChunk => ({
  chunkId: 'chunk-000001',
  sourceId: 'document-1',
  section: 'content',
  eligibleForExecution: true,
  text: '',
  items: [],
  provenance: [],
  ...overrides,
});

const item = (itemId: string, text: string, section: 'content' | 'references', sourceBlockId: string) => ({
  itemId,
  kind: 'whole-unit' as const,
  text,
  provenance: {
    chunkId: `chunk-${itemId}`,
    section,
    sourceBlockId,
    sourceBlockIndex: Number(itemId.replace(/\D/g, '')) || 0,
    headingPath: [],
  },
});

describe('PolishBillingService', () => {
  it('reconstructs authoritative billing source with trusted D1 boundaries', () => {
    const chunks = [
      rendered({
        chunkId: 'chunk-000001',
        items: [item('c1', 'A1', 'content', 'block-a')],
      }),
      rendered({
        chunkId: 'chunk-000002',
        items: [item('c2', 'A2', 'content', 'block-a')],
      }),
      rendered({
        chunkId: 'chunk-000003',
        items: [item('c3', 'B', 'content', 'block-b')],
      }),
      rendered({
        chunkId: 'chunk-000004',
        section: 'references',
        eligibleForExecution: false,
        items: [item('r1', 'R1', 'references', 'ref-a')],
      }),
      rendered({
        chunkId: 'chunk-000005',
        section: 'references',
        eligibleForExecution: false,
        items: [item('r2', 'R2', 'references', 'ref-b')],
      }),
    ];
    const execution = {
      render: jest.fn().mockReturnValue(chunks),
    } as unknown as AcademicToolExecutionService;
    const service = new PolishBillingService(execution);

    const result = service.calculate({} as ChunkedTaskContext);

    expect(result.billingText).toBe('A1A2\n\nB\n\nR1\nR2');
    expect(result.charCount).toBe(result.billingText.length);
    expect(result.pointsCost).toBe(10);
    expect(execution.render).toHaveBeenCalledTimes(1);
  });

  it('preserves the current UTF-16 code-unit price metric', () => {
    const source = '😀'.repeat(501);
    const execution = {
      render: jest.fn().mockReturnValue([
        rendered({
          text: source,
          items: [item('c1', source, 'content', 'block-a')],
        }),
      ]),
    } as unknown as AcademicToolExecutionService;
    const service = new PolishBillingService(execution);

    const result = service.calculate({} as ChunkedTaskContext);

    expect(result.charCount).toBe(source.length);
    expect(result.charCount).toBe(1002);
    expect(result.pointsCost).toBe(30);
  });

  it('uses the minimum ten points for a nonempty prepared source below 500 units', () => {
    const execution = {
      render: jest.fn().mockReturnValue([
        rendered({
          text: 'short source',
          items: [item('c1', 'short source', 'content', 'block-a')],
        }),
      ]),
    } as unknown as AcademicToolExecutionService;
    const service = new PolishBillingService(execution);

    expect(service.calculate({} as ChunkedTaskContext)).toEqual({
      billingText: 'short source',
      charCount: 12,
      pointsCost: 10,
    });
  });
});
