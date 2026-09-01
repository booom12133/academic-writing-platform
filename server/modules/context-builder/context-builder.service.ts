import { Injectable } from '@nestjs/common';

import { ContextBuilderError } from './context-builder.errors';
import {
  BuildTaskContextInput,
  ContextHeadingRef,
  TaskContext,
} from './context-builder.types';
import {
  DocumentBlock,
  DocumentOutlineEntry,
  DocumentParseWarning,
  DocumentSource,
  DocumentReferenceSection,
  ParsedDocument,
} from '../document-parsing/document-parser.types';

const VALID_TASK_TYPES = new Set<BuildTaskContextInput['taskType']>([
  'polish',
  'paper-revision',
]);

const VALID_BLOCK_TYPES = new Set<DocumentBlock['type']>([
  'heading',
  'paragraph',
  'list-item',
  'table',
  'code',
  'formula',
]);

const VALID_SOURCE_TYPES = new Set<DocumentSource['type']>([
  'docx',
  'pdf',
  'txt',
  'markdown',
]);

const VALID_WARNING_CODES = new Set<DocumentParseWarning['code']>([
  'PDF_LAYOUT_SIMPLIFIED',
  'DOCX_UNSUPPORTED_CONTENT_SKIPPED',
  'TABLE_STRUCTURE_PARTIAL',
  'REFERENCE_SECTION_HEURISTIC',
]);

const SOURCE_TYPE_EXTENSIONS: Record<
  DocumentSource['type'],
  Set<DocumentSource['extension']>
> = {
  docx: new Set(['.docx']),
  pdf: new Set(['.pdf']),
  txt: new Set(['.txt']),
  markdown: new Set(['.md', '.markdown']),
};

@Injectable()
export class ContextBuilderService {
  build(input: BuildTaskContextInput): TaskContext {
    this.validateInput(input);

    const { document } = input;
    const headingStack: ContextHeadingRef[] = [];

    return {
      version: 1,
      task: {
        type: input.taskType,
        userInstructions: input.userInstructions,
      },
      source: {
        id: 'document-1',
        kind: 'parsed-document',
        fileName: document.source.fileName,
        sourceType: document.source.type,
        extension: document.source.extension,
        mimeType: document.source.mimeType,
        sizeBytes: document.source.sizeBytes,
        title: document.title,
        metadata: { ...document.metadata },
        warnings: document.warnings.map((warning) => ({ ...warning })),
      },
      units: document.blocks.map((block, index) => {
        if (block.type === 'heading') {
          while (
            headingStack.length > 0 &&
            headingStack[headingStack.length - 1].level >= block.level
          ) {
            headingStack.pop();
          }

          headingStack.push({
            sourceBlockId: block.id,
            title: block.text,
            level: block.level,
          });
        }

        return {
          id: `document-1:b${String(index + 1).padStart(6, '0')}`,
          sourceId: 'document-1',
          sourceBlockId: block.id,
          sourceBlockIndex: index,
          section: this.isReferenceSectionBlock(index, document.referenceSection)
            ? 'references'
            : 'content',
          headingPath: headingStack.map((heading) => ({ ...heading })),
          block: this.copyBlock(block),
        };
      }),
    };
  }

  private validateInput(input: BuildTaskContextInput): void {
    if (
      !this.isRecord(input) ||
      !VALID_TASK_TYPES.has(input.taskType) ||
      (input.userInstructions !== undefined &&
        typeof input.userInstructions !== 'string')
    ) {
      throw new ContextBuilderError(
        'INVALID_CONTEXT_INPUT',
        'Context builder input is invalid.',
      );
    }

    if (!this.isRecord(input.document)) {
      throw new ContextBuilderError(
        'INVALID_CONTEXT_INPUT',
        'Context builder input is invalid.',
      );
    }

    this.validateParsedDocument(input.document);
  }

  private validateParsedDocument(document: ParsedDocument): void {
    if (
      !this.isValidDocumentSource(document.source) ||
      (document.title !== undefined && typeof document.title !== 'string') ||
      !Array.isArray(document.blocks) ||
      document.blocks.length === 0 ||
      typeof document.plainText !== 'string' ||
      !Array.isArray(document.outline) ||
      !this.isRecord(document.metadata) ||
      !Array.isArray(document.warnings)
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }

    const seenIds = new Set<string>();

    document.blocks.forEach((block) => {
      this.validateBlock(block, seenIds);
      seenIds.add(block.id);
    });

    document.outline.forEach((entry) => {
      this.validateOutlineEntry(document.blocks, entry);
    });

    document.warnings.forEach((warning) => {
      this.validateWarning(warning, seenIds);
    });

    this.validateMetadata(document.metadata);

    if (document.referenceSection !== undefined) {
      if (!this.isRecord(document.referenceSection)) {
        throw new ContextBuilderError(
          'INVALID_PARSED_DOCUMENT',
          'Parsed document is invalid.',
        );
      }

      this.validateReferenceSection(document.blocks, document.referenceSection);
    }
  }

