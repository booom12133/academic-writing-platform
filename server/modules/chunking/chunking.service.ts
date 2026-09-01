import { Injectable } from '@nestjs/common';

import type {
  ContextDocumentSource,
  ContextHeadingRef,
  ContextUnit,
  TaskContext,
} from '../context-builder/context-builder.types';
import type {
  DocumentBlock,
  DocumentParseWarning,
} from '../document-parsing/document-parser.types';
import { ChunkingError } from './chunking.errors';
import type {
  AppliedChunkingPolicy,
  Chunk,
  ChunkItem,
  ChunkTaskContextInput,
  ChunkingPolicy,
  ChunkingWarning,
  TextFragmentChunkItem,
  WholeUnitChunkItem,
  ChunkedTaskContext,
} from './chunking.types';

const VALID_TASK_TYPES = new Set(['polish', 'paper-revision']);
const VALID_SOURCE_TYPES = new Set(['docx', 'pdf', 'txt', 'markdown']);
const VALID_SECTIONS = new Set(['content', 'references']);
const VALID_BLOCK_TYPES = new Set([
  'heading',
  'paragraph',
  'list-item',
  'table',
  'code',
  'formula',
]);
const VALID_WARNING_CODES = new Set([
  'PDF_LAYOUT_SIMPLIFIED',
  'DOCX_UNSUPPORTED_CONTENT_SKIPPED',
  'TABLE_STRUCTURE_PARTIAL',
  'REFERENCE_SECTION_HEURISTIC',
]);
const SOURCE_TYPE_EXTENSIONS: Record<string, Set<string>> = {
  docx: new Set(['.docx']),
  pdf: new Set(['.pdf']),
  txt: new Set(['.txt']),
  markdown: new Set(['.md', '.markdown']),
};
const ATOMIC_BLOCK_TYPES = new Set(['heading', 'table', 'code', 'formula']);
const SENTENCE_TERMINALS = new Set(['.', '!', '?', '。', '！', '？']);

interface MutableChunk {
  id: string;
  section: ContextUnit['section'];
  items: ChunkItem[];
  size: number;
}

interface FragmentEnd {
  end: number;
  hard: boolean;
}

@Injectable()
export class ChunkingService {
  chunk(input: ChunkTaskContextInput): ChunkedTaskContext {
    this.validateInput(input);

    const { context, policy } = input;
    const chunks: Chunk[] = [];
    const warnings: ChunkingWarning[] = [];
    let current: MutableChunk | undefined;
    let chunkIndex = 0;

    const nextChunkId = (): string =>
      `document-1:c${String(++chunkIndex).padStart(6, '0')}`;

    const flush = (): void => {
      if (!current || current.items.length === 0) return;
      chunks.push({
        id: current.id,
        sourceId: 'document-1',
        section: current.section,
        items: current.items,
        size: current.size,
      });
      current = undefined;
    };

    const ensureChunk = (section: ContextUnit['section']): MutableChunk => {
      if (!current) {
        current = { id: nextChunkId(), section, items: [], size: 0 };
      }
      return current;
    };

    context.units.forEach((unit, index) => {
      if (current && current.section !== unit.section) flush();

      const size = this.measureBlock(unit.block);
      if (ATOMIC_BLOCK_TYPES.has(unit.block.type) && size > policy.maxSize) {
        flush();
        const item = this.wholeUnitItem(unit, size);
        const chunkId = nextChunkId();
        chunks.push({
          id: chunkId,
          sourceId: 'document-1',
          section: unit.section,
          items: [item],
          size,
        });
        warnings.push({
          code: 'OVERSIZED_ATOMIC_UNIT',
          message: 'Atomic unit exceeded maxSize and was kept intact.',
          chunkId,
          sourceUnitId: unit.id,
          sourceBlockId: unit.sourceBlockId,
          size,
          maxSize: policy.maxSize,
        });
        return;
      }

      if (unit.block.type === 'paragraph' || unit.block.type === 'list-item') {
        if (size > policy.maxSize) {
          this.appendFragments(
            unit,
            policy.maxSize,
            ensureChunk,
            flush,
            warnings,
          );
          return;
        }
      }

      if (
        unit.block.type === 'heading' &&
        this.shouldSoftBreakBeforeHeading(
          context.units,
          index,
          current,
          policy.maxSize,
        )
      ) {
        flush();
      }

      const chunk = ensureChunk(unit.section);
      if (chunk.size > 0 && chunk.size + size > policy.maxSize) {
        flush();
      }
      const destination = ensureChunk(unit.section);
      destination.items.push(this.wholeUnitItem(unit, size));
      destination.size += size;
    });

    flush();

    return {
      version: 1,
      task: {
        type: context.task.type,
        ...(context.task.userInstructions === undefined
          ? {}
          : { userInstructions: context.task.userInstructions }),
      },
      source: {
        ...context.source,
        metadata: { ...context.source.metadata },
        warnings: context.source.warnings.map((warning) => ({ ...warning })),
      },
      policy: {
        version: 1,
        maxSize: policy.maxSize,
        sizeMetric: 'unicode-code-points',
        overlap: 0,
      },
      chunks,
      warnings,
    };
  }

