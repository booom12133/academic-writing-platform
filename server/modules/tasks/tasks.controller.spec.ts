jest.mock('@nestjs/common', () => ({
  Body: () => () => undefined,
  Controller: () => () => undefined,
  Delete: () => () => undefined,
  Get: () => () => undefined,
  Param: () => () => undefined,
  Patch: () => () => undefined,
  Post: () => () => undefined,
  Query: () => () => undefined,
  Req: () => () => undefined,
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: () => () => undefined,
}));

import { TasksController } from './tasks.controller';

describe('TasksController ownership boundary', () => {
  it('passes the authenticated user id to status updates', async () => {
    const updateTask = jest.fn().mockResolvedValue({ id: 'task-1' });
    const controller = new TasksController({ updateTask } as never);

    await controller.updateStatus(
      { userContext: { userId: 'user-1' } } as never,
      'task-1',
      { status: 'completed' },
    );

    expect(updateTask).toHaveBeenCalledWith('task-1', 'user-1', {
      status: 'completed',
      progress: undefined,
      resultData: undefined,
      errorMessage: undefined,
    });
  });
});