  private validateBlock(
    block: DocumentBlock,
    seenIds: Set<string>,
  ): void {
    if (
      !this.isRecord(block) ||
      typeof block.id !== 'string' ||
      block.id.length === 0 ||
      seenIds.has(block.id) ||
      !VALID_BLOCK_TYPES.has(block.type) ||
      typeof block.text !== 'string' ||
      !this.isValidPageNumber(block.pageNumber)
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }

    switch (block.type) {
      case 'heading':
        if (!Number.isInteger(block.level) || block.level < 1 || block.level > 6) {
          throw new ContextBuilderError(
            'INVALID_PARSED_DOCUMENT',
            'Parsed document is invalid.',
          );
        }
        break;
      case 'list-item':
        if (
          typeof block.ordered !== 'boolean' ||
          !Number.isInteger(block.depth) ||
          block.depth < 0
        ) {
          throw new ContextBuilderError(
            'INVALID_PARSED_DOCUMENT',
            'Parsed document is invalid.',
          );
        }
        break;
      case 'table':
        if (
          !Array.isArray(block.rows) ||
          block.rows.some(
            (row) =>
              !this.isRecord(row) ||
              !Array.isArray(row.cells) ||
              row.cells.some((cell) => typeof cell !== 'string'),
          )
        ) {
          throw new ContextBuilderError(
            'INVALID_PARSED_DOCUMENT',
            'Parsed document is invalid.',
          );
        }
        break;
      case 'code':
        if (
          block.language !== undefined &&
          typeof block.language !== 'string'
        ) {
          throw new ContextBuilderError(
            'INVALID_PARSED_DOCUMENT',
            'Parsed document is invalid.',
          );
        }
        break;
      case 'formula':
        if (typeof block.display !== 'boolean') {
          throw new ContextBuilderError(
            'INVALID_PARSED_DOCUMENT',
            'Parsed document is invalid.',
          );
        }
        break;
      default:
        break;
    }
  }

  private validateOutlineEntry(
    blocks: ParsedDocument['blocks'],
    entry: DocumentOutlineEntry,
  ): void {
    if (
      !this.isRecord(entry) ||
      typeof entry.headingBlockId !== 'string' ||
      entry.headingBlockId.length === 0 ||
      typeof entry.title !== 'string' ||
      !Number.isInteger(entry.level) ||
      entry.level < 1 ||
      entry.level > 6 ||
      !Number.isInteger(entry.startBlockIndex) ||
      !Number.isInteger(entry.endBlockIndexExclusive) ||
      entry.startBlockIndex < 0 ||
      entry.startBlockIndex >= entry.endBlockIndexExclusive ||
      entry.endBlockIndexExclusive > blocks.length
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }

    const headingBlock = blocks[entry.startBlockIndex];
    if (
      headingBlock.type !== 'heading' ||
      headingBlock.id !== entry.headingBlockId ||
      headingBlock.level !== entry.level ||
      headingBlock.text !== entry.title
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }
  }

  private validateWarning(
    warning: DocumentParseWarning,
    blockIds: Set<string>,
  ): void {
    if (
      !this.isRecord(warning) ||
      !VALID_WARNING_CODES.has(warning.code) ||
      typeof warning.message !== 'string' ||
      (warning.blockId !== undefined &&
        (typeof warning.blockId !== 'string' ||
          warning.blockId.length === 0 ||
          !blockIds.has(warning.blockId))) ||
      !this.isValidPageNumber(warning.pageNumber)
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }
  }

  private validateMetadata(metadata: ParsedDocument['metadata']): void {
    if (
      metadata.pageCount !== undefined &&
      (!Number.isInteger(metadata.pageCount) || metadata.pageCount < 0)
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }
  }

  private validateReferenceSection(
    blocks: ParsedDocument['blocks'],
    referenceSection: DocumentReferenceSection,
  ): void {
    const { startBlockIndex, endBlockIndexExclusive, headingBlockId } = referenceSection;
    const isValidRange = Number.isInteger(startBlockIndex) &&
      Number.isInteger(endBlockIndexExclusive) &&
      startBlockIndex >= 0 &&
      startBlockIndex < endBlockIndexExclusive &&
      endBlockIndexExclusive <= blocks.length &&
      typeof headingBlockId === 'string' &&
      headingBlockId.length > 0 &&
      referenceSection.detection === 'explicit-heading';

    if (!isValidRange) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }

    const headingBlock = blocks[startBlockIndex];
    if (
      headingBlock.type !== 'heading' ||
      headingBlock.id !== headingBlockId
    ) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }
  }

  private copyBlock(block: DocumentBlock): DocumentBlock {
    if (block.type !== 'table') {
      return { ...block };
    }

    return {
      ...block,
      rows: block.rows.map((row) => ({
        cells: [...row.cells],
      })),
    };
  }

  private isValidDocumentSource(source: unknown): source is DocumentSource {
    if (
      !this.isRecord(source) ||
      !this.isValidSourceType(source.type) ||
      typeof source.fileName !== 'string' ||
      source.fileName.length === 0 ||
      !this.isValidSourceExtension(source.type, source.extension) ||
      (source.mimeType !== undefined && typeof source.mimeType !== 'string') ||
      !Number.isInteger(source.sizeBytes) ||
      typeof source.sizeBytes !== 'number' ||
      source.sizeBytes < 0
    ) {
      return false;
    }

    return true;
  }

  private isValidSourceType(
    sourceType: unknown,
  ): sourceType is DocumentSource['type'] {
    return typeof sourceType === 'string' && VALID_SOURCE_TYPES.has(sourceType as DocumentSource['type']);
  }

  private isValidSourceExtension(
    sourceType: DocumentSource['type'],
    extension: unknown,
  ): extension is DocumentSource['extension'] {
    return (
      typeof extension === 'string' &&
      SOURCE_TYPE_EXTENSIONS[sourceType].has(extension as DocumentSource['extension'])
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isValidPageNumber(pageNumber: unknown): boolean {
    return (
      pageNumber === undefined ||
      (typeof pageNumber === 'number' &&
        Number.isInteger(pageNumber) &&
        pageNumber >= 1)
    );
  }

  private isReferenceSectionBlock(
    index: number,
    referenceSection: BuildTaskContextInput['document']['referenceSection'],
  ): boolean {
    if (referenceSection === undefined) {
      return false;
    }

    return (
      index >= referenceSection.startBlockIndex &&
      index < referenceSection.endBlockIndexExclusive
    );
  }
}
