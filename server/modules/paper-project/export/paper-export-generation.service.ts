import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { ExportManifestV1, ManuscriptProjectionV1, ManuscriptSnapshot } from '@shared/manuscript.interface';
import { PaperProjectError, parsePaperUuid } from '../paper-project.errors';
import { PaperProjectRepository } from '../paper-project.repository';
import { ManuscriptProjectionService } from '../manuscript/manuscript-projection.service';
import { DocxManuscriptRenderer } from './docx-manuscript.renderer';
import { createPaperExportRequestSchema } from './export.schemas';
import { PaperExportService } from './paper-export.service';

@Injectable()
export class PaperExportGenerationService {
  constructor(
    @Inject(PaperProjectRepository) private readonly repository: Pick<PaperProjectRepository, 'loadManuscriptSnapshot'>,
    @Inject(ManuscriptProjectionService) private readonly projections: Pick<ManuscriptProjectionService, 'project'>,
    @Inject(DocxManuscriptRenderer) private readonly renderer: DocxManuscriptRenderer,
    @Inject(PaperExportService) private readonly artifacts: PaperExportService,
  ) {}

  async create(userId: string, projectId: string, request: unknown) {
    parsePaperUuid(projectId);
    const parsed = createPaperExportRequestSchema.safeParse(request);
    if (!parsed.success) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST', 'The export request is invalid.');
    const snapshot = await this.repository.loadManuscriptSnapshot(userId, projectId);
    if (snapshot.project.status === 'archived') throw new PaperProjectError('PAPER_PROJECT_ARCHIVED', 'Archived projects cannot create exports.');
    const projection = this.projections.project(snapshot);
    if (parsed.data.expectedManuscriptFingerprint !== projection.manuscriptFingerprint) {
      throw new PaperProjectError('PAPER_EXPORT_FINGERPRINT_CONFLICT', 'The manuscript changed; reload before exporting.', { currentManuscriptFingerprint: projection.manuscriptFingerprint });
    }
    const requiredWarningCodes = projection.exportPolicy.acknowledgementCodes;
    if (parsed.data.mode === 'CLEAN' && !projection.exportPolicy.cleanAllowed) {
      throw new PaperProjectError('PAPER_EXPORT_POLICY_CONFLICT', 'Clean export requires a ready manuscript.', { requiredWarningCodes });
    }
    const acknowledged = new Set(parsed.data.acknowledgedWarningCodes ?? []);
    if (parsed.data.mode === 'DRAFT' && requiredWarningCodes.some((code) => !acknowledged.has(code))) {
      throw new PaperProjectError('PAPER_EXPORT_POLICY_CONFLICT', 'Draft export requires acknowledgement of every current warning.', { requiredWarningCodes });
    }

    const exportId = randomUUID();
    const createdAt = new Date().toISOString();
    const manifest = this.manifest(snapshot, projection, exportId, createdAt, parsed.data.mode);
    const rendered = await this.renderer.render(projection, { exportId, createdAt, mode: parsed.data.mode, templateKey: parsed.data.templateKey });
    return this.artifacts.persistRenderedArtifact({
      userId, projectId, exportId, createdAt, manuscriptFingerprint: projection.manuscriptFingerprint,
      manifest, buffer: rendered.buffer, fileName: this.fileName(projection.title, createdAt, exportId, rendered.extension),
    });
  }

  private manifest(snapshot: ManuscriptSnapshot, projection: ManuscriptProjectionV1, exportId: string, createdAt: string, mode: 'DRAFT'|'CLEAN'): ExportManifestV1 {
    const sectionById = new Map(snapshot.sections.map((section) => [section.id, section]));
    const bodyRevisions = projection.outline.flatMap((item) => {
      if (!item.sectionId) return [];
      const section = sectionById.get(item.sectionId);
      const revision = section ? snapshot.revisionsBySectionId[section.id] : undefined;
      return revision ? [{ sectionId: section!.id, revisionId: revision.id, revisionNumber: revision.revisionNumber, contentHash: revision.contentHash }] : [];
    });
    const mapping = new Map<string, { sectionId: string; localCitationId: string; globalNumbers: number[] }>();
    for (const citation of projection.citations) for (const contributor of citation.contributors) {
      const key = `${contributor.sectionId}\u0000${contributor.localCitationId}`;
      const entry = mapping.get(key) ?? { sectionId: contributor.sectionId, localCitationId: contributor.localCitationId, globalNumbers: [] };
      if (!entry.globalNumbers.includes(citation.number)) entry.globalNumbers.push(citation.number);
      entry.globalNumbers.sort((left, right) => left - right); mapping.set(key, entry);
    }
    return {
      schemaVersion: 1, exportId, createdAt, mode, projectId: projection.projectId,
      bodyFingerprint: projection.bodyFingerprint, manuscriptFingerprint: projection.manuscriptFingerprint,
      outline: { nodeIdsInPreorder: projection.outline.map((item) => item.nodeId) }, bodyRevisions,
      ...(projection.derived.abstract.revisionId ? { abstractRevisionId: projection.derived.abstract.revisionId } : {}),
      ...(projection.derived.keywords.revisionId ? { keywordsRevisionId: projection.derived.keywords.revisionId } : {}),
      citationMapping: [...mapping.values()],
      warnings: projection.warnings.map((warning) => ({ code: warning.code, ...(warning.sectionId ? { sectionId: warning.sectionId } : {}), ...(warning.revisionId ? { revisionId: warning.revisionId } : {}) })),
      template: { key: 'generic-academic-v1', version: '1' }, renderer: { key: 'docx', version: '1' },
    };
  }

  private fileName(title: string | null, createdAt: string, exportId: string, extension: 'docx'): string {
    const safeTitle = Array.from((title ?? 'manuscript').replace(/[<>:"|?*\\/\u0000-\u001f\u007f]/gu, '_').replace(/[. ]+$/u, '').trim() || 'manuscript').slice(0, 100).join('');
    const timestamp = createdAt.slice(0, 19).replaceAll('-', '').replace('T', '-').replaceAll(':', '');
    return `${safeTitle}-${timestamp}-${exportId.slice(0, 8)}.${extension}`;
  }
}
