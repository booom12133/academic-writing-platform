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
});
