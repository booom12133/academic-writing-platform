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
import { PaperProjectRepository } from '../../server/modules/paper-project/paper-project.repository';
import { SelfHostedFilesystemObjectStorageAdapter } from '../../server/modules/storage/filesystem-object-storage.adapter';
import { OBJECT_STORAGE } from '../../server/modules/storage/object-storage.port';

describe('P5 zero-upload manuscript DOCX HTTP flow', () => {
  let local: LocalDevelopmentDatabase;
  let app: INestApplication;
  let baseUrl: string;
  let storageRoot: string;
  let projectId: string;

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    storageRoot = await mkdtemp(join(tmpdir(), 'p5-e2e-storage-'));
    const repository = new PaperProjectRepository(local.db);
    const projection = new ManuscriptProjectionService(repository);
    const exportRepository = new PaperExportRepository(local.db);
    const storage = new SelfHostedFilesystemObjectStorageAdapter(storageRoot);
    const artifacts = new PaperExportService(storage, exportRepository, repository);
    const renderer = new DocxManuscriptRenderer();
    const generation = new PaperExportGenerationService(repository, projection, renderer, artifacts);
    const moduleRef = await Test.createTestingModule({
      controllers: [ManuscriptController, PaperExportController],
      providers: [
        { provide: DRIZZLE_DATABASE, useValue: local.db }, { provide: OBJECT_STORAGE, useValue: storage },
        { provide: PaperProjectRepository, useValue: repository }, { provide: ManuscriptProjectionService, useValue: projection },
        { provide: DerivedContentService, useValue: {} }, { provide: PaperExportRepository, useValue: exportRepository },
        { provide: PaperExportService, useValue: artifacts }, { provide: DocxManuscriptRenderer, useValue: renderer },
        { provide: PaperExportGenerationService, useValue: generation },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((request: { headers: Record<string, string | undefined>; userContext?: { userId: string } }, _response: unknown, next: () => void) => {
      const userId = request.headers['x-test-user']; if (userId) request.userContext = { userId }; next();
    });
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
    projectId = await seedReadyProject(repository);
  });

  afterEach(async () => { await app.close(); await local.close(); await rm(storageRoot, { recursive: true, force: true }); });

  async function seedReadyProject(repository: PaperProjectRepository): Promise<string> {
    const projectId = randomUUID(); const nodeId = randomUUID(); const sectionId = randomUUID(); const revisionId = randomUUID();
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    await local.db.insert(paperProjects).values({
      id: projectId, userId: 'user-a', selectedTitle: 'Zero-upload paper',
      profile: { schemaVersion: 1, researchIdea: 'zero upload', paperType: 'other', language: 'en' },
      researchPlan: { schemaVersion: 1, researchProblem: 'Problem', researchQuestions: ['Question'], researchObjectives: ['Objective'], methodology: { approach: 'review', methods: ['analysis'] }, dataMaterialRequirements: [], expectedContributions: ['Contribution'], limitationsAssumptions: [], keywords: ['writing'] },
    });
    await local.db.insert(paperOutlineNodes).values({ id: nodeId, projectId, userId: 'user-a', nodeType: 'writing-unit', title: 'Introduction', position: 0 });
    await local.db.insert(paperSections).values({ id: sectionId, projectId, userId: 'user-a', outlineNodeId: nodeId, sectionRole: 'OUTLINE', currentRevisionNumber: 1 });
    await local.db.insert(paperSectionRevisions).values({ id: revisionId, sectionId, userId: 'user-a', revisionNumber: 1, content: 'A truthful model-only body.', contentHash: hash('A truthful model-only body.'), origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [] });
    const bodyFingerprint = computeBodyFingerprint(await repository.loadManuscriptSnapshot('user-a', projectId));
    for (const [role, content] of [['ABSTRACT', 'A concise abstract.'], ['KEYWORDS', 'writing; workflow']] as const) {
      const derivedSectionId = randomUUID();
      await local.db.insert(paperSections).values({ id: derivedSectionId, projectId, userId: 'user-a', sectionRole: role, currentRevisionNumber: 1 });
      await local.db.insert(paperSectionRevisions).values({ sectionId: derivedSectionId, userId: 'user-a', revisionNumber: 1, content, contentHash: hash(content), origin: 'AI_GENERATION', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: { derivedFromBodyFingerprint: bodyFingerprint }, warnings: [] });
    }
    return projectId;
  }

  async function json(method: string, path: string, body?: unknown, userId = 'user-a') {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'x-test-user': userId, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() as any };
  }

  it('assembles, exports, lists, downloads, and owner-isolates an editable OOXML artifact', async () => {
    const manuscript = await json('GET', `/api/paper-projects/${projectId}/manuscript`);
    expect(manuscript).toMatchObject({ status: 200, body: { readiness: 'READY', citations: [], bibliography: [], exportPolicy: { cleanAllowed: true } } });
    const created = await json('POST', `/api/paper-projects/${projectId}/exports`, { format: 'DOCX', mode: 'CLEAN', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscript.body.manuscriptFingerprint });
    expect(created).toMatchObject({ status: 201, body: { format: 'DOCX', mode: 'CLEAN', manuscriptFingerprint: manuscript.body.manuscriptFingerprint } });
    expect(JSON.stringify(created.body)).not.toMatch(/bucketId|objectKey|self-hosted-filesystem/u);
    const listed = await json('GET', `/api/paper-projects/${projectId}/exports`);
    expect(listed.body).toHaveLength(1);
    const response = await fetch(`${baseUrl}/api/paper-projects/${projectId}/exports/${created.body.id}/download`, { headers: { 'x-test-user': 'user-a' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    expect(zip.file('word/document.xml')).not.toBeNull();
    expect(await zip.file('word/document.xml')!.async('string')).toContain('A truthful model-only body.');
    expect(await zip.file('docProps/core.xml')!.async('string')).toContain(`<dcterms:created xsi:type="dcterms:W3CDTF">${created.body.createdAt}</dcterms:created>`);
    expect((await json('GET', `/api/paper-projects/${projectId}/exports/${created.body.id}`, undefined, 'user-b')).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/paper-projects/${projectId}/exports/${created.body.id}/download`, { headers: { 'x-test-user': 'user-b' } })).status).toBe(404);
  });
});
