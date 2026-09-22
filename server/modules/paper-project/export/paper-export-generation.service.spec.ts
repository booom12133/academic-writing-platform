import type { ManuscriptProjectionV1, ManuscriptSnapshot } from '@shared/manuscript.interface';
import { PaperExportGenerationService } from './paper-export-generation.service';

const userId = 'user-a';
const projectId = '550e8400-e29b-41d4-a716-446655440000';
const nodeId = '550e8400-e29b-41d4-a716-446655440010';
const sectionId = '550e8400-e29b-41d4-a716-446655440020';
const revisionId = '550e8400-e29b-41d4-a716-446655440030';
const bodyFingerprint = 'a'.repeat(64);
const manuscriptFingerprint = 'b'.repeat(64);

const snapshot = {
  project: { id: projectId, selectedTitle: 'Paper', profile: { schemaVersion: 1, researchIdea: 'x', paperType: 'other', language: 'en' }, defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0, createdAt: '', updatedAt: '' },
  outline: [{ id: nodeId, nodeType: 'writing-unit', title: 'Body', position: 0, status: 'active', sectionId }],
  sections: [{ id: sectionId, outlineNodeId: nodeId, sectionRole: 'OUTLINE', status: 'active', currentRevisionNumber: 1 }],
  revisionsBySectionId: { [sectionId]: { id: revisionId, sectionId, revisionNumber: 1, content: 'Body', contentHash: 'c'.repeat(64), origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '' } },
} as ManuscriptSnapshot;

const projection = {
  schemaVersion: 1, projectId, title: 'Paper', language: 'en', bodyFingerprint, manuscriptFingerprint,
  readiness: 'INCOMPLETE', wordCount: 1, blocks: [],
  outline: [{ nodeId, sectionId, title: 'Body', depth: 0, nodeType: 'writing-unit', currentRevisionNumber: 1 }],
  derived: { abstract: { role: 'ABSTRACT', state: 'MISSING' }, keywords: { role: 'KEYWORDS', state: 'MISSING' } },
  supportSummary: { validSections: 0, staleSections: 0, notClaimedSections: 1, missingSections: 0, managedCitationCount: 0, bibliographyEntryCount: 0, bibliographyState: 'NONE' },
  citations: [], bibliography: [], warnings: [{ code: 'DERIVED_CONTENT_MISSING', severity: 'warning', message: 'missing' }],
  exportPolicy: { cleanAllowed: false, draftAllowed: true, acknowledgementCodes: ['DERIVED_CONTENT_MISSING'] },
} as ManuscriptProjectionV1;

describe('PaperExportGenerationService', () => {
  const repository = { loadManuscriptSnapshot: jest.fn() };
  const projections = { project: jest.fn() };
  const renderer = { format: 'DOCX', rendererVersion: '1', render: jest.fn() };
  const artifacts = { persistRenderedArtifact: jest.fn() };
  const service = new PaperExportGenerationService(repository as never, projections as never, renderer as never, artifacts as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.loadManuscriptSnapshot.mockResolvedValue(snapshot);
    projections.project.mockReturnValue(projection);
    renderer.render.mockResolvedValue({ buffer: Buffer.from('docx'), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' });
    artifacts.persistRenderedArtifact.mockImplementation(async (input) => ({ id: input.exportId, manifest: input.manifest }));
  });

  it('rejects stale fingerprints, clean-incomplete export, and unacknowledged draft warnings', async () => {
    const base = { format: 'DOCX', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscriptFingerprint };
    await expect(service.create(userId, projectId, { ...base, mode: 'CLEAN' })).rejects.toMatchObject({ code: 'PAPER_EXPORT_POLICY_CONFLICT' });
    await expect(service.create(userId, projectId, { ...base, mode: 'DRAFT' })).rejects.toMatchObject({ code: 'PAPER_EXPORT_POLICY_CONFLICT', details: { requiredWarningCodes: ['DERIVED_CONTENT_MISSING'] } });
    await expect(service.create(userId, projectId, { ...base, mode: 'DRAFT', expectedManuscriptFingerprint: 'd'.repeat(64), acknowledgedWarningCodes: ['DERIVED_CONTENT_MISSING'] })).rejects.toMatchObject({ code: 'PAPER_EXPORT_FINGERPRINT_CONFLICT', details: { currentManuscriptFingerprint: manuscriptFingerprint } });
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('uses one exportId/createdAt across renderer, manifest, and persisted row', async () => {
    await service.create(userId, projectId, {
      format: 'DOCX', mode: 'DRAFT', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscriptFingerprint,
      acknowledgedWarningCodes: ['DERIVED_CONTENT_MISSING'],
    });
    const options = renderer.render.mock.calls[0][1];
    const persisted = artifacts.persistRenderedArtifact.mock.calls[0][0];
    expect(persisted.exportId).toBe(options.exportId);
    expect(persisted.createdAt).toBe(options.createdAt);
    expect(persisted.manifest).toMatchObject({ exportId: options.exportId, createdAt: options.createdAt, bodyRevisions: [{ sectionId, revisionId, revisionNumber: 1, contentHash: 'c'.repeat(64) }] });
    expect(persisted.manifest.warnings).toEqual([{ code: 'DERIVED_CONTENT_MISSING' }]);
  });

  it('rejects archived projects and unknown request keys', async () => {
    repository.loadManuscriptSnapshot.mockResolvedValueOnce({ ...snapshot, project: { ...snapshot.project, status: 'archived' } });
    const request = { format: 'DOCX', mode: 'DRAFT', templateKey: 'generic-academic-v1', expectedManuscriptFingerprint: manuscriptFingerprint, acknowledgedWarningCodes: ['DERIVED_CONTENT_MISSING'] };
    await expect(service.create(userId, projectId, request)).rejects.toMatchObject({ code: 'PAPER_PROJECT_ARCHIVED' });
    await expect(service.create(userId, projectId, { ...request, userId })).rejects.toMatchObject({ code: 'PAPER_PROJECT_INVALID_REQUEST' });
  });
});
