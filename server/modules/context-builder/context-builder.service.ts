import { Injectable } from '@nestjs/common';

import { ContextBuilderError } from './context-builder.errors';
import {
  BuildTaskContextInput,
  ContextHeadingRef,
  TaskContext,
} from './context-builder.types';
import {
  DocumentBlock,
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
    if (!this.isObject(input) || !VALID_TASK_TYPES.has(input.taskType)) {
      throw new ContextBuilderError(
        'INVALID_CONTEXT_INPUT',
        'Context builder input is invalid.',
      );
    }

    if (!this.isParsedDocument(input.document)) {
      throw new ContextBuilderError(
        'INVALID_CONTEXT_INPUT',
        'Context builder input is invalid.',
      );
    }

    this.validateParsedDocument(input.document);
  }

  private isParsedDocument(value: unknown): value is ParsedDocument {
    return this.isObject(value);
  }

  private validateParsedDocument(document: ParsedDocument): void {
    if (!Array.isArray(document.blocks) || document.blocks.length === 0) {
      throw new ContextBuilderError(
        'INVALID_PARSED_DOCUMENT',
        'Parsed document is invalid.',
      );
    }

    const seenIds = new Set<string>();

    document.blocks.forEach((block) => {
      if (
        !this.isObject(block) ||
        typeof block.id !== 'string' ||
        block.id.length === 0 ||
        seenIds.has(block.id) ||
        !VALID_BLOCK_TYPES.has(block.type) ||
        typeof block.text !== 'string'
      ) {
        throw new ContextBuilderError(
          'INVALID_PARSED_DOCUMENT',
          'Parsed document is invalid.',
        );
      }

      seenIds.add(block.id);
    });

    if (document.referenceSection !== undefined) {
      this.validateReferenceSection(document.blocks, document.referenceSection);
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
      endBlockIndexExclusive <= blocks.length;

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

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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
