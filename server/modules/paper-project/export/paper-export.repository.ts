import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import type { ArtifactRefV1, ExportManifestV1 } from '@shared/manuscript.interface';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../../database/database.types';
import { paperExports, paperProjects } from '../../../database/schema';
import { artifactRefV1Schema, exportManifestV1Schema } from './export.schemas';
import { PaperProjectError } from '../paper-project.errors';

type ExportRow = typeof paperExports.$inferSelect;

export interface PaperExportRecord {
  id: string;
  projectId: string;
  userId: string;
  format: 'DOCX';
  templateKey: 'generic-academic-v1';
  templateVersion: '1';
  rendererVersion: '1';
  manuscriptFingerprint: string;
  snapshotManifest: ExportManifestV1;
  artifactRef: ArtifactRefV1;
  createdAt: Date;
}

export type CreatePaperExportRecord = PaperExportRecord;

function toRecord(row: ExportRow): PaperExportRecord {
  try {
    return {
      id: row.id, projectId: row.projectId, userId: row.userId, format: row.format as 'DOCX',
      templateKey: row.templateKey as 'generic-academic-v1', templateVersion: row.templateVersion as '1', rendererVersion: row.rendererVersion as '1',
      manuscriptFingerprint: row.manuscriptFingerprint,
      snapshotManifest: exportManifestV1Schema.parse(row.snapshotManifest) as ExportManifestV1,
      artifactRef: artifactRefV1Schema.parse(row.artifactRef) as ArtifactRefV1, createdAt: row.createdAt,
    };
  } catch {
    throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_CORRUPT', 'The export metadata failed integrity validation.');
  }
}

@Injectable()
export class PaperExportRepository {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: AppDatabase) {}

  async create(input: CreatePaperExportRecord): Promise<PaperExportRecord> {
    const manifest = exportManifestV1Schema.parse(input.snapshotManifest);
    const artifactRef = artifactRefV1Schema.parse(input.artifactRef);
    return this.db.transaction(async (tx) => {
      const [project] = await tx.select({ status: paperProjects.status }).from(paperProjects)
        .where(and(eq(paperProjects.id, input.projectId), eq(paperProjects.userId, input.userId))).for('update').limit(1);
      if (!project) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Paper project was not found.');
      if (project.status !== 'active') throw new PaperProjectError('PAPER_PROJECT_ARCHIVED', 'Archived projects cannot create exports.');
      const [row] = await tx.insert(paperExports).values({
        id: input.id, projectId: input.projectId, userId: input.userId, format: input.format,
        templateKey: input.templateKey, templateVersion: input.templateVersion, rendererVersion: input.rendererVersion,
        manuscriptFingerprint: input.manuscriptFingerprint,
        snapshotManifest: manifest, artifactRef, createdAt: input.createdAt,
      }).returning();
      if (!row) throw new PaperProjectError('PAPER_EXPORT_ARTIFACT_CORRUPT', 'The export record was not created.');
      return toRecord(row);
    });
  }

  async list(userId: string, projectId: string): Promise<PaperExportRecord[]> {
    const rows = await this.db.select().from(paperExports)
      .where(and(eq(paperExports.userId, userId), eq(paperExports.projectId, projectId)))
      .orderBy(desc(paperExports.createdAt));
    return rows.map(toRecord);
  }

  async get(userId: string, projectId: string, exportId: string): Promise<PaperExportRecord | null> {
    const [row] = await this.db.select().from(paperExports).where(and(
      eq(paperExports.userId, userId), eq(paperExports.projectId, projectId), eq(paperExports.id, exportId),
    )).limit(1);
    return row ? toRecord(row) : null;
  }
}
