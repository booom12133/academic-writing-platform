jest.mock('../../client/src/api/http', () => ({
  productHttpClient: { post: jest.fn() },
}));

import { productHttpClient } from '../../client/src/api/http';
import { uploadDocument } from '../../client/src/api/document-input';

describe('document input client API', () => {
  it('posts the selected file as multipart FormData and returns the descriptor', async () => {
    const descriptor = {
      document: {
        version: 1,
        provider: 'platform-file',
        bucketId: 'bucket',
        filePath: 'academic-writing/users/scope/id/note.txt',
        fileName: 'note.txt',
        sourceType: 'txt',
        sizeBytes: 4,
        sha256: 'a'.repeat(64),
      },
      summary: {
        sourceType: 'txt',
        blockCount: 1,
        warningCount: 0,
      },
    };
    const post = productHttpClient.post as jest.Mock;
    post.mockResolvedValueOnce({ data: descriptor });
    const file = new File(['note'], 'note.txt', { type: 'text/plain' });

    await expect(uploadDocument(file)).resolves.toEqual(descriptor);

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0];
    expect(path).toBe('/api/document-inputs');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBeInstanceOf(File);
    expect(((body as FormData).get('file') as File).name).toBe('note.txt');
  });
});
