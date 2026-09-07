import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

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
import { ApplicationShutdownCoordinator } from '../../../common/lifecycle/application-shutdown.coordinator';

@Injectable()
export class PaperRevisionSubmissionService {
  constructor(
    private readonly preparation: ToolSubmissionPreparationService,
    private readonly tasks: TasksService,
    private readonly execution: AcademicToolExecutionService,
    private readonly executor: PaperRevisionChunkExecutor,
    private readonly aggregator: PaperRevisionResultAggregator,
    @Optional()
    private readonly shutdown?: ApplicationShutdownCoordinator,
  ) {}

  async submit(
    request: PaperRevisionSubmissionRequest,
  ): Promise<PaperRevisionSubmissionResult> {
    const normalized = normalizePaperRevisionSubmission(request);
    let processingTask: PaperRevisionSubmissionResult | undefined;
    if (this.shutdown && !this.shutdown.beginWork()) {
      throw new ServiceUnavailableException('Server is shutting down.');
    }
    let scheduled = false;

    try {
      await this.preparation.prepareBeforeBilling(
        normalized.preparation,
        async (prepared) => {
          const rendered = this.execution.render(prepared.context);
          const hasExecutableContent = rendered.some(
            (chunk) =>
              chunk.section === 'content' && chunk.eligibleForExecution,
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
          const updated = await this.tasks.updateTask(
            created.id,
            request.userId,
            {
              status: 'processing',
              progress: 10,
            },
          );
          if (!updated) {
            throw new Error(
              'Failed to update Paper Revision task to processing',
            );
          }
          processingTask = updated;

          setTimeout(() => {
            void this.processAsync(
              updated.id,
              request.userId,
              prepared.context,
              normalized.options,
            );
          }, 0);
          scheduled = true;
        },
      );

      if (!processingTask) {
        throw new Error('Paper Revision task was not created');
      }
      return processingTask;
    } catch (error) {
      if (!scheduled) this.shutdown?.endWork();
      throw error;
    }
  }

  private async processAsync(
    taskId: string,
    userId: string,
    context: Parameters<AcademicToolExecutionService['execute']>[0],
    options: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (this.shutdown?.isShuttingDown()) {
        await this.tasks.updateTask(taskId, userId, {
          status: 'failed',
          progress: 100,
          errorMessage: 'Task interrupted by server shutdown.',
        });
        return;
      }
      const execution = await this.execution.execute(
        context,
        this.executor,
        options,
      );
      const result = this.aggregator.aggregate(execution);
      if (this.shutdown?.isShuttingDown()) {
        await this.tasks.updateTask(taskId, userId, {
          status: 'failed',
          progress: 100,
          errorMessage: 'Task interrupted by server shutdown.',
        });
        return;
      }
      await this.tasks.updateTask(taskId, userId, {
        status: 'completed',
        progress: 100,
        resultData: result as unknown as Record<string, any>,
      });
    } catch (error) {
      await this.tasks.updateTask(taskId, userId, {
        status: 'failed',
        progress: 100,
        errorMessage:
          error instanceof Error ? error.message : '论文修改任务失败',
      });
    } finally {
      this.shutdown?.endWork();
    }
  }
}
