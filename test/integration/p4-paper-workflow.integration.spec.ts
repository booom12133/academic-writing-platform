import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../server/database/local-development.database';
import { PaperProjectRepository } from '../../server/modules/paper-project/paper-project.repository';
import { PaperWorkflowService } from '../../server/modules/paper-project/paper-workflow.service';
import { PaperGenerationService } from '../../server/modules/paper-project/paper-generation.service';
import { PaperPlanningService } from '../../server/modules/paper-project/paper-planning.service';
import { PaperProjectService } from '../../server/modules/paper-project/paper-project.service';

describe('P4 service/repository workflow integration fixtures', () => {
  let local: LocalDevelopmentDatabase;
  let repository: PaperProjectRepository;
  let workflow: PaperWorkflowService;
  beforeEach(async () => { local = await createLocalDevelopmentDatabase(); repository = new PaperProjectRepository(local.db); workflow = new PaperWorkflowService(repository); });
  afterEach(async () => local.close());

  async function projectAndSection() {
    const project = await repository.create('e2e-user', { profile: { schemaVersion: 1, researchIdea: 'Transparent academic drafting', paperType: 'literature-review', language: 'en' }, selectedTitle: 'Evidence-aware writing' });
    const saved = await workflow.saveOutline('e2e-user', project.id, { expectedLockVersion: 0, nodes: [{ clientKey: 'intro', nodeType: 'writing-unit', title: 'Introduction', position: 0 }] });
    return { project, section: saved.sections[0] };
  }

  it('E2E A: zero files survives generate, user save, rewrite, and reload', async () => {
    const profile = { schemaVersion: 1 as const, researchIdea: 'Transparent academic drafting', paperType: 'literature-review' as const, language: 'en' as const };
    const project = await repository.create('e2e-user', { profile });
    const plan = { schemaVersion: 1 as const, researchProblem: 'Evidence-aware drafting', researchQuestions: ['How can drafts stay transparent?'], researchObjectives: ['Build a transparent workflow'], methodology: { approach: 'literature review', methods: ['thematic synthesis'] }, dataMaterialRequirements: [], expectedContributions: ['A workflow'], limitationsAssumptions: [], keywords: ['academic writing'] };
    const planning = new PaperPlanningService(
      repository,
      { generate: jest.fn().mockResolvedValue({ resultData: { topics: [{ title: 'Evidence-aware writing', researchDirection: 'writing', innovation: 'transparent support', difficulty: 'moderate', keyIdeas: ['provenance'] }] }, metadata: { provider: 'fake', model: 'fixture' } }) } as any,
      { generate: jest.fn().mockResolvedValue({ result: plan, metadata: { provider: 'fake', model: 'fixture' } }) } as any,
      { generate: jest.fn().mockResolvedValue({ result: { nodes: [{ clientKey: 'intro', nodeType: 'writing-unit', title: 'Introduction', position: 0 }] }, metadata: { provider: 'fake', model: 'fixture' } }) } as any,
    );
    const projects = new PaperProjectService(repository);
    const topics = await planning.generateTopics('e2e-user', project.id, { expectedLockVersion: 0, count: 4 });
    const titled = await projects.selectTopic('e2e-user', project.id, { expectedLockVersion: 0, title: topics.resultData.topics[0].title });
    const planProposal = await planning.generateResearchPlan('e2e-user', project.id, { expectedLockVersion: titled.lockVersion });
    const planned = await projects.saveResearchPlan('e2e-user', project.id, { expectedLockVersion: titled.lockVersion, researchPlan: planProposal.result });
    const outlineProposal = await planning.generateOutline('e2e-user', project.id, { expectedLockVersion: planned.lockVersion });
    const outline = await workflow.saveOutline('e2e-user', project.id, { expectedLockVersion: planned.lockVersion, nodes: outlineProposal.result.nodes });
    const section = outline.sections[0];
    const model = { generate: jest.fn().mockResolvedValueOnce({ result: { content: 'Initial model draft', integrityWarnings: [] }, metadata: { provider: 'fake', model: 'fixture' } }).mockResolvedValueOnce({ result: { content: 'Rewritten model draft', integrityWarnings: [] }, metadata: { provider: 'fake', model: 'fixture' } }) };
    const grounded = { generate: jest.fn() };
    const generation = new PaperGenerationService(repository, { list: jest.fn() } as any, model as any, grounded as any);
    const initial = await generation.generate('e2e-user', project.id, section.id, { operation: 'GENERATE', sourceStrategy: 'MODEL_ONLY', expectedCurrentRevisionNumber: 0 });
    expect(initial).toMatchObject({ revisionCreated: true, revision: { actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [] } });
    const edited = await workflow.saveUserRevision('e2e-user', project.id, section.id, { expectedCurrentRevisionNumber: 1, baseRevisionId: initial.revisionCreated ? initial.revision.id : undefined, content: 'Manually edited draft' });
    const rewritten = await generation.generate('e2e-user', project.id, section.id, { operation: 'REWRITE', sourceStrategy: 'MODEL_ONLY', expectedCurrentRevisionNumber: 2, baseRevisionId: edited.revision!.id });
    expect(rewritten).toMatchObject({ revisionCreated: true, revision: { revisionNumber: 3, content: 'Rewritten model draft' } });
    const reloadedRepository = new PaperProjectRepository(local.db);
    expect(await reloadedRepository.listRevisions('e2e-user', section.id)).toHaveLength(3);
    expect(grounded.generate).not.toHaveBeenCalled();
  });

  it('E2E B: indexed user knowledge becomes valid support and edits preserve the old snapshot', async () => {
    const { project, section } = await projectAndSection();
    const trace = (version: string) => ({ evidenceId: `e-${version}`, provenance: { documentVersionId: version }, citationLocator: { documentVersionId: version, chunkId: `c-${version}` } });
    const grounded = { generate: jest.fn().mockResolvedValue({ status: 'grounded', content: 'Grounded [1].', citations: [{ citationId: 'c1', evidenceIds: ['e-user'] }], bibliography: [], evidenceTrace: [trace('user-v')], provenance: { selectedVersionIds: ['user-v', 'web-v'] }, generation: { provider: 'fake', model: 'fixture' } }) };
    const userSource = { id: 'user', documentVersionId: 'user-v', originClass: 'USER_KNOWLEDGE', selectionStatus: 'selected', evidenceAvailability: 'READY' };
    const generation = new PaperGenerationService(repository, { list: jest.fn().mockResolvedValue([userSource]) } as any, { generate: jest.fn() } as any, grounded as any);
    const user = await generation.generate('e2e-user', project.id, section.id, { operation: 'GENERATE', sourceStrategy: 'USER_KNOWLEDGE', expectedCurrentRevisionNumber: 0 });
    expect(user).toMatchObject({ revisionCreated: true, revision: { actualSupportMode: 'USER_EVIDENCE', supportState: 'VALID' } });
    const edited = await workflow.saveUserRevision('e2e-user', project.id, section.id, { expectedCurrentRevisionNumber: 1, baseRevisionId: user.revisionCreated ? user.revision.id : undefined, content: 'Edited grounded text' });
    expect(edited.revision?.supportState).toBe('STALE_AFTER_EDIT');
    const history = await repository.listRevisions('e2e-user', section.id);
    expect(history[1]).toMatchObject({ supportState: 'VALID', actualSupportMode: 'USER_EVIDENCE', evidenceTrace: [expect.objectContaining({ evidenceId: 'e-user-v' })] });
  });

  it('E2E C: indexed web full text grounds, while metadata-only fails closed', async () => {
    const { project, section } = await projectAndSection();
    const trace = { evidenceId: 'e-web', provenance: { documentVersionId: 'web-v' }, citationLocator: { documentVersionId: 'web-v', chunkId: 'c-web' } };
    const webSource = { id: 'web', documentVersionId: 'web-v', sourceRecordId: 'source-web', originClass: 'WEB_IMPORTED', selectionStatus: 'selected', evidenceAvailability: 'READY' };
    const grounded = { generate: jest.fn().mockResolvedValue({ status: 'grounded', content: 'Web-grounded [1].', citations: [{ citationId: 'c1', evidenceIds: ['e-web'] }], bibliography: [], evidenceTrace: [trace], provenance: { selectedVersionIds: ['web-v'] }, generation: { provider: 'fake', model: 'fixture' } }) };
    const ready = new PaperGenerationService(repository, { list: jest.fn().mockResolvedValue([webSource]) } as any, { generate: jest.fn() } as any, grounded as any);
    await expect(ready.generate('e2e-user', project.id, section.id, { operation: 'GENERATE', sourceStrategy: 'WEB_RETRIEVED', expectedCurrentRevisionNumber: 0 })).resolves.toMatchObject({ revisionCreated: true, revision: { actualSupportMode: 'WEB_EVIDENCE', supportState: 'VALID' } });

    const metadata = new PaperGenerationService(repository, { list: jest.fn().mockResolvedValue([{ ...webSource, documentVersionId: undefined, evidenceAvailability: 'METADATA_ONLY' }]) } as any, { generate: jest.fn() } as any, grounded as any);
    await expect(metadata.generate('e2e-user', project.id, section.id, { operation: 'GENERATE', sourceStrategy: 'WEB_RETRIEVED', expectedCurrentRevisionNumber: 1 })).resolves.toMatchObject({ revisionCreated: false, evidenceAvailability: 'METADATA_ONLY' });
    expect(await repository.listRevisions('e2e-user', section.id)).toHaveLength(1);
  });

  it('E2E D: mixed strategy reflects both origins or warns when only one was cited', async () => {
    const { project, section } = await projectAndSection();
    const trace = (version: string) => ({ evidenceId: `e-${version}`, provenance: { documentVersionId: version }, citationLocator: { documentVersionId: version, chunkId: `c-${version}` } });
    const userSource = { id: 'user', documentVersionId: 'user-v', originClass: 'USER_KNOWLEDGE', selectionStatus: 'selected', evidenceAvailability: 'READY' };
    const webSource = { id: 'web', documentVersionId: 'web-v', sourceRecordId: 'source-web', originClass: 'WEB_IMPORTED', selectionStatus: 'selected', evidenceAvailability: 'READY' };
    const grounded = { generate: jest.fn()
      .mockResolvedValueOnce({ status: 'grounded', content: 'Mixed [1][2].', citations: [], bibliography: [], evidenceTrace: [trace('user-v'), trace('web-v')], provenance: { selectedVersionIds: ['user-v', 'web-v'] }, generation: { provider: 'fake', model: 'fixture' } })
      .mockResolvedValueOnce({ status: 'grounded', content: 'User-only [1].', citations: [], bibliography: [], evidenceTrace: [trace('user-v')], provenance: { selectedVersionIds: ['user-v', 'web-v'] }, generation: { provider: 'fake', model: 'fixture' } }) };
    const mixed = new PaperGenerationService(repository, { list: jest.fn().mockResolvedValue([userSource, webSource]) } as any, { generate: jest.fn() } as any, grounded as any);
    const both = await mixed.generate('e2e-user', project.id, section.id, { operation: 'GENERATE', sourceStrategy: 'MIXED', expectedCurrentRevisionNumber: 0 });
    expect(both).toMatchObject({ revisionCreated: true, revision: { actualSupportMode: 'MIXED_EVIDENCE', warnings: [] } });
    const one = await mixed.generate('e2e-user', project.id, section.id, { operation: 'REWRITE', sourceStrategy: 'MIXED', expectedCurrentRevisionNumber: 1, baseRevisionId: both.revisionCreated ? both.revision.id : undefined });
    expect(one).toMatchObject({ revisionCreated: true, revision: { actualSupportMode: 'USER_EVIDENCE', warnings: ['Requested mixed evidence, but only user knowledge was cited.'] } });
  });
});
