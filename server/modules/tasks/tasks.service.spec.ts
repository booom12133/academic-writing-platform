jest.mock('@server/database/schema', () => ({
  appUsers: { points: {}, memberLevel: {}, userId: {} },
  pointRecords: {},
  tasks: { id: {}, userId: {}, taskType: {}, createdAt: {} },
}), { virtual: true });
jest.mock('drizzle-orm', () => ({
  and: jest.fn(),
  count: jest.fn(),
  desc: jest.fn(),
  eq: jest.fn(),
}));
jest.mock('@shared/api.interface', () => ({
  TOOL_CONFIGS: [{ type: 'polish', name: '语法润色', basePoints: 10 }],
}), { virtual: true });

import { appUsers, pointRecords, tasks } from '@server/database/schema';
import type { Task } from '@shared/api.interface';
import { and, eq } from 'drizzle-orm';
import { TasksService } from './tasks.service';

const now = new Date('2026-09-02T00:00:00.000Z');

function createDbHarness(inputData: Record<string, unknown>, pointsCost: number) {
  const insertedRow = {
    id: 'task-1',
    userId: 'user-1',
    taskType: 'polish',
    title: 'Prepared polish',
    status: 'pending',
    progress: 0,
    pointsCost,
    inputData,
    resultData: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  const tx = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ points: 100, memberLevel: 'normal' }]),
        }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    }),
    insert: jest.fn((table: unknown) => {
      if (table === tasks) {
        return {
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([insertedRow]),
          }),
        };
      }
      return { values: jest.fn().mockResolvedValue([]) };
    }),
  };
  const db = {
    transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<Task>) => callback(tx)),
  };
  return { db, tx, insertedRow };
}

describe('TasksService prepared Polish seam', () => {
  it('calculates points from trusted prepared billing text, not client fields', async () => {
    const inputData = {
      inputMode: 'text',
      text: 'client text',
      wordCount: 1,
      pointsCost: 1,
    };
    const preparedBillingText = 'x'.repeat(1001);
    const { db, tx } = createDbHarness(inputData, 30);
    const service = new TasksService(db as never);

    const task = await service.createPreparedPolishTask({
      userId: 'user-1',
      title: 'Prepared polish',
      inputData,
      preparedBillingText,
    });

    expect(task.pointsCost).toBe(30);
    expect(tx.insert).toHaveBeenCalledWith(tasks);
    const taskValues = tx.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(taskValues).toEqual(expect.objectContaining({
      userId: 'user-1',
      taskType: 'polish',
      pointsCost: 30,
      inputData,
    }));
    expect(tx.insert).toHaveBeenCalledWith(pointRecords);
    expect(tx.insert).not.toHaveBeenCalledWith(appUsers);
  });

  it('keeps the generic createTask Polish metric based on its existing input path', async () => {
    const inputData = { text: 'x'.repeat(501) };
    const { db, tx } = createDbHarness(inputData, 20);
    const service = new TasksService(db as never);

    const task = await service.createTask({
      userId: 'user-1',
      taskType: 'polish',
      title: 'Legacy polish',
      inputData,
    });

    expect(task.pointsCost).toBe(20);
    const taskValues = tx.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(taskValues.pointsCost).toBe(20);
  });

  it('keeps status updates scoped to both task id and authenticated owner', async () => {
    (eq as jest.Mock).mockImplementation((column: unknown, value: unknown) => ({ column, value }));
    (and as jest.Mock).mockImplementation((...conditions: unknown[]) => conditions);
    const where = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([]),
    });
    const db = {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({ where }),
      }),
    };
    const service = new TasksService(db as never);

    await expect(service.updateTask('task-1', 'user-2', { status: 'failed' })).resolves.toBeNull();

    expect(where).toHaveBeenCalledWith([
      { column: tasks.id, value: 'task-1' },
      { column: tasks.userId, value: 'user-2' },
    ]);
  });
});
