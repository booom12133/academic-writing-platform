import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import JSZip = require('jszip');

import { DRIZZLE_DATABASE } from '../../server/database/database.types';
import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../server/database/local-development.database';
import { paperOutlineNodes, paperProjects, paperSectionRevisions, paperSections } from '../../server/database/schema';
import { PaperExportController } from '../../server/modules/paper-project/export/paper-export.controller';
import { PaperExportGenerationService } from '../../server/modules/paper-project/export/paper-export-generation.service';
import { PaperExportRepository } from '../../server/modules/paper-project/export/paper-export.repository';
import { PaperExportService } from '../../server/modules/paper-project/export/paper-export.service';
import { DocxManuscriptRenderer } from '../../server/modules/paper-project/export/docx-manuscript.renderer';
import { DerivedContentService } from '../../server/modules/paper-project/manuscript/derived-content.service';
import { computeBodyFingerprint } from '../../server/modules/paper-project/manuscript/manuscript-fingerprint';
import { ManuscriptController } from '../../server/modules/paper-project/manuscript/manuscript.controller';
import { ManuscriptProjectionService } from '../../server/modules/paper-project/manuscript/manuscript-projection.service';
import { PaperProjectController } from '../../server/modules/paper-project/paper-project.controller';
import { PaperProjectRepository } from '../../server/modules/paper-project/paper-project.repository';
import { PaperProjectService } from '../../server/modules/paper-project/paper-project.service';
import { PaperSourceService } from '../../server/modules/paper-project/paper-source.service';
import { PaperGenerationService } from '../../server/modules/paper-project/paper-generation.service';
import { PaperPlanningService } from '../../server/modules/paper-project/paper-planning.service';
import { PaperWorkflowController } from '../../server/modules/paper-project/paper-workflow.controller';
import { PaperWorkflowService } from '../../server/modules/paper-project/paper-workflow.service';
import { SelfHostedFilesystemObjectStorageAdapter } from '../../server/modules/storage/filesystem-object-storage.adapter';
import { OBJECT_STORAGE } from '../../server/modules/storage/object-storage.port';

type SeedSection = {
  title: string;
  content?: string;
  status?: 'active' | 'orphaned';
  outlineStatus?: 'active' | 'archived';
  supportState?: 'NOT_CLAIMED' | 'VALID' | 'STALE_AFTER_EDIT';
  citations?: unknown[];
  bibliography?: unknown[];
  evidenceTrace?: unknown[];
  generationMetadata?: Record<string, unknown>;
};

type SeedResult = { projectId: string; sectionIds: string[]; derivedSectionIds: string[] };

