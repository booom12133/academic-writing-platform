import { computeChunkTextHash } from './knowledge.hash';
import {
  finalizeKnowledgeChunkDraft,
  mapStructuralChunksToKnowledgeChunkDrafts,
  validateCitationLocator,
} from './knowledge.provenance';
import type { Chunk } from '../chunking/chunking.types';

const unit = {
  id: 'document-1:b000001',
  sourceId: 'document-1' as const,
  sourceBlockId: 'b000001',
  sourceBlockIndex: 0,
  section: 'content' as const,
  headingPath: [{ sourceBlockId: 'b000001', title: 'Intro', level: 1 as const }],
  block: { id: 'b000001', type: 'paragraph' as const, text: 'Whole' },
};

const chunks: Chunk[] = [
  {
    id: 'document-1:c000001',
    sourceId: 'document-1',
    section: 'content',
    size: 9,
    items: [
      { kind: 'whole-unit', unit, size: 5 },
      {
        kind: 'text-fragment',
        sourceUnitId: 'document-1:b000002',
        sourceBlockId: 'b000002',
        sourceBlockIndex: 1,
        section: 'content',
        headingPath: [],
        blockType: 'paragraph',
        fragmentId: 'document-1:b000002:f000001',
        text: '😀x',
        span: { start: 0, endExclusive: 2 },
        size: 2,
        pageNumber: 3,
      },
    ],
  },
  {
    id: 'document-1:c000002',
    sourceId: 'document-1',
    section: 'references',
    size: 3,
    items: [
      {
        kind: 'text-fragment',
        sourceUnitId: 'document-1:b000003',
        sourceBlockId: 'b000003',
        sourceBlockIndex: 2,
        section: 'references',
        headingPath: [],
        blockType: 'list-item',
        fragmentId: 'document-1:b000003:f000001',
        text: 'Ref',
        span: { start: 4, endExclusive: 7 },
        size: 3,
        ordered: false,
        depth: 0,
      },
    ],
  },
];

describe('knowledge provenance mapping', () => {
  it('flattens each C3 item with complete structural provenance', () => {
    const drafts = mapStructuralChunksToKnowledgeChunkDrafts({
      userId: 'user-1',
      sourceRecordId: 'source-1',
      documentId: 'document-1',
      documentVersionId: 'version-1',
      chunks,
    });

    expect(drafts).toHaveLength(3);
    expect(drafts.map((draft) => draft.ordinal)).toEqual([0, 1, 2]);
    expect(drafts[0]).toMatchObject({
      userId: 'user-1',
      documentVersionId: 'version-1',
      text: 'Whole',
      textHash: computeChunkTextHash('Whole'),
      provenance: {
        sourceRecordId: 'source-1',
        documentId: 'document-1',
        documentVersionId: 'version-1',
        sourceBlockId: 'b000001',
        sourceBlockIndex: 0,
        sourceChunkOrdinal: 0,
        itemOrdinal: 0,
      },
    });
    expect(drafts[1]).toMatchObject({
      text: '😀x',
      provenance: {
        pageStart: 3,
        pageEnd: 3,
        fragmentSpan: { start: 0, endExclusive: 2 },
        sourceChunkOrdinal: 0,
        itemOrdinal: 1,
      },
    });
    expect(drafts[2].provenance).toHaveProperty('sourceRecordId', 'source-1');
    expect(drafts.every((draft) => !Object.prototype.hasOwnProperty.call(draft.citationLocator, 'chunkId'))).toBe(true);
  });

  it('finalizes a draft with a durable chunk ID and locator back-reference', () => {
    const [draft] = mapStructuralChunksToKnowledgeChunkDrafts({
      userId: 'user-1',
      documentId: 'document-1',
      documentVersionId: 'version-1',
      chunks: [chunks[0]],
    });
    const result = finalizeKnowledgeChunkDraft({ draft, chunkId: 'chunk-1' });

    expect(result.id).toBe('chunk-1');
    expect(result.citationLocator.chunkId).toBe('chunk-1');
  });

  it('rejects invalid fragment spans and mismatched C3 order', () => {
    const invalidChunk = {
      ...chunks[0],
      id: 'document-1:c000002',
      items: [{
        ...chunks[0].items[1],
        span: { start: 0, endExclusive: 99 },
      }],
    } as Chunk;
    expect(() =>
      mapStructuralChunksToKnowledgeChunkDrafts({
        userId: 'user-1',
        documentId: 'document-1',
        documentVersionId: 'version-1',
        chunks: [invalidChunk],
      }),
    ).toThrow(/span|order/i);
  });

  it('requires document version and chunk IDs in citation locators', () => {
    expect(() => validateCitationLocator({
      documentVersionId: '',
      chunkId: 'chunk-1',
    })).toThrow();
    expect(() => validateCitationLocator({
      documentVersionId: 'version-1',
      chunkId: '',
    })).toThrow();
  });
});
