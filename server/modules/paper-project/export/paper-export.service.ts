import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { ExportArtifact, ExportArtifactSummary, ExportManifestV1 } from '@shared/manuscript.interface';
import { OBJECT_STORAGE, type ObjectStoragePort } from '../../storage/object-storage.port';
import { assertCanonicalObjectKey } from '../../storage/object-storage-key';
import { PaperProjectError, parsePaperUuid } from '../paper-project.errors';
import { PaperProjectRepository } from '../paper-project.repository';
import { artifactRefV1Schema, exportManifestV1Schema } from './export.schemas';
import { PaperExportRepository, type PaperExportRecord } from './paper-export.repository';

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

@Injectable()
export class PaperExportService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(PaperExportRepository) private readonly repository: PaperExportRepository,
    @Inject(PaperProjectRepository) private readonly projects?: PaperProjectRepository,
  ) {}

  async persistRenderedArtifact(input: {
    userId: string; projectId: string; exportId: string; createdAt: string; manuscriptFingerprint: string;
    manifest: ExportManifestV1; buffer: Buffer; fileName: string;
  }): Promise<ExportArtifact> {
    const projectId = parsePaperUuid(input.projectId);
    const exportId = parsePaperUuid(input.exportId);
    const manuscriptFingerprint = fingerprintSchema.parse(input.manuscriptFingerprint);
    const manifest = exportManifestV1Schema.parse(input.manifest) as ExportManifestV1;
    if (manifest.exportId !== exportId || manifest.projectId !== projectId || manifest.createdAt !== input.createdAt || manifest.manuscriptFingerprint !== manuscriptFingerprint) {
      throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_CORRUPT', 'The export manifest does not match its artifact identity.');
    }
    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0 || input.buffer.length > MAX_EXPORT_BYTES) {
      throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_CORRUPT', 'The rendered export size is invalid.');
    }
    const project = this.projects ? await this.projects.require(input.userId, projectId) : undefined;
    if (project?.status === 'archived') throw new PaperProjectError('PAPER_PROJECT_ARCHIVED', 'Archived projects cannot create exports.');

    const fileName = this.safeFileName(input.fileName);
    const bucketId = await this.storage.getDefaultBucketId();
    const objectKey = `academic-writing/users/${this.userScope(input.userId)}/exports/${projectId}/${exportId}/${fileName}`;
    assertCanonicalObjectKey(objectKey);
    const artifactRef = artifactRefV1Schema.parse({
      version: 1, provider: this.storage.getProvider(), bucketId, objectKey, fileName, mimeType: DOCX_MIME,
      sizeBytes: input.buffer.length, sha256: this.hash(input.buffer),
    }) as PaperExportRecord['artifactRef'];
    await this.storage.putImmutable({ bucketId, objectKey, buffer: input.buffer, contentType: DOCX_MIME });
    try {
      const row = await this.repository.create({
        id: exportId, projectId, userId: input.userId, format: 'DOCX', templateKey: 'generic-academic-v1',
        templateVersion: '1', rendererVersion: '1', manuscriptFingerprint, snapshotManifest: manifest,
        artifactRef, createdAt: new Date(input.createdAt),
      });
      return this.toArtifact(row);
    } catch (error) {
      await this.storage.remove({ bucketId, objectKey }).catch(() => undefined);
      throw error;
    }
  }

  async list(userId: string, projectId: string): Promise<ExportArtifactSummary[]> {
    parsePaperUuid(projectId);
    if (this.projects) await this.projects.require(userId, projectId);
    return (await this.repository.list(userId, projectId)).map((row) => this.toSummary(row));
  }

  async get(userId: string, projectId: string, exportId: string): Promise<ExportArtifact> {
    const row = await this.requireRecord(userId, parsePaperUuid(projectId), parsePaperUuid(exportId));
    return this.toArtifact(row);
  }

  async download(userId: string, projectId: string, exportId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: typeof DOCX_MIME }> {
    const validProjectId = parsePaperUuid(projectId);
    const validExportId = parsePaperUuid(exportId);
    const row = await this.requireRecord(userId, validProjectId, validExportId);
    const ref = artifactRefV1Schema.parse(row.artifactRef);
    const expectedKey = `academic-writing/users/${this.userScope(userId)}/exports/${validProjectId}/${validExportId}/${ref.fileName}`;
    if (ref.objectKey !== expectedKey || ref.provider !== this.storage.getProvider()) {
      throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_CORRUPT', 'The export artifact failed integrity validation.');
    }
    assertCanonicalObjectKey(ref.objectKey);
    const buffer = await this.storage.get({ bucketId: ref.bucketId, objectKey: ref.objectKey });
    if (!buffer) throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_MISSING', 'The export artifact is no longer available.');
    if (buffer.length !== ref.sizeBytes || this.hash(buffer) !== ref.sha256) {
      throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_CORRUPT', 'The export artifact failed integrity validation.');
    }
    return { buffer, fileName: ref.fileName, mimeType: DOCX_MIME };
  }

  private async requireRecord(userId: string, projectId: string, exportId: string): Promise<PaperExportRecord> {
    const row = await this.repository.get(userId, projectId, exportId);
    if (!row) throw new PaperProjectError('PAPER_EXPORT_NOT_FOUND', 'The paper export was not found.');
    return row;
  }
  private toSummary(row: PaperExportRecord): ExportArtifactSummary {
    return {
      id: row.id, projectId: row.projectId, format: 'DOCX', mode: row.snapshotManifest.mode,
      template: { key: 'generic-academic-v1', version: '1' }, renderer: { key: 'docx', version: '1' },
      manuscriptFingerprint: row.manuscriptFingerprint, sizeBytes: row.artifactRef.sizeBytes,
      sha256: row.artifactRef.sha256, createdAt: row.createdAt.toISOString(),
      downloadUrl: `/api/paper-projects/${encodeURIComponent(row.projectId)}/exports/${encodeURIComponent(row.id)}/download`,
    };
  }
  private toArtifact(row: PaperExportRecord): ExportArtifact { return { ...this.toSummary(row), manifest: row.snapshotManifest }; }
  private hash(buffer: Buffer): string { return createHash('sha256').update(buffer).digest('hex'); }
  private userScope(userId: string): string { return createHash('sha256').update(userId).digest('hex'); }
  private safeFileName(value: string): string {
    const base = value.split(/[\\/]/u).at(-1)?.replace(/[<>:"|?*\u0000-\u001f\u007f]/gu, '_').replace(/[. ]+$/u, '').trim();
    const clipped = Array.from(base || 'paper.docx').slice(0, 160).join('');
    return clipped.toLowerCase().endsWith('.docx') ? clipped : `${clipped}.docx`;
  }
}
