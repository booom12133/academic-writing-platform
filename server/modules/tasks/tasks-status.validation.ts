import { BadRequestException } from '@nestjs/common';
import type { TaskStatus } from '@shared/api.interface';

const TASK_STATUSES = new Set<TaskStatus>([
  'pending',
  'processing',
  'completed',
  'failed',
]);
const MAX_RESULT_DATA_BYTES = 1024 * 1024;
const MAX_ERROR_MESSAGE_LENGTH = 4_096;

export interface ValidatedTaskStatusPatch {
  status?: TaskStatus;
  progress?: number;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateTaskStatusPatch(input: unknown): ValidatedTaskStatusPatch {
  if (!isPlainObject(input)) {
    throw new BadRequestException('Invalid task status update payload.');
  }

  const status = input.status;
  if (status !== undefined && (typeof status !== 'string' || !TASK_STATUSES.has(status as TaskStatus))) {
    throw new BadRequestException('Task status is invalid.');
  }

  const progress = input.progress;
  if (
    progress !== undefined &&
    (typeof progress !== 'number' || !Number.isInteger(progress) || progress < 0 || progress > 100)
  ) {
    throw new BadRequestException('Task progress must be an integer from 0 to 100.');
  }

  const resultData = input.resultData;
  if (resultData !== undefined) {
    if (!isPlainObject(resultData)) {
      throw new BadRequestException('Task resultData must be an object.');
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(resultData);
    } catch (_error) {
      throw new BadRequestException('Task resultData is not serializable.');
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_RESULT_DATA_BYTES) {
      throw new BadRequestException('Task resultData exceeds the size limit.');
    }
  }

  const errorMessage = input.errorMessage;
  if (
    errorMessage !== undefined &&
    (typeof errorMessage !== 'string' || errorMessage.length > MAX_ERROR_MESSAGE_LENGTH)
  ) {
    throw new BadRequestException('Task errorMessage is invalid.');
  }

  return {
    status: status as TaskStatus | undefined,
    progress: progress as number | undefined,
    resultData: resultData as Record<string, unknown> | undefined,
    errorMessage: errorMessage as string | undefined,
  };
}
