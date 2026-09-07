jest.mock('@nestjs/common', () => ({
  BadRequestException: class BadRequestException extends Error {},
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
import { BadRequestException } from '@nestjs/common';

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

  it.each([
    ['invalid status', { status: 'unknown' }],
    ['negative progress', { progress: -1 }],
    ['over-limit progress', { progress: 101 }],
    ['fractional progress', { progress: 10.5 }],
    ['invalid resultData', { resultData: [] }],
    ['oversized resultData', { resultData: { value: 'x'.repeat(1024 * 1024 + 1) } }],
    ['invalid errorMessage', { errorMessage: 42 }],
    ['oversized errorMessage', { errorMessage: 'x'.repeat(4097) }],
  ])('rejects %s before touching the database', async (_name, body) => {
    const updateTask = jest.fn();
    const controller = new TasksController({ updateTask } as never);

    await expect(controller.updateStatus(
      { userContext: { userId: 'user-1' } } as never,
      'task-1',
      body as never,
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('accepts a bounded valid status patch', async () => {
    const updateTask = jest.fn().mockResolvedValue({ id: 'task-1' });
    const controller = new TasksController({ updateTask } as never);

    await expect(controller.updateStatus(
      { userContext: { userId: 'user-1' } } as never,
      'task-1',
      { status: 'processing', progress: 25, resultData: { ok: true }, errorMessage: 'retryable' },
    )).resolves.toEqual({ id: 'task-1' });
    expect(updateTask).toHaveBeenCalledWith('task-1', 'user-1', {
      status: 'processing',
      progress: 25,
      resultData: { ok: true },
      errorMessage: 'retryable',
    });
  });
});
