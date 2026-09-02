import type {
  ChunkedTaskContext,
  ChunkingPolicy,
} from '../../chunking/chunking.types';
import type { ContextTaskType } from '../../context-builder/context-builder.types';
import type { DocumentInputRef } from '@shared/document-input.interface';
import type {
  DocumentInputService,
  PreparedDocument,
} from '../../document-input/document-input.service';
import type { DocumentParserService } from '../../document-parsing/document-parser.service';
import type { ContextBuilderService } from '../../context-builder/context-builder.service';
import type { ChunkingService } from '../../chunking/chunking.service';
import { ChunkingService as RealChunkingService } from '../../chunking/chunking.service';
import { ContextBuilderService as RealContextBuilderService } from '../../context-builder/context-builder.service';
import { DocumentParserService as RealDocumentParserService } from '../../document-parsing/document-parser.service';
import { TxtParser } from '../../document-parsing/parsers/txt.parser';

import { ToolInputPreparationService } from './tool-input-preparation.service';
import type { ToolPreparationInput } from './tool-execution.types';

const policy: ChunkingPolicy = { maxSize: 100 };
const textContext = {
  chunks: [{ id: 'text-chunk' }],
} as unknown as ChunkedTaskContext;
const fileContext = {
  chunks: [{ id: 'file-chunk' }],
} as unknown as ChunkedTaskContext;
const documentRef = {
  version: 1,
  provider: 'self-hosted-filesystem',
  bucketId: 'documents',
  filePath: 'academic-writing/users/user/file.txt',
  fileName: 'file.txt',
  sourceType: 'txt',
  mimeType: 'text/plain',
  sizeBytes: 12,
  sha256: 'a'.repeat(64),
} as DocumentInputRef;

describe('ToolInputPreparationService', () => {
  it('prepares text through parser, context builder, and chunker while preserving instructions', async () => {
    const parser = {
      parse: jest
        .fn()
        .mockResolvedValue({ source: { fileName: 'pasted-text.txt' } }),
    } as unknown as DocumentParserService;
    const contextBuilder = {
      build: jest.fn().mockReturnValue({ task: { type: 'polish' } }),
    } as unknown as ContextBuilderService;
    const chunker = {
      chunk: jest.fn().mockReturnValue(textContext),
    } as unknown as ChunkingService;
    const documentInput = {
      prepare: jest.fn(),
    } as unknown as DocumentInputService;
    const service = new ToolInputPreparationService(
      parser,
      contextBuilder,
      chunker,
      documentInput,
    );
    const input: ToolPreparationInput = {
      userId: 'user-1',
      taskType: 'polish',
      userInstructions: 'Keep citations unchanged.',
      chunkingPolicy: policy,
      source: { mode: 'text', text: 'A pasted paragraph.' },
    };

    await expect(service.prepare(input)).resolves.toEqual({
      context: textContext,
    });
    expect(parser.parse).toHaveBeenCalledWith({
      buffer: Buffer.from('A pasted paragraph.', 'utf8'),
      fileName: 'pasted-text.txt',
      mimeType: 'text/plain',
    });
    expect(contextBuilder.build).toHaveBeenCalledWith({
      taskType: 'polish',
      document: { source: { fileName: 'pasted-text.txt' } },
      userInstructions: 'Keep citations unchanged.',
    });
    expect(chunker.chunk).toHaveBeenCalledWith({
      context: { task: { type: 'polish' } },
      policy,
    });
    expect(documentInput.prepare).not.toHaveBeenCalled();
  });

  it('delegates file preparation to DocumentInputService without reimplementing validation', async () => {
    const prepared: PreparedDocument = {
      version: 1,
      document: documentRef,
      context: fileContext,
      summary: {
        blockCount: 1,
        chunkCount: 1,
        contentCodePoints: 10,
        referenceCodePoints: 0,
      },
    };
    const parser = { parse: jest.fn() } as unknown as DocumentParserService;
    const contextBuilder = {
      build: jest.fn(),
    } as unknown as ContextBuilderService;
    const chunker = { chunk: jest.fn() } as unknown as ChunkingService;
    const documentInput = {
      prepare: jest.fn().mockResolvedValue(prepared),
    } as unknown as DocumentInputService;
    const service = new ToolInputPreparationService(
      parser,
      contextBuilder,
      chunker,
      documentInput,
    );
    const input: ToolPreparationInput = {
      userId: 'user-1',
      taskType: 'paper-revision' as ContextTaskType,
      userInstructions: 'Use formal tone.',
      chunkingPolicy: policy,
      source: { mode: 'file', documentRef },
    };

    await expect(service.prepare(input)).resolves.toEqual({
      context: fileContext,
      documentRef,
    });
    expect(documentInput.prepare).toHaveBeenCalledWith({
      userId: 'user-1',
      documentRef,
      taskType: 'paper-revision',
      userInstructions: 'Use formal tone.',
      chunkingPolicy: policy,
    });
    expect(parser.parse).not.toHaveBeenCalled();
    expect(contextBuilder.build).not.toHaveBeenCalled();
    expect(chunker.chunk).not.toHaveBeenCalled();
  });

  it('prepares real text through the frozen C1 to C2 to C3 chain', async () => {
    const parser = new RealDocumentParserService([new TxtParser()]);
    const contextBuilder = new RealContextBuilderService();
    const chunker = new RealChunkingService();
    const documentInput = {
      prepare: jest.fn(),
    } as unknown as DocumentInputService;
    const service = new ToolInputPreparationService(
      parser,
      contextBuilder,
      chunker,
      documentInput,
    );

    const prepared = await service.prepare({
      userId: 'user-1',
      taskType: 'polish',
      userInstructions: 'Keep the citations unchanged.',
      chunkingPolicy: { maxSize: 100 },
      source: {
        mode: 'text',
        text: 'First paragraph.\n\nSecond paragraph.',
      },
    });

    expect(prepared.documentRef).toBeUndefined();
    expect(prepared.context.source.fileName).toBe('pasted-text.txt');
    expect(prepared.context.task.userInstructions).toBe(
      'Keep the citations unchanged.',
    );
    expect(prepared.context.chunks).toHaveLength(1);
    expect(prepared.context.chunks[0].items).toHaveLength(2);
    expect(documentInput.prepare).not.toHaveBeenCalled();
  });
});
