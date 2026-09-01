import { Injectable } from '@nestjs/common';

import {
  BuildTaskContextInput,
  ContextHeadingRef,
  TaskContext,
} from './context-builder.types';

@Injectable()
export class ContextBuilderService {
  build(input: BuildTaskContextInput): TaskContext {
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
          block: block.type === 'table'
            ? { ...block, rows: block.rows.map((row) => ({ cells: [...row.cells] })) }
            : { ...block },
        };
      }),
    };
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
