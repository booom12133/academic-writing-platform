import { PaperProjectController } from './paper-project.controller';

describe('PaperProjectController workspace bootstrap', () => {
  it('returns the owned project, outline, sections, and live source state together', async () => {
    const project = { id: 'project', lockVersion: 2 };
    const outline = [{ id: 'node' }];
    const sections = [{ id: 'section' }];
    const sources = [{ id: 'source', evidenceAvailability: 'READY' }];
    const controller = new PaperProjectController(
      { get: jest.fn().mockResolvedValue(project) } as any,
      { listOutline: jest.fn().mockResolvedValue(outline), listSections: jest.fn().mockResolvedValue(sections) } as any,
      { list: jest.fn().mockResolvedValue(sources) } as any,
    );

    await expect(controller.get({ userContext: { userId: 'user' } } as any, 'project')).resolves.toEqual({
      project,
      outline,
      sections,
      sources,
    });
  });
});
