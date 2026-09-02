import type { Task } from '@shared/api.interface';
import type { ChunkedTaskContext } from '../../chunking/chunking.types';
import type { AcademicToolExecutionResult } from '../execution/tool-execution.types';
import type { ToolSubmissionPreparationService } from '../execution/tool-submission-preparation.service';
import type { TasksService } from '../../tasks/tasks.service';
import type { AcademicToolExecutionService } from '../execution/academic-tool-execution.service';
import type { PaperRevisionChunkExecutor } from './paper-revision-chunk.executor';
import type { PaperRevisionResultAggregator } from './paper-revision-result.aggregator';
import { PaperRevisionSubmissionService } from './paper-revision-submission.service';

const preparedContext = {} as ChunkedTaskContext;
const preparedExecution = {} as AcademicToolExecutionResult;

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  userId: 'user-1',
  taskType: 'paper-revision',
  title: 'Revision task',
  status: 'pending',
  progress: 0,
  pointsCost: 30,
  inputData: { inputMode: 'text', text: 'source' },
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
  ...overrides,
});

const request = {
  userId: 'user-1',
  title: 'Revision task',
  inputData: {
    inputMode: 'text' as const,
    text: 'source',
    revisionTypes: ['logic', 'discussion'],
    requirements: 'Preserve citations.',
    wordCount: 1,
    pointsCost: 1,
  },
};

