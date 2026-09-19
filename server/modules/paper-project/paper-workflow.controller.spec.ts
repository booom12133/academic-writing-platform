import { PaperWorkflowController } from './paper-workflow.controller';

describe('PaperWorkflowController owner-scoped section routes', () => {
  it('fails closed before reading revisions when the section is not in the routed project', async () => {
    const projects = { getSection: jest.fn().mockResolvedValue(null), listRevisions: jest.fn().mockResolvedValue([]) };
    const controller = new PaperWorkflowController(
      projects as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(controller.revisions({ userContext: { userId: 'user' } } as any, 'wrong-project', 'section'))
      .rejects.toMatchObject({ code: 'PAPER_PROJECT_NOT_FOUND' });
    expect(projects.listRevisions).not.toHaveBeenCalled();
  });
});
