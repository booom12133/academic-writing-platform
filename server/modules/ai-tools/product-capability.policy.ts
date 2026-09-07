import { BadRequestException } from '@nestjs/common';
import type { TaskType } from '../../../shared/api.interface';
import { productCapabilityFor } from '../../../shared/product-capability.catalog';

export const AI_TOOL_NOT_PRODUCTION_READY = 'AI_TOOL_NOT_PRODUCTION_READY';

export function assertToolSubmissionAllowed(
  taskType: TaskType,
  inputData: Record<string, unknown>,
): void {
  void inputData;
  const capability = productCapabilityFor(taskType);
  if (!capability || capability.readiness !== 'production') {
    throw new BadRequestException({
      code: AI_TOOL_NOT_PRODUCTION_READY,
      message:
        capability?.readiness === 'disabled'
          ? '该工具当前不可用，请使用真实学术搜索能力。'
          : '该工具尚未开放执行。',
    });
  }
}
