import type {
  ContextHeadingRef,
  ContextUnit,
  TaskContext,
} from '../context-builder/context-builder.types';

export interface ChunkingPolicy {
  maxSize: number;
}

export interface AppliedChunkingPolicy {
  version: 1;
  maxSize: number;
  sizeMetric: 'unicode-code-points';
  overlap: 0;
}

export interface ChunkTaskContextInput {
  context: TaskContext;
  policy: ChunkingPolicy;
}

export interface ChunkSpan {
  start: number;
  endExclusive: number;
}

export interface WholeUnitChunkItem {
  kind: 'whole-unit';
  unit: ContextUnit;
  size: number;
}

export interface TextFragmentChunkItem {
  kind: 'text-fragment';
  sourceUnitId: string;
  sourceBlockId: string;
  sourceBlockIndex: number;
  section: ContextUnit['section'];
  headingPath: ContextHeadingRef[];
  pageNumber?: number;
  blockType: 'paragraph' | 'list-item';
  fragmentId: string;
  text: string;
  span: ChunkSpan;
  size: number;
  ordered?: boolean;
  depth?: number;
}

export type ChunkItem = WholeUnitChunkItem | TextFragmentChunkItem;

export interface Chunk {
  id: string;
  sourceId: 'document-1';
  section: ContextUnit['section'];
  items: ChunkItem[];
  size: number;
}

export type ChunkingWarningCode = 'OVERSIZED_ATOMIC_UNIT' | 'HARD_TEXT_SPLIT';

export interface ChunkingWarning {
  code: ChunkingWarningCode;
  message: string;
  chunkId: string;
  sourceUnitId: string;
  sourceBlockId: string;
  fragmentId?: string;
  size: number;
  maxSize: number;
}

export interface ChunkedTaskContext {
  version: 1;
  task: TaskContext['task'];
  source: TaskContext['source'];
  policy: AppliedChunkingPolicy;
  chunks: Chunk[];
  warnings: ChunkingWarning[];
}
