import { Injectable } from '@nestjs/common';

import type { ChunkedTaskContext } from '../../chunking/chunking.types';
import { ChunkingService } from '../../chunking/chunking.service';
import { ContextBuilderService } from '../../context-builder/context-builder.service';
import { DocumentInputService } from '../../document-input/document-input.service';
import { DocumentParserService } from '../../document-parsing/document-parser.service';
import type {
  PreparedToolInput,
  ToolPreparationInput,
} from './tool-execution.types';

@Injectable()
export class ToolInputPreparationService {
  constructor(
    private readonly parser: DocumentParserService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly chunker: ChunkingService,
    private readonly documentInput: DocumentInputService,
  ) {}

  async prepare(input: ToolPreparationInput): Promise<PreparedToolInput> {
    if (input.source.mode === 'file') {
      const prepared = await this.documentInput.prepare({
        userId: input.userId,
        documentRef: input.source.documentRef,
        taskType: input.taskType,
        userInstructions: input.userInstructions,
        chunkingPolicy: input.chunkingPolicy,
      });
      return { context: prepared.context, documentRef: prepared.document };
    }

    const document = await this.parser.parse({
      buffer: Buffer.from(input.source.text, 'utf8'),
      fileName: 'pasted-text.txt',
      mimeType: 'text/plain',
    });
    const context = this.contextBuilder.build({
      taskType: input.taskType,
      document,
      userInstructions: input.userInstructions,
    });
    const chunked: ChunkedTaskContext = this.chunker.chunk({
      context,
      policy: input.chunkingPolicy,
    });
    return { context: chunked };
  }
}
