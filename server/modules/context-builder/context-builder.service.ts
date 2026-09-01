import { Injectable } from '@nestjs/common';

import {
  BuildTaskContextInput,
  TaskContext,
} from './context-builder.types';

@Injectable()
export class ContextBuilderService {
  build(input: BuildTaskContextInput): TaskContext {
    const { document } = input;

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
      units: document.blocks.map((block, index) => ({
        id: `document-1:b${String(index + 1).padStart(6, '0')}`,
        sourceId: 'document-1',
        sourceBlockId: block.id,
        sourceBlockIndex: index,
        section: 'content',
        headingPath: [],
        block: block.type === 'table'
          ? { ...block, rows: block.rows.map((row) => ({ cells: [...row.cells] })) }
          : { ...block },
      })),
    };
  }
}
