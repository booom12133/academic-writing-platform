import type { Task } from '@shared/api.interface';
import { adaptTaskResult } from '../../client/src/lib/task-result';
import {
  buildContinueState,
  buildRerunPayload,
  exportTaskResult,
  readContinueState,
} from '../../client/src/lib/task-actions';

const documentRef = {
  version: 1 as const,
  provider: 'platform-file' as const,
  bucketId: 'bucket-1',
  filePath: 'documents/a.pdf',
  fileName: 'a.pdf',
  sourceType: 'pdf' as const,
  sizeBytes: 10,
  sha256: 'a'.repeat(64),
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    userId: 'user-1',
    taskType: 'polish',
    title: '润色任务',
    status: 'completed',
    progress: 100,
    pointsCost: 10,
    inputData: {
      inputMode: 'file',
      documentRef,
      polishType: 'academic',
      requirements: '保留术语',
      wordCount: 100,
      userId: 'attacker',
      taskId: 'other-task',
    },
    resultData: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('task actions', () => {
  it('builds a rerun payload with only approved production input fields', () => {
    const payload = buildRerunPayload(task());

    expect(payload).toEqual({
      taskType: 'polish',
      title: '润色任务',
      inputData: {
        inputMode: 'file',
        documentRef,
        polishType: 'academic',
        requirements: '保留术语',
      },
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload.inputData).not.toHaveProperty('userId');
    expect(payload.inputData).not.toHaveProperty('taskId');
  });

  it('builds continue state only for production capabilities', () => {
    expect(buildContinueState(task())).toEqual({
      taskType: 'polish',
      title: '润色任务',
      inputData: {
        inputMode: 'file',
        documentRef,
        polishType: 'academic',
        requirements: '保留术语',
      },
    });
    expect(buildContinueState(task({ taskType: 'literature' }))).toBeNull();
  });

  it('accepts matching continue state and ignores identity fields', () => {
    const state = buildContinueState(task({ taskType: 'paper-revision' }));
    expect(readContinueState('paper-revision', state)).toEqual({
      taskType: 'paper-revision',
      title: '润色任务',
      inputData: {
        inputMode: 'file',
        documentRef,
        requirements: '保留术语',
      },
    });
    expect(readContinueState('polish', state)).toBeNull();
    expect(readContinueState('polish', { taskId: 'x', userId: 'y' })).toBeNull();
  });

  it('rejects malformed document refs and exports normalized result text', async () => {
    const malformed = buildContinueState(task({
      inputData: { inputMode: 'file', documentRef: { fileName: 'only-name' } },
    }));
    expect(malformed).toBeNull();

    const result = adaptTaskResult('polish', {
      originalContent: '原文',
      revisedContent: '  修改后\r\n文本  ',
      changes: [],
      warnings: [],
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const exported = exportTaskResult(result.envelope, 'plain');
    expect(exported.filename).toBe('result.txt');
    expect(exported.mimeType).toBe('text/plain;charset=utf-8');
    expect(await exported.blob.text()).toBe('修改后\n文本');
  });

  it.each([
    ['empty bucketId', { bucketId: ' ' }],
    ['empty filePath', { filePath: '' }],
    ['empty fileName', { fileName: '  ' }],
    ['negative sizeBytes', { sizeBytes: -1 }],
    ['non-integer sizeBytes', { sizeBytes: 1.5 }],
    ['invalid sha256', { sha256: 'x' }],
    ['unsupported provider', { provider: 'external' }],
    ['unsupported sourceType', { sourceType: 'html' }],
  ])('fails closed for %s DocumentInputRef', (_label, change) => {
    const malformedRef = { ...documentRef, ...change };
    const malformedTask = task({ inputData: { inputMode: 'file', documentRef: malformedRef } });

    expect(buildRerunPayload(malformedTask)).toBeNull();
    expect(buildContinueState(malformedTask)).toBeNull();
    expect(readContinueState('polish', {
      taskType: 'polish',
      title: '继续编辑',
      inputData: { inputMode: 'file', documentRef: malformedRef },
    })).toBeNull();
  });

  it('fails closed for incomplete production text and topic inputs', () => {
    expect(buildRerunPayload(task({ inputData: { inputMode: 'text' } }))).toBeNull();
    expect(buildRerunPayload(task({
      taskType: 'topic-generation',
      inputData: { field: '计算机科学' },
    }))).toBeNull();
    expect(buildRerunPayload(task({ inputData: null as unknown as Record<string, any> }))).toBeNull();
  });
});
