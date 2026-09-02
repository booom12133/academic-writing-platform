import { Injectable } from '@nestjs/common';

import { TasksService } from '../../tasks/tasks.service';
import { AcademicToolExecutionService } from '../execution/academic-tool-execution.service';
import { ToolSubmissionPreparationService } from '../execution/tool-submission-preparation.service';
import { PaperRevisionChunkExecutor } from './paper-revision-chunk.executor';
import { PaperRevisionResultAggregator } from './paper-revision-result.aggregator';
import { normalizePaperRevisionSubmission } from './paper-revision-input.normalizer';
import type {
  PaperRevisionSubmissionRequest,
  PaperRevisionSubmissionResult,
} from './paper-revision-input.types';

@Injectable()
export class PaperRevisionSubmissionService {
  constructor(
    private readonly preparation: ToolSubmissionPreparationService,
    private readonly tasks: TasksService,
    private readonly execution: AcademicToolExecutionService,
    private readonly executor: PaperRevisionChunkExecutor,
    private readonly aggregator: PaperRevisionResultAggregator,
  ) {}

  async submit(
    request: PaperRevisionSubmissionRequest,
  ): Promise<PaperRevisionSubmissionResult> {
    const normalized = normalizePaperRevisionSubmission(request);
    let processingTask: PaperRevisionSubmissionResult | undefined;

    await this.preparation.prepareBeforeBilling(
      normalized.preparation,
      async (prepared) => {
        const rendered = this.execution.render(prepared.context);
        const hasExecutableContent = rendered.some(
          (chunk) => chunk.section === 'content' && chunk.eligibleForExecution,
        );
        if (!hasExecutableContent) {
          throw new Error('Paper revision requires executable content');
        }

        const created = await this.tasks.createTask({
          userId: request.userId,
          taskType: 'paper-revision',
          title: request.title?.trim() || '论文修改任务',
          inputData: request.inputData,
        });
        const updated = await this.tasks.updateTask(created.id, {
          status: 'processing',
          progress: 10,
        });
        if (!updated) {
          throw new Error('Failed to update Paper Revision task to processing');
        }
        processingTask = updated;

        setTimeout(() => {
          void this.processAsync(updated.id, prepared.context, normalized.options);
        }, 0);
      },
    );

    if (!processingTask) {
      throw new Error('Paper Revision task was not created');
    }
    return processingTask;
  }

  private async processAsync(
    taskId: string,
    context: Parameters<AcademicToolExecutionService['execute']>[0],
    options: Record<string, unknown>,
  ): Promise<void> {
    try {
      const execution = await this.execution.execute(context, this.executor, options);
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
        errorMessage: error instanceof Error ? error.message : '论文修改任务失败',
      });
    }
  }
}