  private appendFragments(
    unit: ContextUnit,
    maxSize: number,
    ensureChunk: (section: ContextUnit['section']) => MutableChunk,
    flush: () => void,
    warnings: ChunkingWarning[],
  ): void {
    if (unit.block.type !== 'paragraph' && unit.block.type !== 'list-item')
      return;

    const codePoints = Array.from(unit.block.text);
    let start = 0;
    let fragmentIndex = 0;

    while (start < codePoints.length) {
      let chunk = ensureChunk(unit.section);
      let available = maxSize - chunk.size;
      if (available <= 0) {
        flush();
        chunk = ensureChunk(unit.section);
        available = maxSize;
      }

      const end = this.chooseFragmentEnd(codePoints, start, available);
      const text = codePoints.slice(start, end.end).join('');
      const fragmentId = `${unit.id}:f${String(++fragmentIndex).padStart(6, '0')}`;
      const item: TextFragmentChunkItem = {
        kind: 'text-fragment',
        sourceUnitId: unit.id,
        sourceBlockId: unit.sourceBlockId,
        sourceBlockIndex: unit.sourceBlockIndex,
        section: unit.section,
        headingPath: unit.headingPath.map((heading) => ({ ...heading })),
        pageNumber: unit.block.pageNumber,
        blockType: unit.block.type,
        fragmentId,
        text,
        span: { start, endExclusive: end.end },
        size: end.end - start,
        ...(unit.block.type === 'list-item'
          ? { ordered: unit.block.ordered, depth: unit.block.depth }
          : {}),
      };
      chunk.items.push(item);
      chunk.size += item.size;

      if (end.hard && end.end < codePoints.length) {
        const chunkId = chunk.id;
        warnings.push({
          code: 'HARD_TEXT_SPLIT',
          message: 'Text required a hard Unicode-code-point split.',
          chunkId,
          sourceUnitId: unit.id,
          sourceBlockId: unit.sourceBlockId,
          fragmentId,
          size: item.size,
          maxSize,
        });
      }

      start = end.end;
    }
  }

  private chooseFragmentEnd(
    codePoints: string[],
    start: number,
    available: number,
  ): FragmentEnd {
    const limit = Math.min(start + available, codePoints.length);
    let newlineEnd = 0;
    let sentenceEnd = 0;
    let whitespaceEnd = 0;

    for (let index = start; index < limit; index += 1) {
      const point = codePoints[index];
      if (point === '\n') newlineEnd = index + 1;
      if (SENTENCE_TERMINALS.has(point)) sentenceEnd = index + 1;
      if (/\s/u.test(point)) whitespaceEnd = index + 1;
    }

    if (newlineEnd > start) return { end: newlineEnd, hard: false };
    if (sentenceEnd > start) return { end: sentenceEnd, hard: false };
    if (whitespaceEnd > start) return { end: whitespaceEnd, hard: false };
    return { end: limit, hard: limit < codePoints.length };
  }

