import { Injectable } from '@nestjs/common';

import { TasksService } from '../../tasks/tasks.service';
import { AcademicToolExecutionService } from '../execution/academic-tool-execution.service';
import { ToolSubmissionPreparationService } from '../execution/tool-submission-preparation.service';
import { PolishChunkExecutor } from './polish-chunk.executor';
import { PolishResultAggregator } from './polish-result.aggregator';
import { PolishBillingService } from './polish-billing.service';
import { normalizePolishSubmission } from './polish-input.normalizer';
import type {
  PolishSubmissionRequest,
  PolishSubmissionResult,
} from './polish-input.types';

@Injectable()
export class PolishSubmissionService {
  constructor(
    private readonly preparation: ToolSubmissionPreparationService,
    private readonly billing: PolishBillingService,
    private readonly tasks: TasksService,
    private readonly execution: AcademicToolExecutionService,
    private readonly executor: PolishChunkExecutor,
    private readonly aggregator: PolishResultAggregator,
  ) {}

  async submit(request: PolishSubmissionRequest): Promise<PolishSubmissionResult> {
    const normalized = normalizePolishSubmission(request);
    let processingTask: PolishSubmissionResult | undefined;

    await this.preparation.prepareBeforeBilling(
      normalized.preparation,
      async (prepared) => {
        const preparedBilling = this.billing.calculate(prepared.context);
        const created = await this.tasks.createPreparedPolishTask({
          userId: request.userId,
          title: request.title?.trim() || '学术润色任务',
          inputData: request.inputData,
          preparedBillingText: preparedBilling.billingText,
        });
        processingTask = await this.tasks.updateTask(created.id, {
          status: 'processing',
          progress: 10,
        }) ?? { ...created, status: 'processing', progress: 10 };

        setTimeout(() => {
          void this.processAsync(
            processingTask!.id,
            prepared.context,
            normalized.options,
          );
        }, 0);
      },
    );

    if (!processingTask) {
      throw new Error('Polish task was not created');
    }
    return processingTask;
  }

  private async processAsync(
    taskId: string,
    context: Parameters<AcademicToolExecutionService['execute']>[0],
    options: Record<string, unknown>,
  ): Promise<void> {
    try {
      const execution = await this.execution.execute(
        context,
        this.executor,
        options,
      );
      const result = this.aggregator.aggregate(execution);
      await this.tasks.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        resultData: result as unknown as Record<string, any>,
      });
    } catch (error) {
      await this.tasks.updateTask(taskId, {
        status: 'failed',
        progress: 100,
        errorMessage: error instanceof Error ? error.message : '学术润色任务失败',
      });
    }
  }
}
