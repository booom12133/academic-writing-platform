import { createHash, randomUUID } from 'node:crypto';

import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../../database/local-development.database';
import { paperProjects } from '../../../database/schema';
import { PaperExportRepository, type CreatePaperExportRecord } from './paper-export.repository';

describe('PaperExportRepository', () => {
  let local: LocalDevelopmentDatabase;
  let repository: PaperExportRepository;
  const userId = 'export-owner';

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    repository = new PaperExportRepository(local.db);
  });
  afterEach(async () => local.close());

  it('creates, lists newest first, gets only by owner, and exposes no mutation method', async () => {
    const projectId = randomUUID();
    await local.db.insert(paperProjects).values({
      id: projectId, userId, profile: { schemaVersion: 1, researchIdea: 'exports', paperType: 'other', language: 'en' },
    });
    const make = (createdAt: string): CreatePaperExportRecord => {
      const id = randomUUID();
      const buffer = Buffer.from(id);
      const fingerprint = 'a'.repeat(64);
      return {
        id, projectId, userId, format: 'DOCX', templateKey: 'generic-academic-v1', templateVersion: '1', rendererVersion: '1',
        manuscriptFingerprint: fingerprint, createdAt: new Date(createdAt),
        snapshotManifest: {
          schemaVersion: 1, exportId: id, createdAt, mode: 'CLEAN', projectId,
          bodyFingerprint: 'b'.repeat(64), manuscriptFingerprint: fingerprint,
          outline: { nodeIdsInPreorder: [] }, bodyRevisions: [], citationMapping: [], warnings: [],
          template: { key: 'generic-academic-v1', version: '1' }, renderer: { key: 'docx', version: '1' },
        },
        artifactRef: {
          version: 1, provider: 'self-hosted-filesystem', bucketId: 'self-hosted-filesystem',
          objectKey: `academic-writing/users/${'c'.repeat(64)}/exports/${projectId}/${id}/paper.docx`,
          fileName: 'paper.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'),
        },
      };
    };
    const first = await repository.create(make('2026-09-22T04:00:00.000Z'));
    const second = await repository.create(make('2026-09-22T04:00:01.000Z'));
    await expect(repository.list(userId, projectId)).resolves.toEqual([second, first]);
    await expect(repository.get(userId, projectId, first.id)).resolves.toEqual(first);
    await expect(repository.get('other-user', projectId, first.id)).resolves.toBeNull();
    expect('update' in repository).toBe(false);
    expect('delete' in repository).toBe(false);
  });
});