  private shouldSoftBreakBeforeHeading(
    units: ContextUnit[],
    index: number,
    current: MutableChunk | undefined,
    maxSize: number,
  ): boolean {
    const unit = units[index];
    const next = units[index + 1];
    if (
      !current ||
      current.items.length === 0 ||
      unit.block.type !== 'heading' ||
      !next
    ) {
      return false;
    }
    if (next.section !== unit.section) return false;

    const headingSize = this.measureBlock(unit.block);
    const nextSize = this.measureBlock(next.block);
    return (
      headingSize <= maxSize &&
      nextSize <= maxSize &&
      current.size + headingSize <= maxSize &&
      headingSize + nextSize <= maxSize &&
      current.size + headingSize + nextSize > maxSize
    );
  }

  private wholeUnitItem(unit: ContextUnit, size: number): WholeUnitChunkItem {
    return {
      kind: 'whole-unit',
      unit: this.copyUnit(unit),
      size,
    };
  }

  private copyUnit(unit: ContextUnit): ContextUnit {
    return {
      ...unit,
      headingPath: unit.headingPath.map((heading) => ({ ...heading })),
      block: this.copyBlock(unit.block),
    };
  }

  private copyBlock(block: DocumentBlock): DocumentBlock {
    if (block.type !== 'table') return { ...block };
    return {
      ...block,
      rows: block.rows.map((row) => ({ cells: [...row.cells] })),
    };
  }

  private measureBlock(block: DocumentBlock): number {
    return Array.from(block.text).length;
  }

  private validateInput(
    input: unknown,
  ): asserts input is ChunkTaskContextInput {
    if (
      !this.isRecord(input) ||
      !this.isRecord(input.context) ||
      !this.isRecord(input.policy)
    ) {
      throw new ChunkingError(
        'INVALID_CHUNKING_INPUT',
        'Chunking input is invalid.',
      );
    }
    this.validatePolicy(input.policy);
    this.validateTaskContext(input.context);
  }

  private validatePolicy(policy: unknown): asserts policy is ChunkingPolicy {
    if (!this.isRecord(policy) || !this.isPositiveSafeInteger(policy.maxSize)) {
      throw new ChunkingError(
        'INVALID_CHUNKING_POLICY',
        'Chunking policy is invalid.',
      );
    }
  }

  private validateTaskContext(
    context: unknown,
  ): asserts context is TaskContext {
    if (!this.isRecord(context)) this.invalidTaskContext();
    const task = context.task;
    const source = context.source;
    const units = context.units;
    if (
      context.version !== 1 ||
      !this.isRecord(task) ||
      !VALID_TASK_TYPES.has(task.type as string) ||
      (task.userInstructions !== undefined &&
        typeof task.userInstructions !== 'string') ||
      !this.isValidSource(source) ||
      !Array.isArray(units) ||
      units.length === 0
    ) {
      throw new ChunkingError(
        'INVALID_TASK_CONTEXT',
        'Task context is invalid.',
      );
    }

    const seenUnitIds = new Set<string>();
    const seenBlockIds = new Set<string>();
    units.forEach((unit, index) => {
      if (!this.isRecord(unit)) this.invalidTaskContext();
      const headingPath = unit.headingPath;
      if (
        typeof unit.id !== 'string' ||
        unit.id.length === 0 ||
        seenUnitIds.has(unit.id) ||
        unit.sourceId !== 'document-1' ||
        typeof unit.sourceBlockId !== 'string' ||
        unit.sourceBlockId.length === 0 ||
        seenBlockIds.has(unit.sourceBlockId) ||
        unit.sourceBlockIndex !== index ||
        !VALID_SECTIONS.has(unit.section as string) ||
        !Array.isArray(headingPath) ||
        !this.isValidBlock(unit.block, unit.sourceBlockId)
      ) {
        this.invalidTaskContext();
      }
      headingPath.forEach((heading) => {
        if (!this.isValidHeadingRef(heading)) this.invalidTaskContext();
      });
      seenUnitIds.add(unit.id);
      seenBlockIds.add(unit.sourceBlockId);
    });

    source.warnings.forEach((warning) => {
      if (!this.isValidWarning(warning, seenBlockIds))
        this.invalidTaskContext();
    });
  }

