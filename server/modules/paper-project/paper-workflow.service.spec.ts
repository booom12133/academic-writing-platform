import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../database/local-development.database';
import { PaperProjectRepository } from './paper-project.repository';
import { PaperWorkflowService } from './paper-workflow.service';

describe('P4 outline and revision workflow', () => {
  let local: LocalDevelopmentDatabase;
  let repository: PaperProjectRepository;
  let service: PaperWorkflowService;
  beforeEach(async () => { local = await createLocalDevelopmentDatabase(); repository = new PaperProjectRepository(local.db); service = new PaperWorkflowService(repository); });
  afterEach(async () => local?.close());

  it('keeps stable sections, archives omitted nodes, and frees active sibling positions', async () => {
    const project = await repository.create('user-a', { profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    const first = await service.saveOutline('user-a', project.id, { expectedLockVersion: 0, nodes: [
      { clientKey: 'a', nodeType: 'writing-unit', title: 'A', position: 0 },
      { clientKey: 'b', nodeType: 'writing-unit', title: 'B', position: 1 },
    ] });
    const sectionA = first.sections.find((section) => section.outlineNodeId === first.nodes[0].id)!;
    const second = await service.saveOutline('user-a', project.id, { expectedLockVersion: 1, nodes: [
      { clientKey: 'b', id: first.nodes[1].id, nodeType: 'writing-unit', title: 'B', position: 0 },
    ] });
    expect(second.nodes).toHaveLength(1);
    expect((await repository.getSection('user-a', project.id, sectionA.id))?.status).toBe('orphaned');
  });

  it('creates immutable user revisions, marks grounded edits stale, and no-ops identical saves', async () => {
    const project = await repository.create('user-a', { profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    const outline = await service.saveOutline('user-a', project.id, { expectedLockVersion: 0, nodes: [{ clientKey: 's', nodeType: 'writing-unit', title: 'Section', position: 0 }] });
    const section = outline.sections[0];
    const ai = await repository.appendRevision('user-a', project.id, section.id, 0, { content: 'Grounded text', origin: 'AI_GENERATION', sourceStrategy: 'USER_KNOWLEDGE', actualSupportMode: 'USER_EVIDENCE', supportState: 'VALID', citations: [{ id: 'c1' }], bibliography: [], evidenceTrace: [{ evidenceId: 'e1' }], generationMetadata: {}, warnings: [] });
    const edited = await service.saveUserRevision('user-a', project.id, section.id, { expectedCurrentRevisionNumber: 1, baseRevisionId: ai.id, content: 'Grounded text edited' });
    expect(edited.revision?.supportState).toBe('STALE_AFTER_EDIT');
    expect((await repository.getRevision('user-a', section.id, ai.id))?.evidenceTrace).toHaveLength(1);
    const noOp = await service.saveUserRevision('user-a', project.id, section.id, { expectedCurrentRevisionNumber: 2, baseRevisionId: edited.revision!.id, content: 'Grounded text edited' });
    expect(noOp.noOp).toBe(true);
    expect(await repository.listRevisions('user-a', section.id)).toHaveLength(2);
  });

  it('rejects a stale identical save instead of bypassing revision concurrency', async () => {
    const project = await repository.create('user-a', { profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    const outline = await service.saveOutline('user-a', project.id, { expectedLockVersion: 0, nodes: [{ clientKey: 's', nodeType: 'writing-unit', title: 'Section', position: 0 }] });
    const section = outline.sections[0];
    await repository.appendRevision('user-a', project.id, section.id, 0, { content: 'Current text', origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [] });

    await expect(service.saveUserRevision('user-a', project.id, section.id, {
      expectedCurrentRevisionNumber: 0,
      content: 'Current text',
    })).rejects.toMatchObject({ code: 'PAPER_SECTION_REVISION_CONFLICT' });
  });

  it('remaps an orphaned section onto the blank section created for a new writing unit', async () => {
    const project = await repository.create('user-a', { profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    const first = await service.saveOutline('user-a', project.id, { expectedLockVersion: 0, nodes: [{ clientKey: 'old', nodeType: 'writing-unit', title: 'Old', position: 0 }] });
    const orphan = first.sections[0];
    await repository.appendRevision('user-a', project.id, orphan.id, 0, { content: 'Preserved history', origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [] });
    const second = await service.saveOutline('user-a', project.id, { expectedLockVersion: 1, nodes: [{ clientKey: 'new', nodeType: 'writing-unit', title: 'New', position: 0 }] });

    const remapped = await service.remap('user-a', project.id, orphan.id, {
      expectedLockVersion: 2,
      targetOutlineNodeId: second.nodes[0].id,
    });

    expect(remapped.section).toMatchObject({ id: orphan.id, outlineNodeId: second.nodes[0].id, status: 'active', currentRevisionNumber: 1 });
    expect(await repository.listSections('user-a', project.id)).toHaveLength(1);
    expect(await repository.listRevisions('user-a', orphan.id)).toHaveLength(1);
  });
});
