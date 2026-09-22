import { createHash } from 'node:crypto';

import { PaperProjectError } from '../paper-project.errors';
import { PaperExportService } from './paper-export.service';

const userId = 'user-a';
const projectId = '550e8400-e29b-41d4-a716-446655440000';
const exportId = '550e8400-e29b-41d4-a716-446655440001';
const createdAt = '2026-09-22T04:00:00.123Z';
const fingerprint = 'b'.repeat(64);
const buffer = Buffer.from('synthetic docx');
const sha256 = createHash('sha256').update(buffer).digest('hex');
const manifest = {
  schemaVersion: 1 as const, exportId, createdAt, mode: 'DRAFT' as const, projectId,
  bodyFingerprint: 'a'.repeat(64), manuscriptFingerprint: fingerprint,
  outline: { nodeIdsInPreorder: [] }, bodyRevisions: [], citationMapping: [], warnings: [],
  template: { key: 'generic-academic-v1' as const, version: '1' as const },
  renderer: { key: 'docx' as const, version: '1' as const },
};

describe('PaperExportService artifact lifecycle', () => {
  const objectKey = `academic-writing/users/${createHash('sha256').update(userId).digest('hex')}/exports/${projectId}/${exportId}/paper.docx`;
  let storage: { getProvider: jest.Mock; getDefaultBucketId: jest.Mock; putImmutable: jest.Mock; get: jest.Mock; remove: jest.Mock };
  let repository: { create: jest.Mock; list: jest.Mock; get: jest.Mock };
  let service: PaperExportService;

  beforeEach(() => {
    storage = {
      getProvider: jest.fn().mockReturnValue('self-hosted-filesystem'),
      getDefaultBucketId: jest.fn().mockResolvedValue('self-hosted-filesystem'),
      putImmutable: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(buffer),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    repository = { create: jest.fn(), list: jest.fn(), get: jest.fn() };
    service = new PaperExportService(storage as never, repository as never);
  });

  it('stores immutable bytes before inserting a validated owner-scoped row', async () => {
    repository.create.mockImplementation(async (input) => input);
    const result = await service.persistRenderedArtifact({
      userId, projectId, exportId, createdAt, manuscriptFingerprint: fingerprint,
      manifest, buffer, fileName: 'paper.docx',
    });
    expect(storage.putImmutable).toHaveBeenCalledWith(expect.objectContaining({ objectKey, buffer }));
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId, projectId, id: exportId, createdAt: new Date(createdAt),
      artifactRef: expect.objectContaining({ objectKey, sizeBytes: buffer.length, sha256 }),
    }));
    expect(result).toMatchObject({ id: exportId, mode: 'DRAFT', sizeBytes: buffer.length, sha256 });
    expect(JSON.stringify(result)).not.toContain(objectKey);
  });

  it('removes only the new object when database insertion fails', async () => {
    repository.create.mockRejectedValue(new Error('insert failed'));
    await expect(service.persistRenderedArtifact({
      userId, projectId, exportId, createdAt, manuscriptFingerprint: fingerprint,
      manifest, buffer, fileName: 'paper.docx',
    })).rejects.toThrow('insert failed');
    expect(storage.remove).toHaveBeenCalledWith({ bucketId: 'self-hosted-filesystem', objectKey });
  });

  it('starts download from owner-scoped metadata and verifies path, length, and hash', async () => {
    repository.get.mockResolvedValue({
      id: exportId, userId, projectId, format: 'DOCX', templateKey: 'generic-academic-v1',
      templateVersion: '1', rendererVersion: '1', manuscriptFingerprint: fingerprint,
      snapshotManifest: manifest, createdAt: new Date(createdAt),
      artifactRef: { version: 1, provider: 'self-hosted-filesystem', bucketId: 'self-hosted-filesystem', objectKey, fileName: 'paper.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: buffer.length, sha256 },
    });
    await expect(service.download(userId, projectId, exportId)).resolves.toMatchObject({ buffer, fileName: 'paper.docx' });
    expect(repository.get).toHaveBeenCalledWith(userId, projectId, exportId);
  });

  it('fails safely for missing, corrupt, or path-tampered objects', async () => {
    const row = {
      id: exportId, userId, projectId, format: 'DOCX', templateKey: 'generic-academic-v1',
      templateVersion: '1', rendererVersion: '1', manuscriptFingerprint: fingerprint,
      snapshotManifest: manifest, createdAt: new Date(createdAt),
      artifactRef: { version: 1, provider: 'self-hosted-filesystem', bucketId: 'self-hosted-filesystem', objectKey, fileName: 'paper.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: buffer.length, sha256 },
    };
    repository.get.mockResolvedValue(row);
    storage.get.mockResolvedValueOnce(null);
    await expect(service.download(userId, projectId, exportId)).rejects.toMatchObject({ code: 'PAPER_EXPORT_ARTIFACT_MISSING' });
    storage.get.mockResolvedValueOnce(Buffer.from('tampered'));
    await expect(service.download(userId, projectId, exportId)).rejects.toMatchObject({ code: 'PAPER_EXPORT_ARTIFACT_CORRUPT' });
    repository.get.mockResolvedValueOnce({ ...row, artifactRef: { ...row.artifactRef, objectKey: '../../secret' } });
    await expect(service.download(userId, projectId, exportId)).rejects.toBeInstanceOf(PaperProjectError);
    expect(storage.get).toHaveBeenCalledTimes(2);
  });
});