  private invalidTaskContext(): never {
    throw new ChunkingError('INVALID_TASK_CONTEXT', 'Task context is invalid.');
  }

  private isValidSource(source: unknown): source is ContextDocumentSource {
    if (!this.isRecord(source)) return false;
    const sourceType = source.sourceType;
    const extension = source.extension;
    const metadata = source.metadata;
    if (!this.isRecord(metadata)) return false;

    return (
      source.id === 'document-1' &&
      source.kind === 'parsed-document' &&
      VALID_SOURCE_TYPES.has(sourceType as string) &&
      typeof source.fileName === 'string' &&
      source.fileName.length > 0 &&
      typeof extension === 'string' &&
      SOURCE_TYPE_EXTENSIONS[sourceType as string]?.has(extension) === true &&
      (source.mimeType === undefined || typeof source.mimeType === 'string') &&
      this.isNonNegativeSafeInteger(source.sizeBytes) &&
      (source.title === undefined || typeof source.title === 'string') &&
      (metadata.pageCount === undefined ||
        this.isNonNegativeSafeInteger(metadata.pageCount)) &&
      Array.isArray(source.warnings)
    );
  }

  private isValidBlock(
    block: unknown,
    sourceBlockId: string,
  ): block is DocumentBlock {
    if (
      !this.isRecord(block) ||
      block.id !== sourceBlockId ||
      typeof block.text !== 'string' ||
      !VALID_BLOCK_TYPES.has(block.type as string) ||
      !this.isValidPage(block.pageNumber)
    ) {
      return false;
    }
    switch (block.type) {
      case 'heading':
        return this.isSafeIntegerInRange(block.level, 1, 6);
      case 'list-item':
        return (
          typeof block.ordered === 'boolean' &&
          this.isNonNegativeSafeInteger(block.depth)
        );
      case 'table':
        return (
          Array.isArray(block.rows) &&
          block.rows.every(
            (row) =>
              this.isRecord(row) &&
              Array.isArray(row.cells) &&
              row.cells.every((cell) => typeof cell === 'string'),
          )
        );
      case 'code':
        return (
          block.language === undefined || typeof block.language === 'string'
        );
      case 'formula':
        return typeof block.display === 'boolean';
      default:
        return true;
    }
  }

  private isValidHeadingRef(heading: unknown): heading is ContextHeadingRef {
    return (
      this.isRecord(heading) &&
      typeof heading.sourceBlockId === 'string' &&
      heading.sourceBlockId.length > 0 &&
      typeof heading.title === 'string' &&
      this.isSafeIntegerInRange(heading.level, 1, 6)
    );
  }

  private isValidWarning(
    warning: unknown,
    blockIds: Set<string>,
  ): warning is DocumentParseWarning {
    return (
      this.isRecord(warning) &&
      VALID_WARNING_CODES.has(warning.code as string) &&
      typeof warning.message === 'string' &&
      this.isValidPage(warning.pageNumber) &&
      (warning.blockId === undefined ||
        (typeof warning.blockId === 'string' && blockIds.has(warning.blockId)))
    );
  }

  private isValidPage(pageNumber: unknown): boolean {
    return (
      pageNumber === undefined ||
      (this.isNonNegativeSafeInteger(pageNumber) && pageNumber >= 1)
    );
  }

  private isPositiveSafeInteger(value: unknown): value is number {
    return this.isNonNegativeSafeInteger(value) && value > 0;
  }

  private isNonNegativeSafeInteger(value: unknown): value is number {
    return (
      typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
  }

  private isSafeIntegerInRange(
    value: unknown,
    min: number,
    max: number,
  ): value is number {
    return (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
