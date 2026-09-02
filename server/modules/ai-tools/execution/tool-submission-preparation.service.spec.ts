import type {
  PreparedToolInput,
  ToolPreparationInput,
} from './tool-execution.types';
import { ToolInputPreparationService } from './tool-input-preparation.service';
import { ToolSubmissionPreparationService } from './tool-submission-preparation.service';

const input: ToolPreparationInput = {
  userId: 'user-1',
  taskType: 'polish',
  chunkingPolicy: { maxSize: 100 },
  source: {
    mode: 'file',
    documentRef: {
      version: 1,
      provider: 'self-hosted-filesystem',
      bucketId: 'documents',
      filePath: 'academic-writing/users/other-user/file.txt',
      fileName: 'file.txt',
      sourceType: 'txt',
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
    },
  },
};

describe('ToolSubmissionPreparationService', () => {
  it('does not enter the post-preparation side-effect boundary when preparation rejects', async () => {
    const preparationError = new Error('DOCUMENT_OWNERSHIP_MISMATCH');
    const preparation = {
      prepare: jest.fn().mockRejectedValue(preparationError),
    } as unknown as ToolInputPreparationService;
    const service = new ToolSubmissionPreparationService(preparation);
    const createTask = jest.fn();
    const consumePoints = jest.fn();
    const executeLlm = jest.fn();

    await expect(
      service.prepareBeforeBilling(input, async (prepared) => {
        createTask(prepared);
        consumePoints();
        executeLlm();
        return 'created';
      }),
    ).rejects.toBe(preparationError);

    expect(createTask).not.toHaveBeenCalled();
    expect(consumePoints).not.toHaveBeenCalled();
    expect(executeLlm).not.toHaveBeenCalled();
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
