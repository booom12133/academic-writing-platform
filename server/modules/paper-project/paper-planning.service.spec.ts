import { PaperPlanningService } from './paper-planning.service';

describe('PaperPlanningService provider mapping', () => {
  const project = {
    id: 'project',
    lockVersion: 0,
    selectedTitle: 'Title',
    profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' },
  };

  it('maps topic provider failures to a sanitized P4 error', async () => {
    const service = new PaperPlanningService(
      { require: jest.fn().mockResolvedValue(project) } as any,
      { generate: jest.fn().mockRejectedValue(new Error('provider secret details')) } as any,
      { generate: jest.fn() } as any,
      { generate: jest.fn() } as any,
    );

    await expect(service.generateTopics('user', 'project', { expectedLockVersion: 0 }))
      .rejects.toMatchObject({
        code: 'PAPER_GENERATION_PROVIDER_UNAVAILABLE',
        message: 'Paper generation provider is unavailable.',
      });
  });

  it('passes the selected title into Research Plan proposal generation without saving it', async () => {
    const plans = { generate: jest.fn().mockResolvedValue({ result: { schemaVersion: 1 } }) };
    const projects = { require: jest.fn().mockResolvedValue(project), updateRoot: jest.fn() };
    const service = new PaperPlanningService(projects as any, { generate: jest.fn() } as any, plans as any, { generate: jest.fn() } as any);

    await service.generateResearchPlan('user', 'project', { expectedLockVersion: 0, instructions: 'Keep it focused.' });

    expect(plans.generate).toHaveBeenCalledWith(project.profile, { selectedTitle: 'Title', instructions: 'Keep it focused.' });
    expect(projects.updateRoot).not.toHaveBeenCalled();
  });
});