describe('PaperRevisionSubmissionService', () => {
  it('prepares with the server policy and returns before deferred execution completes', async () => {
    let resolveExecution!: (value: AcademicToolExecutionResult) => void;
    const executionPromise = new Promise<AcademicToolExecutionResult>((resolve) => {
      resolveExecution = resolve;
    });
    const calls: string[] = [];
    const preparation = {
      prepareBeforeBilling: jest.fn(async (input, callback) => {
        expect(input).toMatchObject({
          taskType: 'paper-revision',
          chunkingPolicy: { maxSize: 2000 },
          source: { mode: 'text', text: 'source' },
        });
        return callback({ context: preparedContext });
      }),
    };
    const created = task();
    const processing = task({ status: 'processing', progress: 10 });
    const completed = task({ status: 'completed', progress: 100, resultData: { revisedContent: 'done' } });
    const tasks = {
      createTask: jest.fn(async (input) => {
        calls.push('create');
        expect(input).toEqual({
          userId: 'user-1',
          taskType: 'paper-revision',
          title: 'Revision task',
          inputData: request.inputData,
        });
        return created;
      }),
      updateTask: jest.fn(async (_taskId, patch) => {
        calls.push(patch.status ?? 'patch');
        return patch.status === 'processing' ? processing : completed;
      }),
    };
    const execution = {
      render: jest.fn().mockReturnValue([{ section: 'content', eligibleForExecution: true }]),
      execute: jest.fn(async () => {
        calls.push('execute');
        return executionPromise;
      }),
    };
    const executor = { execute: jest.fn() };
    const aggregator = { aggregate: jest.fn().mockReturnValue({ revisedContent: 'done' }) };
    const service = new PaperRevisionSubmissionService(
      preparation as unknown as ToolSubmissionPreparationService,
      tasks as unknown as TasksService,
      execution as unknown as AcademicToolExecutionService,
      executor as unknown as PaperRevisionChunkExecutor,
      aggregator as unknown as PaperRevisionResultAggregator,
    );

    const returned = await service.submit(request);

    expect(returned).toEqual(processing);
    expect(calls.slice(0, 2)).toEqual(['create', 'processing']);
    expect(execution.execute).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(execution.execute).toHaveBeenCalledWith(
      preparedContext,
      executor,
      { revisionTypes: ['logic', 'discussion'] },
    );

    resolveExecution(preparedExecution);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(aggregator.aggregate).toHaveBeenCalledWith(preparedExecution);
    expect(tasks.updateTask).toHaveBeenLastCalledWith('task-1', {
      status: 'completed',
      progress: 100,
      resultData: { revisedContent: 'done' },
    });
  });

  it('does not create or charge a Task when preparation fails', async () => {
    const preparation = {
      prepareBeforeBilling: jest.fn().mockRejectedValue(new Error('foreign document')),
    };
    const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
    const execution = { render: jest.fn(), execute: jest.fn() };
    const service = new PaperRevisionSubmissionService(
      preparation as unknown as ToolSubmissionPreparationService,
      tasks as unknown as TasksService,
      execution as unknown as AcademicToolExecutionService,
      { execute: jest.fn() } as unknown as PaperRevisionChunkExecutor,
      { aggregate: jest.fn() } as unknown as PaperRevisionResultAggregator,
    );

    await expect(service.submit(request)).rejects.toThrow('foreign document');
    expect(tasks.createTask).not.toHaveBeenCalled();
    expect(tasks.updateTask).not.toHaveBeenCalled();
    expect(execution.execute).not.toHaveBeenCalled();
  });

  it('rejects empty and References-only preparation before Task creation', async () => {
    for (const rendered of [
      [],
      [{ section: 'references', eligibleForExecution: false }],
    ]) {
      const preparation = {
        prepareBeforeBilling: jest.fn(async (_input, callback) => callback({ context: preparedContext })),
      };
      const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
      const execution = { render: jest.fn().mockReturnValue(rendered), execute: jest.fn() };
      const service = new PaperRevisionSubmissionService(
        preparation as unknown as ToolSubmissionPreparationService,
        tasks as unknown as TasksService,
        execution as unknown as AcademicToolExecutionService,
        { execute: jest.fn() } as unknown as PaperRevisionChunkExecutor,
        { aggregate: jest.fn() } as unknown as PaperRevisionResultAggregator,
      );

      await expect(service.submit(request)).rejects.toThrow('executable content');
      expect(tasks.createTask).not.toHaveBeenCalled();
      expect(tasks.updateTask).not.toHaveBeenCalled();
      expect(execution.execute).not.toHaveBeenCalled();
    }
  });

  it('fails fast when processing cannot be persisted and does not schedule execution', async () => {
    const preparation = {
      prepareBeforeBilling: jest.fn(async (_input, callback) => callback({ context: preparedContext })),
    };
    const tasks = {
      createTask: jest.fn().mockResolvedValue(task()),
      updateTask: jest.fn().mockResolvedValue(null),
    };
    const execution = {
      render: jest.fn().mockReturnValue([{ section: 'content', eligibleForExecution: true }]),
      execute: jest.fn(),
    };
    const service = new PaperRevisionSubmissionService(
      preparation as unknown as ToolSubmissionPreparationService,
      tasks as unknown as TasksService,
      execution as unknown as AcademicToolExecutionService,
      { execute: jest.fn() } as unknown as PaperRevisionChunkExecutor,
      { aggregate: jest.fn() } as unknown as PaperRevisionResultAggregator,
    );

    await expect(service.submit(request)).rejects.toThrow('processing');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tasks.updateTask).toHaveBeenCalledTimes(1);
    expect(execution.execute).not.toHaveBeenCalled();
  });

  it('marks the Task failed after an execution error without persisting partial output', async () => {
    const preparation = {
      prepareBeforeBilling: jest.fn(async (_input, callback) => callback({ context: preparedContext })),
    };
    const tasks = {
      createTask: jest.fn().mockResolvedValue(task()),
      updateTask: jest.fn(async (_taskId, patch) =>
        patch.status === 'processing'
          ? task({ status: 'processing', progress: 10 })
          : task({ status: 'failed', progress: 100, errorMessage: 'first chunk failed' })),
    };
    const execution = {
      render: jest.fn().mockReturnValue([{ section: 'content', eligibleForExecution: true }]),
      execute: jest.fn().mockRejectedValue(new Error('first chunk failed')),
    };
    const aggregator = { aggregate: jest.fn() };
    const service = new PaperRevisionSubmissionService(
      preparation as unknown as ToolSubmissionPreparationService,
      tasks as unknown as TasksService,
      execution as unknown as AcademicToolExecutionService,
      { execute: jest.fn() } as unknown as PaperRevisionChunkExecutor,
      aggregator as unknown as PaperRevisionResultAggregator,
    );

    await expect(service.submit(request)).resolves.toMatchObject({ status: 'processing' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(execution.execute).toHaveBeenCalledTimes(1);
    expect(aggregator.aggregate).not.toHaveBeenCalled();
    expect(tasks.updateTask).toHaveBeenLastCalledWith('task-1', {
      status: 'failed',
      progress: 100,
      errorMessage: 'first chunk failed',
    });
    expect(tasks.updateTask.mock.calls.some((call) => call[1].status === 'completed')).toBe(false);
    expect(tasks.updateTask.mock.calls.some((call) => call[1].resultData !== undefined)).toBe(false);
  });
});
