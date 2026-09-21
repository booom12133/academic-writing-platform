import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../database/local-development.database';
import { paperSectionRevisions, paperSections } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { PaperProjectRepository } from './paper-project.repository';

describe('PaperProjectRepository', () => {
  let local: LocalDevelopmentDatabase;
  let repository: PaperProjectRepository;

  beforeEach(async () => {
    local = await createLocalDevelopmentDatabase();
    repository = new PaperProjectRepository(local.db);
  });

  afterEach(async () => local.close());

  it('persists owner-scoped projects and archives with optimistic concurrency', async () => {
    const profile = {
      schemaVersion: 1 as const,
      researchIdea: 'A zero-upload project',
      paperType: 'literature-review' as const,
      language: 'en' as const,
    };
    const created = await repository.create('user-a', { profile });

    expect((await repository.list('user-a')).map((project) => project.id)).toEqual([created.id]);
    expect(await repository.get('user-b', created.id)).toBeNull();

    const updated = await repository.updateRoot('user-a', created.id, 0, {
      selectedTitle: 'Transparent academic drafting',
    });
    expect(updated.lockVersion).toBe(1);
    await expect(repository.updateRoot('user-a', created.id, 0, { selectedTitle: 'Lost update' }))
      .rejects.toMatchObject({ code: 'PAPER_PROJECT_VERSION_CONFLICT' });

    const archived = await repository.archive('user-a', created.id, 1);
    expect(archived.status).toBe('archived');
    expect(await repository.list('user-a')).toEqual([]);
    expect((await repository.list('user-a', 'archived'))).toHaveLength(1);
  });

  it('maps concurrent revision writers to one success and one domain conflict', async () => {
    const project = await repository.create('user-a', { profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    const outline = await repository.replaceOutline('user-a', project.id, 0, [{ clientKey: 's', nodeType: 'writing-unit', title: 'Section', position: 0 }]);
    const section = outline.sections[0];
    const revision = (content: string) => repository.appendRevision('user-a', project.id, section.id, 0, {
      content,
      origin: 'USER_EDIT',
      sourceStrategy: 'MODEL_ONLY',
      actualSupportMode: 'AI_DRAFT',
      supportState: 'NOT_CLAIMED',
      citations: [],
      bibliography: [],
      evidenceTrace: [],
      generationMetadata: {},
      warnings: [],
    });

    const results = await Promise.allSettled([revision('Writer A'), revision('Writer B')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ code: 'PAPER_SECTION_REVISION_CONFLICT' });
    expect(await repository.listRevisions('user-a', section.id)).toHaveLength(1);
  });

  it('loads exact current revisions in a repeatable-read read-only transaction and rejects a higher hidden revision', async () => {
    const project = await repository.create('user-a', { profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    const outline = await repository.replaceOutline('user-a', project.id, 0, [{ clientKey: 's', nodeType: 'writing-unit', title: 'Section', position: 0 }]);
    const section = outline.sections[0];
    const current = await repository.appendRevision('user-a', project.id, section.id, 0, {
      content: 'Current', origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [],
    });
    const transaction = jest.spyOn(local.db, 'transaction');

    const snapshot = await repository.loadManuscriptSnapshot('user-a', project.id);
    expect(snapshot.revisionsBySectionId[section.id]?.id).toBe(current.id);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    });

    await local.db.insert(paperSectionRevisions).values({
      sectionId: section.id, userId: 'user-a', revisionNumber: 2, content: 'Hidden newer revision', contentHash: 'a'.repeat(64), origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [],
    });
    await local.db.update(paperSections).set({ currentRevisionNumber: 1 }).where(eq(paperSections.id, section.id));
    await expect(repository.loadManuscriptSnapshot('user-a', project.id)).rejects.toMatchObject({
      code: 'PAPER_MANUSCRIPT_INTEGRITY_FAILURE',
    });
  });
});
