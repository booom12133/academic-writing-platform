import type { RenderedToolChunk } from '../execution/tool-execution.types';
import {
  joinTrustedSegments,
  renderedChunksToTrustedSegments,
} from './paper-revision-source-boundary';

function chunk(
  chunkId: string,
  section: 'content' | 'references',
  items: Array<{ sourceBlockId: string; text: string }>,
): RenderedToolChunk {
  return {
    chunkId,
    sourceId: 'document-1',
    section,
    eligibleForExecution: section === 'content',
    text: items.map((item) => item.text).join(''),
    items: items.map((item, index) => ({
      itemId: `${chunkId}-item-${index}`,
      kind: 'whole-unit' as const,
      text: item.text,
      provenance: {
        chunkId,
        section,
        sourceBlockId: item.sourceBlockId,
        sourceBlockIndex: index,
        headingPath: [],
      },
    })),
    provenance: items.map((item, index) => ({
      chunkId,
      section,
      sourceBlockId: item.sourceBlockId,
      sourceBlockIndex: index,
      headingPath: [],
    })),
  };
}

describe('paper revision source boundaries', () => {
  it('joins fragments from the same source block without a separator', () => {
    const segments = renderedChunksToTrustedSegments([
      chunk('chunk-1', 'content', [
        { sourceBlockId: 'block-a', text: 'A1' },
        { sourceBlockId: 'block-b', text: 'B1' },
      ]),
      chunk('chunk-2', 'content', [
        { sourceBlockId: 'block-b', text: 'B2' },
      ]),
    ]);

    expect(joinTrustedSegments(segments)).toBe('A1\n\nB1B2');
  });

  it('uses blank lines between content blocks and between content and references', () => {
    const segments = renderedChunksToTrustedSegments([
      chunk('chunk-1', 'content', [{ sourceBlockId: 'block-a', text: 'A' }]),
      chunk('chunk-2', 'content', [{ sourceBlockId: 'block-b', text: 'B' }]),
      chunk('chunk-3', 'references', [{ sourceBlockId: 'ref-a', text: 'Ref A' }]),
    ]);

    expect(joinTrustedSegments(segments)).toBe('A\n\nB\n\nRef A');
  });

  it('uses one newline between distinct reference blocks', () => {
    const segments = renderedChunksToTrustedSegments([
      chunk('chunk-1', 'references', [{ sourceBlockId: 'ref-a', text: 'Ref A' }]),
      chunk('chunk-2', 'references', [{ sourceBlockId: 'ref-b', text: 'Ref B' }]),
    ]);

    expect(joinTrustedSegments(segments)).toBe('Ref A\nRef B');
  });

  it('preserves the required three-content-chunk regression boundary', () => {
    const segments = renderedChunksToTrustedSegments([
      chunk('chunk-1', 'content', [
        { sourceBlockId: 'block-a', text: 'A1' },
        { sourceBlockId: 'block-b', text: 'B1' },
      ]),
      chunk('chunk-2', 'content', [
        { sourceBlockId: 'block-b', text: 'B2' },
      ]),
      chunk('chunk-3', 'content', [{ sourceBlockId: 'block-c', text: 'C' }]),
      chunk('chunk-4', 'references', [{ sourceBlockId: 'ref-a', text: 'Ref A' }]),
      chunk('chunk-5', 'references', [{ sourceBlockId: 'ref-b', text: 'Ref B' }]),
    ]);

    expect(joinTrustedSegments(segments)).toBe('A1\n\nB1B2\n\nC\n\nRef A\nRef B');
  });
});
