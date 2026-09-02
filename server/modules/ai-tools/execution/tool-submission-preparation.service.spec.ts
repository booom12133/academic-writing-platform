import { createHash } from 'node:crypto';

import { ChunkingService } from '../../chunking/chunking.service';
import { ContextBuilderService } from '../../context-builder/context-builder.service';
import { DocumentInputService } from '../../document-input/document-input.service';
import type { DocumentStoragePort } from '../../document-input/document-input.storage';
import { DocumentParserService } from '../../document-parsing/document-parser.service';
import { TxtParser } from '../../document-parsing/parsers/txt.parser';
import type { DocumentInputRef } from '@shared/document-input.interface';
import type {
  PreparedToolInput,
  ToolPreparationInput,
} from './tool-execution.types';
import { ToolInputPreparationService } from './tool-input-preparation.service';
import { ToolSubmissionPreparationService } from './tool-submission-preparation.service';

const userId = 'user-1';
const bucketId = 'documents';
const documentId = '00000000-0000-4000-8000-000000000001';
const userScope = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const documentPath = (scope: string): string =>
  `academic-writing/users/${scope}/${documentId}/file.txt`;
const makeRef = (
  filePath: string,
  sha256 = 'a'.repeat(64),
): DocumentInputRef => ({
  version: 1,
  provider: 'self-hosted-filesystem',
  bucketId,
  filePath,
  fileName: 'file.txt',
  sourceType: 'txt',
  sizeBytes: 1,
  sha256,
});

const input: ToolPreparationInput = {
  userId,
  taskType: 'polish',
  chunkingPolicy: { maxSize: 100 },
  source: {
    mode: 'file',
    documentRef: makeRef(documentPath(userScope('other-user'))),
  },
};

describe('ToolSubmissionPreparationService', () => {
  it('blocks invalid, foreign, and tampered refs before task, points, or LLM side effects', async () => {
    const storage = {
      getProvider: jest.fn().mockReturnValue('self-hosted-filesystem'),
      getDefaultBucketId: jest.fn().mockResolvedValue(bucketId),
      download: jest.fn().mockResolvedValue(Buffer.from('x')),
    } as unknown as DocumentStoragePort;
    const parser = new DocumentParserService([new TxtParser()]);
    const documentInput = new DocumentInputService(
      storage,
      parser,
      new ContextBuilderService(),
      new ChunkingService(),
    );
    const preparation = new ToolInputPreparationService(
      parser,
      new ContextBuilderService(),
      new ChunkingService(),
      documentInput,
    );
    const service = new ToolSubmissionPreparationService(preparation);
    const createTask = jest.fn();
    const consumePoints = jest.fn();
    const executeLlm = jest.fn();

    const refs = [
      makeRef('invalid-ref'),
      makeRef(documentPath(userScope('other-user'))),
      makeRef(documentPath(userScope(userId)), 'b'.repeat(64)),
    ];
    for (const documentRef of refs) {
      await expect(
        service.prepareBeforeBilling(
          { ...input, source: { mode: 'file', documentRef } },
          async (prepared) => {
            createTask(prepared);
            consumePoints();
            executeLlm();
            return 'created';
          },
        ),
      ).rejects.toBeInstanceOf(Error);
    }

    expect(createTask).not.toHaveBeenCalled();
    expect(consumePoints).not.toHaveBeenCalled();
    expect(executeLlm).not.toHaveBeenCalled();
    expect(storage.download).toHaveBeenCalledTimes(1);
  });

  it('passes the prepared context into the side-effect boundary only after preparation succeeds', async () => {
    const prepared = {
      context: { chunks: [] },
    } as unknown as PreparedToolInput;
    const preparation = {
      prepare: jest.fn().mockResolvedValue(prepared),
    } as unknown as ToolInputPreparationService;
    const service = new ToolSubmissionPreparationService(preparation);
    const afterPreparation = jest.fn().mockResolvedValue('created');

    await expect(
      service.prepareBeforeBilling(input, afterPreparation),
    ).resolves.toBe('created');
    expect(afterPreparation).toHaveBeenCalledWith(prepared);
  });
});
