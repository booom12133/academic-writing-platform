jest.mock('../../client/src/api/http', () => ({
  productHttpClient: { post: jest.fn() },
}));

import { productHttpClient } from '../../client/src/api/http';
import type { DocumentInputRef } from '@shared/document-input.interface';
import {
  canSubmitPaperRevision,
  submitPaperRevisionTask,
} from '../../client/src/api/ai-tools';

const documentRef: DocumentInputRef = {
  version: 1,
  provider: 'platform-file',
  bucketId: 'bucket-1',
  filePath: 'academic-writing/users/user-1/file-1/source.txt',
  fileName: 'source.txt',
  sourceType: 'txt',
  sizeBytes: 4,
  sha256: 'a'.repeat(64),
};

describe('Paper Revision migration client request', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits text with requirements and optional revisionTypes', async () => {
    const post = productHttpClient.post as jest.Mock;
    const task = { id: 'task-1', pointsCost: 30 };
    post.mockResolvedValueOnce({ data: task });

    await expect(submitPaperRevisionTask({
      title: 'Text revision',
      inputMode: 'text',
      text: 'Source text',
      revisionTypes: ['logic', 'discussion'],
      requirements: 'Preserve citations.',
      wordCount: 11,
    })).resolves.toBe(task);

    expect(post).toHaveBeenCalledWith('/api/ai-tools/submit', {
      taskType: 'paper-revision',
      title: 'Text revision',
      inputData: {
        inputMode: 'text',
        text: 'Source text',
        revisionTypes: ['logic', 'discussion'],
        requirements: 'Preserve citations.',
        wordCount: 11,
      },
    });
    expect(post.mock.calls[0][1].inputData).not.toHaveProperty('pointsCost');
    expect(post.mock.calls[0][1].inputData).not.toHaveProperty('chunkingPolicy');
  });

  it('submits only a prepared DocumentInputRef in file mode', async () => {
    const post = productHttpClient.post as jest.Mock;
    post.mockResolvedValueOnce({ data: { id: 'task-2', pointsCost: 30 } });

    await submitPaperRevisionTask({
      title: 'File revision',
      inputMode: 'file',
      documentRef,
      revisionTypes: ['logic'],
    });

    expect(post).toHaveBeenCalledWith('/api/ai-tools/submit', {
      taskType: 'paper-revision',
      title: 'File revision',
      inputData: {
        inputMode: 'file',
        documentRef,
        revisionTypes: ['logic'],
      },
    });
    expect(post.mock.calls[0][1].inputData).not.toHaveProperty('file');
    expect(post.mock.calls[0][1].inputData).not.toHaveProperty('text');
  });

  it('accepts omitted and empty revisionTypes in the typed direct contract', async () => {
    const post = productHttpClient.post as jest.Mock;
    post.mockResolvedValue({ data: { id: 'task-3' } });

    await submitPaperRevisionTask({ title: 'Omitted', inputMode: 'text', text: 'source' });
    await submitPaperRevisionTask({
      title: 'Empty', inputMode: 'text', text: 'source', revisionTypes: [],
    });

    expect(post.mock.calls[0][1].inputData).not.toHaveProperty('revisionTypes');
    expect(post.mock.calls[1][1].inputData).toHaveProperty('revisionTypes', []);
  });

  it('keeps both UI modes disabled when no revision type is selected', () => {
    expect(canSubmitPaperRevision('text', 'source', null, [])).toBe(false);
    expect(canSubmitPaperRevision('file', '', documentRef, [])).toBe(false);
    expect(canSubmitPaperRevision('text', 'source', null, ['logic'])).toBe(true);
    expect(canSubmitPaperRevision('file', '', documentRef, ['logic'])).toBe(true);
  });

  it('rejects text without content and file mode without a prepared reference', async () => {
    await expect(submitPaperRevisionTask({
      title: 'Missing text', inputMode: 'text', text: '  ', revisionTypes: ['logic'],
    })).rejects.toThrow('text is required');
    await expect(submitPaperRevisionTask({
      title: 'Missing ref', inputMode: 'file', revisionTypes: ['logic'],
    })).rejects.toThrow('prepared document reference');
  });
});
