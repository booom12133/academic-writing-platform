import type { Task, TaskType } from '@shared/api.interface';
import type { TaskResultEnvelope, ProductionResultTaskType } from '@shared/task-result.interface';
import { normalizeTaskResultText } from './task-result';
import { isValidDocumentInputRef } from './document-input-ref';

export interface TaskActionPayload {
  taskType: ProductionResultTaskType;
  title: string;
  inputData: Record<string, unknown>;
}

export interface ContinueState {
  taskType: ProductionResultTaskType;
  title: string;
  inputData: Record<string, unknown>;
}

const PRODUCTION_TASK_TYPES: ProductionResultTaskType[] = [
  'topic-generation',
  'polish',
  'paper-revision',
];

const APPROVED_INPUT_FIELDS: Record<ProductionResultTaskType, string[]> = {
  'topic-generation': ['field', 'educationLevel', 'researchDirection'],
  polish: ['inputMode', 'text', 'documentRef', 'polishType', 'language', 'requirements'],
  'paper-revision': ['inputMode', 'text', 'documentRef', 'revisionTypes', 'language', 'requirements'],
};

export function buildRerunPayload(task: Task): TaskActionPayload | null {
  const taskType = asProductionTaskType(task.taskType);
  if (!taskType) return null;
  if (!isRecord(task.inputData)) return null;
  const inputData = pickApprovedInput(taskType, task.inputData);
  if (!isInputContractUsable(taskType, inputData)) return null;
  return {
    taskType,
    title: task.title,
    inputData,
  };
}

export function buildContinueState(task: Task): ContinueState | null {
  const payload = buildRerunPayload(task);
  if (!payload) return null;
  if (!isInputContractUsable(payload.taskType, payload.inputData)) return null;
  return payload;
}

export function readContinueState(
  expectedTaskType: ProductionResultTaskType,
  locationState: unknown,
): ContinueState | null {
  if (!isRecord(locationState)) return null;
  const raw = isRecord(locationState.state) ? locationState.state : locationState;
  if (raw.taskType !== expectedTaskType || typeof raw.title !== 'string' || !isRecord(raw.inputData)) {
    return null;
  }
  const inputData = pickApprovedInput(expectedTaskType, raw.inputData);
  if (!isInputContractUsable(expectedTaskType, inputData)) return null;
  return { taskType: expectedTaskType, title: raw.title, inputData };
}

export function exportTaskResult(
  envelope: TaskResultEnvelope,
  format: 'markdown' | 'plain',
): { blob: Blob; filename: string; mimeType: string } {
  const markdown = format === 'markdown';
  const mimeType = markdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
  const extension = markdown ? 'md' : 'txt';
  return {
    blob: new Blob([normalizeTaskResultText(envelope)], { type: mimeType }),
    filename: `result.${extension}`,
    mimeType,
  };
}

function asProductionTaskType(taskType: TaskType): ProductionResultTaskType | null {
  return PRODUCTION_TASK_TYPES.includes(taskType as ProductionResultTaskType)
    ? taskType as ProductionResultTaskType
    : null;
}

function pickApprovedInput(
  taskType: ProductionResultTaskType,
  inputData: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of APPROVED_INPUT_FIELDS[taskType]) {
    if (inputData[field] !== undefined) result[field] = inputData[field];
  }
  if (result.documentRef !== undefined && !isValidDocumentInputRef(result.documentRef)) {
    delete result.documentRef;
  }
  return result;
}

function isInputContractUsable(taskType: ProductionResultTaskType, inputData: Record<string, unknown>): boolean {
  if (taskType === 'topic-generation') {
    return typeof inputData.field === 'string' && inputData.field.trim().length > 0
      && typeof inputData.educationLevel === 'string' && inputData.educationLevel.trim().length > 0;
  }
  if (inputData.inputMode === 'text') return typeof inputData.text === 'string' && inputData.text.trim().length > 0;
  return inputData.inputMode === 'file' && isValidDocumentInputRef(inputData.documentRef);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
