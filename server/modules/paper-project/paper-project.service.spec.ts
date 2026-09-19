import { PaperProjectService } from './paper-project.service';

describe('PaperProjectService project lifecycle', () => {
  it('validates strict input before persistence', async () => {
    const repository = { create: jest.fn() } as any;
    const service = new PaperProjectService(repository);

    await expect(service.create('user-a', {
      profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' },
      userId: 'spoofed',
    })).rejects.toMatchObject({ code: 'PAPER_PROJECT_INVALID_REQUEST' });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
