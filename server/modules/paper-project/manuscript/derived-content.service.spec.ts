import { DerivedContentService } from './derived-content.service';
import type { ManuscriptSnapshot } from '../../../../shared/manuscript.interface';
import { computeBodyFingerprint, computeConclusionBasisFingerprint } from './manuscript-fingerprint';

const snapshot = (): ManuscriptSnapshot => ({
  project: { id: 'project', selectedTitle: 'Title', profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' }, defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  outline: [{ id: 'node', nodeType: 'writing-unit', title: 'Conclusion', position: 0, status: 'active', sectionId: 'section' }],
  sections: [{ id: 'section', outlineNodeId: 'node', status: 'active', currentRevisionNumber: 1, sectionRole: 'OUTLINE' }],
  revisionsBySectionId: { section: { id: 'revision', sectionId: 'section', revisionNumber: 1, content: 'Existing conclusion', contentHash: 'a'.repeat(64), origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' } },
});

describe('DerivedContentService', () => {
  it('creates an immutable MODEL_ONLY abstract revision with its body basis and bounded-context metadata', async () => {
    const state = snapshot();
    const derivedSection = { id: 'abstract', sectionRole: 'ABSTRACT' as const, status: 'active' as const, currentRevisionNumber: 0 };
    const revision = { id: 'abstract-revision', sectionId: 'abstract', revisionNumber: 1, content: 'Abstract', contentHash: 'c'.repeat(64), origin: 'AI_GENERATION' as const, sourceStrategy: 'MODEL_ONLY' as const, actualSupportMode: 'AI_DRAFT' as const, supportState: 'NOT_CLAIMED' as const, citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' };
    const repository = {
      loadManuscriptSnapshot: jest.fn().mockResolvedValue(state),
      getOrCreateDerivedSection: jest.fn().mockResolvedValue(derivedSection),
      appendRevision: jest.fn().mockResolvedValue(revision),
    };
    const service = new DerivedContentService(repository as any, { generate: jest.fn().mockResolvedValue({ content: '{"content":"Abstract"}', provider: 'fake', model: 'fake' }) } as any);
    const fingerprint = computeBodyFingerprint(state);

    const result = await service.generateDerived('user', 'project', 'ABSTRACT', { expectedBodyFingerprint: fingerprint, expectedCurrentRevisionNumber: 0 });

    expect(result).toMatchObject({ derivedState: 'CURRENT', bodyFingerprint: fingerprint, revision });
    expect(repository.appendRevision).toHaveBeenCalledWith('user', 'project', 'abstract', 0, expect.objectContaining({
      sourceStrategy: 'MODEL_ONLY', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [],
      generationMetadata: expect.objectContaining({ operation: 'DERIVED_GENERATION', derivedRole: 'ABSTRACT', derivedFromBodyFingerprint: fingerprint }),
    }));
  });

  it('rechecks a consistent post-generation body fingerprint before appending a derived revision', async () => {
    const before = snapshot();
    const after = snapshot();
    after.project.selectedTitle = 'Changed';
    const repository = {
      loadManuscriptSnapshot: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
      getOrCreateDerivedSection: jest.fn(), appendRevision: jest.fn(),
    };
    const service = new DerivedContentService(repository as any, { generate: jest.fn().mockResolvedValue({ content: '{"content":"Abstract"}', provider: 'fake', model: 'fake' }) } as any);

    await expect(service.generateDerived('user', 'project', 'ABSTRACT', { expectedBodyFingerprint: computeBodyFingerprint(before), expectedCurrentRevisionNumber: 0 })).rejects.toMatchObject({ code: 'PAPER_MANUSCRIPT_CHANGED' });
    expect(repository.appendRevision).not.toHaveBeenCalled();
  });

  it('fails closed on malformed structured output without creating a revision', async () => {
    const state = snapshot();
    const repository = { loadManuscriptSnapshot: jest.fn().mockResolvedValue(state), getOrCreateDerivedSection: jest.fn(), appendRevision: jest.fn() };
    const service = new DerivedContentService(repository as any, { generate: jest.fn().mockResolvedValue({ content: '{}', provider: 'fake', model: 'fake' }) } as any);
    await expect(service.generateDerived('user', 'project', 'KEYWORDS', { expectedBodyFingerprint: computeBodyFingerprint(state), expectedCurrentRevisionNumber: 0 })).rejects.toMatchObject({ code: 'PAPER_GENERATION_INVALID_RESPONSE' });
    expect(repository.appendRevision).not.toHaveBeenCalled();
  });

  it('computes a conclusion basis that excludes only the target revision', () => {
    const before = snapshot();
    const refreshedTarget = snapshot();
    refreshedTarget.revisionsBySectionId.section = { ...refreshedTarget.revisionsBySectionId.section!, id: 'new-target', revisionNumber: 2, contentHash: 'b'.repeat(64), content: 'Refreshed' };
    expect(computeConclusionBasisFingerprint(before, 'section')).toBe(computeConclusionBasisFingerprint(refreshedTarget, 'section'));
    refreshedTarget.project.selectedTitle = 'Changed title';
    expect(computeConclusionBasisFingerprint(before, 'section')).not.toBe(computeConclusionBasisFingerprint(refreshedTarget, 'section'));
  });
});
