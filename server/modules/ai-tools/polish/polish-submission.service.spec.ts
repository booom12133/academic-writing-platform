import type { Task } from '@shared/api.interface';
import type { ChunkedTaskContext } from '../../chunking/chunking.types';
import type { AcademicToolExecutionResult } from '../execution/tool-execution.types';
import type { ToolSubmissionPreparationService } from '../execution/tool-submission-preparation.service';
import type { TasksService } from '../../tasks/tasks.service';
import type { AcademicToolExecutionService } from '../execution/academic-tool-execution.service';
import type { PolishChunkExecutor } from './polish-chunk.executor';
import type { PolishBillingService } from './polish-billing.service';
import { PolishResultAggregator } from './polish-result.aggregator';
import { PolishSubmissionService } from './polish-submission.service';
import type { PolishSubmissionRequest } from './polish-input.types';

const preparedContext = {} as ChunkedTaskContext;
const preparedExecution = {} as AcademicToolExecutionResult;

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  userId: 'user-1',
  taskType: 'polish',
  title: 'Polish task',
  status: 'pending',
  progress: 0,
  pointsCost: 30,
  inputData: { inputMode: 'text', text: 'source' },
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
});

const request: PolishSubmissionRequest = {
  userId: 'user-1',
  title: 'Polish task',
  inputData: {
    inputMode: 'text',
    text: 'source',
    requirements: 'Keep terminology stable.',
    polishType: 'academic',
    language: 'en',
    wordCount: 1,
    pointsCost: 1,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('PolishSubmissionService', () => {
  it('returns processing Task before deferred execution completes', async () => {
    const executionDeferred = deferred<AcademicToolExecutionResult>();
    const calls: string[] = [];
    const preparation = {
      prepareBeforeBilling: jest.fn(async (_input, callback) => callback({ context: preparedContext })),
    };
    const billing = {
      calculate: jest.fn().mockReturnValue({ billingText: 'source', charCount: 6, pointsCost: 10 }),
    };
    const created = task();
    const processing = task({ status: 'processing', progress: 10 });
    const completed = task({ status: 'completed', progress: 100, resultData: { revisedContent: 'done' } });
    const tasks = {
      createPreparedPolishTask: jest.fn(async () => {
        calls.push('create');
        return created;
      }),
      updateTask: jest.fn(async (_taskId, patch) => {
        calls.push(patch.status ?? 'patch');
        return patch.status === 'processing' ? processing : completed;
      }),
    };
    const execution = {
      execute: jest.fn(async () => {
        calls.push('execute');
        return executionDeferred.promise;
      }),
    };
    const executor = { execute: jest.fn() };
    const aggregator = { aggregate: jest.fn().mockReturnValue({ revisedContent: 'done' }) };
    const service = new PolishSubmissionService(
      preparation as unknown as ToolSubmissionPreparationService,
      billing as unknown as PolishBillingService,
      tasks as unknown as TasksService,
      execution as unknown as AcademicToolExecutionService,
      executor as unknown as PolishChunkExecutor,
      aggregator as unknown as PolishResultAggregator,
    );

    const submitPromise = service.submit(request);
    const returned = await submitPromise;

    expect(returned).toEqual(processing);
    expect(calls.slice(0, 2)).toEqual(['create', 'processing']);
    expect(billing.calculate).toHaveBeenCalledWith(preparedContext);
    expect(execution.execute).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(execution.execute).toHaveBeenCalledWith(preparedContext, executor, {
      polishType: 'academic',
      language: 'en',
    });

    executionDeferred.resolve(preparedExecution);
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
    const billing = { calculate: jest.fn() };
    const tasks = { createPreparedPolishTask: jest.fn(), updateTask: jest.fn() };
    const execution = { execute: jest.fn() };
    const executor = { execute: jest.fn() };
    const aggregator = { aggregate: jest.fn() };
    const service = new PolishSubmissionService(
      preparation as unknown as ToolSubmissionPreparationService,
      billing as unknown as PolishBillingService,
      tasks as unknown as TasksService,
      execution as unknown as AcademicToolExecutionService,
      executor as unknown as PolishChunkExecutor,
      aggregator as unknown as PolishResultAggregator,
    );

    await expect(service.submit(request)).rejects.toThrow('foreign document');

    expect(tasks.createPreparedPolishTask).not.toHaveBeenCalled();
    expect(tasks.updateTask).not.toHaveBeenCalled();
    expect(billing.calculate).not.toHaveBeenCalled();
    expect(execution.execute).not.toHaveBeenCalled();
  });
});
