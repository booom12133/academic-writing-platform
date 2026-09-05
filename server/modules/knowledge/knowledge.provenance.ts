import type { Chunk, ChunkItem } from '../chunking/chunking.types';
import { KnowledgeError } from './knowledge.errors';
import { computeChunkTextHash } from './knowledge.hash';
import type {
  CitationLocator,
  KnowledgeChunk,
  KnowledgeChunkDraft,
  KnowledgeChunkProvenance,
} from './knowledge.types';

function invalid(message: string): never {
  throw new KnowledgeError('INVALID_PROVENANCE', message);
}

function validatePageRange(pageStart?: number, pageEnd?: number): void {
  if (pageStart === undefined && pageEnd === undefined) return;
  if (
    !Number.isSafeInteger(pageStart) ||
    !Number.isSafeInteger(pageEnd) ||
    pageStart < 1 ||
    pageEnd < pageStart
  ) {
    invalid('Page locator is invalid.');
  }
}

function validateSpan(span?: { start: number; endExclusive: number }): void {
  if (span === undefined) return;
  if (
    !Number.isSafeInteger(span.start) ||
    !Number.isSafeInteger(span.endExclusive) ||
    span.start < 0 ||
    span.endExclusive <= span.start
  ) {
    invalid('Fragment span is invalid.');
  }
}

export function validateCitationLocator(locator: CitationLocator): void {
  if (!locator || typeof locator.documentVersionId !== 'string' || !locator.documentVersionId) {
    invalid('Citation locator requires a document version.');
  }
  if (typeof locator.chunkId !== 'string' || !locator.chunkId) {
    invalid('Citation locator requires a chunk.');
  }
  validatePageRange(locator.pageStart, locator.pageEnd);
  validateSpan(locator.fragmentSpan);
}

function mapItem(
  item: ChunkItem,
  chunk: Chunk,
  chunkOrdinal: number,
  itemOrdinal: number,
  input: { userId: string; sourceRecordId?: string; documentId: string; documentVersionId: string },
): KnowledgeChunkDraft {
  let text: string;
  let sourceUnitId: string;
  let sourceBlockId: string;
  let sourceBlockIndex: number;
  let section: 'content' | 'references';
  let headingPath: KnowledgeChunkProvenance['headingPath'];
  let pageStart: number | undefined;
  let pageEnd: number | undefined;
  let fragmentSpan: { start: number; endExclusive: number } | undefined;

  if (item.kind === 'whole-unit') {
    text = item.unit.block.text;
    sourceUnitId = item.unit.id;
    sourceBlockId = item.unit.sourceBlockId;
    sourceBlockIndex = item.unit.sourceBlockIndex;
    section = item.unit.section;
    headingPath = item.unit.headingPath.map((heading) => ({ ...heading }));
    pageStart = item.unit.block.pageNumber;
    pageEnd = item.unit.block.pageNumber;
  } else {
    text = item.text;
    sourceUnitId = item.sourceUnitId;
    sourceBlockId = item.sourceBlockId;
    sourceBlockIndex = item.sourceBlockIndex;
    section = item.section;
    headingPath = item.headingPath.map((heading) => ({ ...heading }));
    pageStart = item.pageNumber;
    pageEnd = item.pageNumber;
    fragmentSpan = { ...item.span };
    validateSpan(fragmentSpan);
    if (Array.from(text).length !== fragmentSpan.endExclusive - fragmentSpan.start) {
      invalid('Fragment text does not match its Unicode span.');
    }
  }

  if (chunk.section !== section || !sourceUnitId || !sourceBlockId || sourceBlockIndex < 0) {
    invalid('Chunk item structural provenance is invalid.');
  }
  validatePageRange(pageStart, pageEnd);

  const provenance: KnowledgeChunkProvenance = {
    ...(input.sourceRecordId === undefined ? {} : { sourceRecordId: input.sourceRecordId }),
    documentId: input.documentId,
    documentVersionId: input.documentVersionId,
    sourceBlockId,
    sourceBlockIndex,
    section,
    headingPath,
    ...(pageStart === undefined ? {} : { pageStart, pageEnd }),
    sourceUnitId,
    sourceChunkOrdinal: chunkOrdinal,
    itemOrdinal,
    ...(fragmentSpan === undefined ? {} : { fragmentSpan }),
  };
  const citationLocator: Omit<CitationLocator, 'chunkId'> = {
    documentVersionId: input.documentVersionId,
    ...(input.sourceRecordId === undefined ? {} : { sourceRecordId: input.sourceRecordId }),
    section,
    headingPath,
    ...(pageStart === undefined ? {} : { pageStart, pageEnd }),
    sourceBlockId,
    sourceBlockIndex,
    ...(fragmentSpan === undefined ? {} : { fragmentSpan }),
  };
  return {
    userId: input.userId,
    documentVersionId: input.documentVersionId,
    ordinal: 0,
    text,
    textHash: computeChunkTextHash(text),
    provenance,
    citationLocator,
  };
}

export function mapStructuralChunksToKnowledgeChunkDrafts(input: {
  userId: string;
  sourceRecordId?: string;
  documentId: string;
  documentVersionId: string;
  chunks: Chunk[];
}): KnowledgeChunkDraft[] {
  if (!input.userId || !input.documentId || !input.documentVersionId || !Array.isArray(input.chunks)) {
    invalid('User, document, version, and chunks are required.');
  }
  const drafts: KnowledgeChunkDraft[] = [];
  input.chunks.forEach((chunk, chunkOrdinal) => {
    const expectedId = `document-1:c${String(chunkOrdinal + 1).padStart(6, '0')}`;
    if (chunk.id !== expectedId || chunk.sourceId !== 'document-1' || !Array.isArray(chunk.items)) {
      invalid('C3 chunk order is invalid.');
    }
    chunk.items.forEach((item, itemOrdinal) => {
      const draft = mapItem(item, chunk, chunkOrdinal, itemOrdinal, input);
      drafts.push({ ...draft, ordinal: drafts.length });
    });
  });
  return drafts;
}

export function finalizeKnowledgeChunkDraft(input: {
  draft: KnowledgeChunkDraft;
  chunkId: string;
}): KnowledgeChunk {
  if (!input.chunkId) invalid('A durable chunk ID is required.');
  const citationLocator = { ...input.draft.citationLocator, chunkId: input.chunkId };
  validateCitationLocator(citationLocator);
  return { ...input.draft, id: input.chunkId, citationLocator };
}