describe('P5 manuscript and DOCX acceptance HTTP flows', () => {
  let local: LocalDevelopmentDatabase;
  let app: INestApplication;
  let baseUrl: string;
  let storageRoot: string;
  let repository: PaperProjectRepository;
  let exportRepository: PaperExportRepository;
  let storage: SelfHostedFilesystemObjectStorageAdapter;

  const hash = (value: string) => createHash('sha256').update(value).digest('hex');

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    storageRoot = await mkdtemp(join(tmpdir(), 'p5-e2e-storage-'));
    repository = new PaperProjectRepository(local.db);
    const projection = new ManuscriptProjectionService(repository);
    exportRepository = new PaperExportRepository(local.db);
    storage = new SelfHostedFilesystemObjectStorageAdapter(storageRoot);
    const artifacts = new PaperExportService(storage, exportRepository, repository);
    const renderer = new DocxManuscriptRenderer();
    const generation = new PaperExportGenerationService(repository, projection, renderer, artifacts);
    const projectService = new PaperProjectService(repository);
    const workflowService = new PaperWorkflowService(repository);
    const moduleRef = await Test.createTestingModule({
      controllers: [ManuscriptController, PaperExportController, PaperProjectController, PaperWorkflowController],
      providers: [
        { provide: DRIZZLE_DATABASE, useValue: local.db },
        { provide: OBJECT_STORAGE, useValue: storage },
        { provide: PaperProjectRepository, useValue: repository },
        { provide: PaperProjectService, useValue: projectService },
        { provide: PaperWorkflowService, useValue: workflowService },
        { provide: PaperPlanningService, useValue: {} },
        { provide: PaperGenerationService, useValue: {} },
        { provide: PaperSourceService, useValue: { list: async () => [] } },
        { provide: ManuscriptProjectionService, useValue: projection },
        { provide: DerivedContentService, useValue: {} },
        { provide: PaperExportRepository, useValue: exportRepository },
        { provide: PaperExportService, useValue: artifacts },
        { provide: DocxManuscriptRenderer, useValue: renderer },
        { provide: PaperExportGenerationService, useValue: generation },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((request: { headers: Record<string, string | undefined>; userContext?: { userId: string } }, _response: unknown, next: () => void) => {
      const userId = request.headers['x-test-user'];
      if (userId) request.userContext = { userId };
      next();
    });
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterEach(async () => {
    await app.close();
    await local.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  async function seedProject(sections: SeedSection[], includeDerived = true): Promise<SeedResult> {
    const projectId = randomUUID();
    const sectionIds: string[] = [];
    await local.db.insert(paperProjects).values({
      id: projectId,
      userId: 'user-a',
      selectedTitle: 'Zero-upload paper',
      profile: { schemaVersion: 1, researchIdea: 'zero upload', paperType: 'other', language: 'en' },
      researchPlan: {
        schemaVersion: 1,
        researchProblem: 'Problem',
        researchQuestions: ['Question'],
        researchObjectives: ['Objective'],
        methodology: { approach: 'review', methods: ['analysis'] },
        dataMaterialRequirements: [],
        expectedContributions: ['Contribution'],
        limitationsAssumptions: [],
        keywords: ['writing'],
      },
    });
    for (const [position, input] of sections.entries()) {
      const nodeId = randomUUID();
      const sectionId = randomUUID();
      sectionIds.push(sectionId);
      await local.db.insert(paperOutlineNodes).values({
        id: nodeId, projectId, userId: 'user-a', nodeType: 'writing-unit', title: input.title,
        position, status: input.outlineStatus ?? 'active',
      });
      await local.db.insert(paperSections).values({
        id: sectionId, projectId, userId: 'user-a', outlineNodeId: nodeId, sectionRole: 'OUTLINE',
        status: input.status ?? 'active', currentRevisionNumber: input.content === undefined ? 0 : 1,
      });
      if (input.content !== undefined) {
        await local.db.insert(paperSectionRevisions).values({
          id: randomUUID(), sectionId, userId: 'user-a', revisionNumber: 1, content: input.content, contentHash: hash(input.content),
          origin: input.supportState === 'STALE_AFTER_EDIT' ? 'USER_EDIT' : 'AI_GENERATION',
          sourceStrategy: input.supportState === 'VALID' ? 'USER_KNOWLEDGE' : 'MODEL_ONLY',
          actualSupportMode: input.supportState === 'VALID' ? 'USER_EVIDENCE' : 'AI_DRAFT',
          supportState: input.supportState ?? 'NOT_CLAIMED', citations: input.citations ?? [], bibliography: input.bibliography ?? [],
          evidenceTrace: input.evidenceTrace ?? [], generationMetadata: input.generationMetadata ?? {}, warnings: [],
        });
      }
    }
    const derivedSectionIds: string[] = [];
    if (includeDerived) {
      const bodyFingerprint = computeBodyFingerprint(await repository.loadManuscriptSnapshot('user-a', projectId));
      for (const [role, content] of [['ABSTRACT', 'A concise abstract.'], ['KEYWORDS', 'writing; workflow']] as const) {
        const sectionId = randomUUID();
        derivedSectionIds.push(sectionId);
        await local.db.insert(paperSections).values({ id: sectionId, projectId, userId: 'user-a', sectionRole: role, currentRevisionNumber: 1 });
        await local.db.insert(paperSectionRevisions).values({
          id: randomUUID(), sectionId, userId: 'user-a', revisionNumber: 1, content, contentHash: hash(content),
          origin: 'AI_GENERATION', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED',
          citations: [], bibliography: [], evidenceTrace: [], generationMetadata: { derivedFromBodyFingerprint: bodyFingerprint }, warnings: [],
        });
      }
    }
    return { projectId, sectionIds, derivedSectionIds };
  }

  function trace(evidenceId: string, sourceRecordId: string) {
    return {
      evidenceId,
      citationLocator: { chunkId: `${evidenceId}-chunk`, documentVersionId: `${evidenceId}-version`, sourceRecordId },
      provenance: {
        documentId: `${evidenceId}-document`, documentVersionId: `${evidenceId}-version`, sourceRecordId,
        sourceBlockId: 'block', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'unit', sourceChunkOrdinal: 0, itemOrdinal: 0,
      },
    };
  }

  async function json(method: string, path: string, body?: unknown, userId: string | null = 'user-a') {
    const headers: Record<string, string> = {};
    if (userId) headers['x-test-user'] = userId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() as any };
  }

  async function createExport(projectId: string, mode: 'CLEAN' | 'DRAFT' = 'CLEAN') {
    const manuscript = await json('GET', `/api/paper-projects/${projectId}/manuscript`);
    const request = {
      format: 'DOCX', mode, templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscript.body.manuscriptFingerprint,
      ...(mode === 'DRAFT' ? { acknowledgedWarningCodes: manuscript.body.exportPolicy.acknowledgementCodes } : {}),
    };
    return { manuscript, created: await json('POST', `/api/paper-projects/${projectId}/exports`, request) };
  }

  it('A: exports, lists, downloads, preserves timestamps, and keeps P4 workspace outline-only', async () => {
    const seeded = await seedProject([{ title: 'Introduction', content: 'A truthful model-only body.' }]);
    const { manuscript, created } = await createExport(seeded.projectId);
    expect(manuscript).toMatchObject({ status: 200, body: { readiness: 'READY', citations: [], bibliography: [], exportPolicy: { cleanAllowed: true } } });
    expect(created).toMatchObject({ status: 201, body: { format: 'DOCX', mode: 'CLEAN', manuscriptFingerprint: manuscript.body.manuscriptFingerprint } });
    expect(JSON.stringify(created.body)).not.toMatch(/bucketId|objectKey|self-hosted-filesystem/u);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/exports`)).body).toHaveLength(1);
    const response = await fetch(`${baseUrl}/api/paper-projects/${seeded.projectId}/exports/${created.body.id}/download`, { headers: { 'x-test-user': 'user-a' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    expect(await zip.file('word/document.xml')!.async('string')).toContain('A truthful model-only body.');
    expect(await zip.file('docProps/core.xml')!.async('string')).toContain(`<dcterms:created xsi:type="dcterms:W3CDTF">${created.body.createdAt}</dcterms:created>`);
    const workspace = await json('GET', `/api/paper-projects/${seeded.projectId}`);
    expect(workspace.status).toBe(200);
    expect(workspace.body.sections.map((section: { id: string }) => section.id)).toEqual(seeded.sectionIds);
    expect(await repository.getSection('user-a', seeded.projectId, seeded.derivedSectionIds[0]!)).toBeNull();
    const derivedRevision = (await repository.listRevisions('user-a', seeded.derivedSectionIds[0]!))[0]!;
    const derivedRestore = await json('POST', `/api/paper-projects/${seeded.projectId}/sections/${seeded.derivedSectionIds[0]}/revisions/restore`, {
      expectedCurrentRevisionNumber: 1,
      revisionId: derivedRevision.id,
    });
    expect(derivedRestore).toMatchObject({ status: 404, body: { code: 'PAPER_PROJECT_NOT_FOUND' } });
  });

  it('B: globally renumbers grounded citations and deduplicates bibliography identities', async () => {
    const firstContent = 'First claim [1].';
    const secondContent = 'Shared [1] and unique [2].';
    const seeded = await seedProject([
      {
        title: 'Prior work', content: firstContent, supportState: 'VALID',
        citations: [{ citationId: 'citation-shared', evidenceIds: ['shared-a'] }],
        bibliography: [{ citationId: 'citation-shared', fields: { title: 'Shared study' } }],
        evidenceTrace: [trace('shared-a', 'shared-source')],
        generationMetadata: { citationPlacements: [{ schemaVersion: 1, citationId: 'citation-shared', localNumber: 1, start: firstContent.indexOf('[1]'), end: firstContent.indexOf('[1]') + 3, markerText: '[1]' }] },
      },
      {
        title: 'Findings', content: secondContent, supportState: 'VALID',
        citations: [{ citationId: 'citation-shared', evidenceIds: ['shared-b'] }, { citationId: 'citation-unique', evidenceIds: ['unique'] }],
        bibliography: [{ citationId: 'citation-shared', fields: { title: 'Shared study' } }, { citationId: 'citation-unique', fields: { title: 'Unique study' } }],
        evidenceTrace: [trace('shared-b', 'shared-source'), trace('unique', 'unique-source')],
        generationMetadata: { citationPlacements: [
          { schemaVersion: 1, citationId: 'citation-shared', localNumber: 1, start: secondContent.indexOf('[1]'), end: secondContent.indexOf('[1]') + 3, markerText: '[1]' },
          { schemaVersion: 1, citationId: 'citation-unique', localNumber: 2, start: secondContent.indexOf('[2]'), end: secondContent.indexOf('[2]') + 3, markerText: '[2]' },
        ] },
      },
    ]);
    const { manuscript, created } = await createExport(seeded.projectId);
    expect(manuscript.body).toMatchObject({ readiness: 'READY', supportSummary: { managedCitationCount: 2, bibliographyEntryCount: 2, bibliographyState: 'COMPLETE' } });
    expect(manuscript.body.citations.map((citation: { identity: string }) => citation.identity)).toEqual(['source:shared-source', 'source:unique-source']);
    expect(created.status).toBe(201);
    expect(created.body.manifest.citationMapping).toEqual([
      { sectionId: seeded.sectionIds[0], localCitationId: 'citation-shared', globalNumbers: [1] },
      { sectionId: seeded.sectionIds[1], localCitationId: 'citation-shared', globalNumbers: [1] },
      { sectionId: seeded.sectionIds[1], localCitationId: 'citation-unique', globalNumbers: [2] },
    ]);
  });

  it('C: preserves stale edited text, suppresses historical references, and requires draft acknowledgement', async () => {
    const body = 'Edited body keeps an author-authored [1] marker.';
    const seeded = await seedProject([{ title: 'Discussion', content: body, supportState: 'STALE_AFTER_EDIT' }]);
    const manuscript = await json('GET', `/api/paper-projects/${seeded.projectId}/manuscript`);
    expect(manuscript.body).toMatchObject({ readiness: 'INCOMPLETE', bibliography: [], exportPolicy: { cleanAllowed: false } });
    expect(manuscript.body.warnings).toContainEqual(expect.objectContaining({ code: 'STALE_AFTER_EDIT' }));
    const clean = await json('POST', `/api/paper-projects/${seeded.projectId}/exports`, {
      format: 'DOCX', mode: 'CLEAN', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscript.body.manuscriptFingerprint,
    });
    expect(clean).toMatchObject({ status: 409, body: { code: 'PAPER_EXPORT_POLICY_CONFLICT' } });
    const unacknowledged = await json('POST', `/api/paper-projects/${seeded.projectId}/exports`, {
      format: 'DOCX', mode: 'DRAFT', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscript.body.manuscriptFingerprint,
    });
    expect(unacknowledged).toMatchObject({ status: 409, body: { code: 'PAPER_EXPORT_POLICY_CONFLICT' } });
    const { created } = await createExport(seeded.projectId, 'DRAFT');
    const download = await fetch(`${baseUrl}${created.body.downloadUrl}`, { headers: { 'x-test-user': 'user-a' } });
    const documentXml = await (await JSZip.loadAsync(Buffer.from(await download.arrayBuffer()))).file('word/document.xml')!.async('string');
    expect(documentXml).toContain(body);
    expect(documentXml).toContain('STALE_AFTER_EDIT');
  });

  it('D: renders missing placeholders, excludes orphaned history, and gates draft export', async () => {
    const orphanedText = 'This orphaned revision must never be exported.';
    const seeded = await seedProject([
      { title: 'Missing results' },
      { title: 'Removed section', content: orphanedText, status: 'orphaned', outlineStatus: 'archived' },
    ]);
    const manuscript = await json('GET', `/api/paper-projects/${seeded.projectId}/manuscript`);
    expect(manuscript.body.readiness).toBe('INCOMPLETE');
    expect(manuscript.body.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_SECTION' }),
      expect.objectContaining({ code: 'ORPHANED_SECTION_EXCLUDED' }),
    ]));
    expect(JSON.stringify(manuscript.body.blocks)).toContain('【本节尚未完成】');
    expect(JSON.stringify(manuscript.body.blocks)).not.toContain(orphanedText);
    const rejected = await json('POST', `/api/paper-projects/${seeded.projectId}/exports`, {
      format: 'DOCX', mode: 'DRAFT', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscript.body.manuscriptFingerprint,
      acknowledgedWarningCodes: ['MISSING_SECTION'],
    });
    expect(rejected).toMatchObject({ status: 409, body: { code: 'PAPER_EXPORT_POLICY_CONFLICT' } });
    const { created } = await createExport(seeded.projectId, 'DRAFT');
    const download = await fetch(`${baseUrl}${created.body.downloadUrl}`, { headers: { 'x-test-user': 'user-a' } });
    const documentXml = await (await JSZip.loadAsync(Buffer.from(await download.arrayBuffer()))).file('word/document.xml')!.async('string');
    expect(documentXml).toContain('【本节尚未完成】');
    expect(documentXml).toContain('DRAFT');
    expect(documentXml).not.toContain(orphanedText);
  });

  it('enforces authentication, ownership, archived-project, missing-object, and corrupt-object semantics', async () => {
    const seeded = await seedProject([{ title: 'Body', content: 'Secure body.' }]);
    expect((await json('GET', '/api/paper-projects/not-a-uuid/manuscript')).status).toBe(400);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/exports/not-a-uuid`)).status).toBe(400);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/manuscript`, undefined, null)).status).toBe(401);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/manuscript`, undefined, 'user-b')).status).toBe(404);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/exports`, undefined, 'user-b')).status).toBe(404);
    const first = await createExport(seeded.projectId);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/exports/${first.created.body.id}`, undefined, 'user-b')).status).toBe(404);
    expect((await fetch(`${baseUrl}${first.created.body.downloadUrl}`, { headers: { 'x-test-user': 'user-b' } })).status).toBe(404);
    const row = await exportRepository.get('user-a', seeded.projectId, first.created.body.id);
    await storage.remove({ bucketId: row!.artifactRef.bucketId, objectKey: row!.artifactRef.objectKey });
    expect((await fetch(`${baseUrl}${first.created.body.downloadUrl}`, { headers: { 'x-test-user': 'user-a' } })).status).toBe(410);
    await storage.putImmutable({ bucketId: row!.artifactRef.bucketId, objectKey: row!.artifactRef.objectKey, buffer: Buffer.from('tampered'), contentType: row!.artifactRef.mimeType });
    const corrupt = await fetch(`${baseUrl}${first.created.body.downloadUrl}`, { headers: { 'x-test-user': 'user-a' } });
    expect(corrupt.status).toBe(500);
    expect(await corrupt.text()).not.toContain(row!.artifactRef.objectKey);
    const second = await createExport(seeded.projectId);
    await repository.archive('user-a', seeded.projectId, 0);
    expect((await json('GET', `/api/paper-projects/${seeded.projectId}/exports`)).status).toBe(200);
    expect((await fetch(`${baseUrl}${second.created.body.downloadUrl}`, { headers: { 'x-test-user': 'user-a' } })).status).toBe(200);
    const archivedProjection = await json('GET', `/api/paper-projects/${seeded.projectId}/manuscript`);
    const archivedCreate = await json('POST', `/api/paper-projects/${seeded.projectId}/exports`, {
      format: 'DOCX', mode: 'CLEAN', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: archivedProjection.body.manuscriptFingerprint,
    });
    expect(archivedCreate).toMatchObject({ status: 409, body: { code: 'PAPER_PROJECT_ARCHIVED' } });
  });
});
