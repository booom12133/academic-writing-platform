jest.mock('@lark-apaas/client-toolkit/utils/getAxiosForBackend', () => ({
  axiosForBackend: { post: jest.fn() },
}));

import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { DocumentInputRef } from '@shared/document-input.interface';
import { submitPolishTask } from '../../client/src/api/ai-tools';

const documentRef: DocumentInputRef = {
  version: 1,
  provider: 'platform-file',
  bucketId: 'bucket-1',
  filePath: 'academic-writing/users/scope/file-1/note.txt',
  fileName: 'note.txt',
  sourceType: 'txt',
  sizeBytes: 4,
  sha256: 'a'.repeat(64),
};

describe('Polish migration client request', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends text through the existing Task endpoint', async () => {
    const post = axiosForBackend.post as jest.Mock;
    const task = { id: 'task-1', pointsCost: 10 };
    post.mockResolvedValueOnce({ data: task });

    await expect(submitPolishTask({
      title: 'Text polish',
      inputMode: 'text',
      text: 'Source text',
      polishType: 'academic',
      wordCount: 11,
    })).resolves.toBe(task);

    expect(post).toHaveBeenCalledWith('/api/ai-tools/submit', {
      taskType: 'polish',
      title: 'Text polish',
      inputData: {
        inputMode: 'text',
        text: 'Source text',
        polishType: 'academic',
        wordCount: 11,
      },
    });
  });

  it('sends only the structured DocumentInputRef for file mode', async () => {
    const post = axiosForBackend.post as jest.Mock;
    post.mockResolvedValueOnce({ data: { id: 'task-2', pointsCost: 20 } });

    await submitPolishTask({
      title: 'File polish',
      inputMode: 'file',
      documentRef,
      polishType: 'grammar',
    });

    const [, request] = post.mock.calls[0];
    expect(request.inputData).toEqual({
      inputMode: 'file',
      documentRef,
      polishType: 'grammar',
    });
    expect(request.inputData).not.toHaveProperty('file');
    expect(request.inputData).not.toHaveProperty('text');
    expect(request.inputData).not.toHaveProperty('pointsCost');
  });
});
