import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import type { Task, TaskType, ToolConfig } from '@shared/api.interface';
import { TOOL_CONFIGS } from '@shared/api.interface';
import { PolishSubmissionService } from './polish/polish-submission.service';
import type { PolishSubmissionInputData } from './polish/polish-input.types';
import { PaperRevisionSubmissionService } from './paper-revision/paper-revision-submission.service';
import type { PaperRevisionSubmissionInputData } from './paper-revision/paper-revision-input.types';
import { ApplicationShutdownCoordinator } from '../../common/lifecycle/application-shutdown.coordinator';

import { generate as generateOutline } from './generators/outline.generator';
import { generate as generateLiterature } from './generators/literature.generator';
import { generate as generateFormat } from './generators/format.generator';
import { generate as generateCheck } from './generators/check.generator';
import { generate as generateChart } from './generators/chart.generator';
import { generate as generateThesis } from './generators/thesis.generator';
import { generate as generateGraduationDesign } from './generators/graduation-design.generator';
import { TopicGenerationGenerator } from './generators/topic-generation.generator';
import { generate as generateLiteratureReview } from './generators/literature-review.generator';
import { generate as generateProposal } from './generators/proposal.generator';
import { generate as generateTaskAssignment } from './generators/task-assignment.generator';
import { generate as generateCoursePaper } from './generators/course-paper.generator';
import { generate as generateJournalPaper } from './generators/journal-paper.generator';
import { generate as generatePracticeReport } from './generators/practice-report.generator';
import { generate as generateProjectApplication } from './generators/project-application.generator';
import { generate as generateCommentRevision } from './generators/comment-revision.generator';
import { generate as generateDataAnalysis } from './generators/data-analysis.generator';
import { generate as generateQuestionnaireDesign } from './generators/questionnaire-design.generator';
import { generate as generatePaperReverse } from './generators/paper-reverse.generator';
import { generate as generateAiReduce } from './generators/ai-reduce.generator';
import { generate as generateAiPpt } from './generators/ai-ppt.generator';

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly topicGenerationGenerator: TopicGenerationGenerator,
    private readonly polishSubmissionService: PolishSubmissionService,
    private readonly paperRevisionSubmissionService: PaperRevisionSubmissionService,
    @Optional()
    private readonly shutdown?: ApplicationShutdownCoordinator,
  ) {}

  getToolConfigs(): ToolConfig[] {
    return TOOL_CONFIGS;
  }

  /**
   * 提交 AI 处理任务：
   * 1. 创建任务（扣积分）
   * 2. 立即更新为 processing
   * 3. 异步 setTimeout 调用对应 generator
   * 4. 完成后更新为 completed / failed
   *
   * 请求立即返回 processing 状态的 task，不阻塞。
   */
  async submitTask(params: {
    userId: string;
    taskType: TaskType;
    title: string;
    inputData: Record<string, any>;
  }): Promise<Task> {
    const { userId, taskType, title, inputData } = params;

    const toolConfig = TOOL_CONFIGS.find((t) => t.type === taskType);
    if (!toolConfig) {
      throw new BadRequestException(`不支持的工具类型: ${taskType}`);
    }

    if (taskType === 'polish') {
      return this.polishSubmissionService.submit({
        userId,
        title,
        inputData: inputData as PolishSubmissionInputData,
      });
    }

    if (taskType === 'paper-revision') {
      return this.paperRevisionSubmissionService.submit({
        userId,
        title,
        inputData: inputData as PaperRevisionSubmissionInputData,
      });
    }

    if (this.shutdown && !this.shutdown.beginWork()) {
      throw new ServiceUnavailableException('Server is shutting down.');
    }

    const tracked = Boolean(this.shutdown);
    try {
      return await this.submitGenericTask({
        userId,
        taskType,
        title,
        inputData,
      });
    } catch (error) {
      if (tracked) this.shutdown?.endWork();
      throw error;
    }
  }

  private async submitGenericTask(params: {
    userId: string;
    taskType: TaskType;
    title: string;
    inputData: Record<string, any>;
  }): Promise<Task> {
    const { userId, taskType, title, inputData } = params;

    // 1. 创建任务（扣积分，状态 pending）
    const task = await this.tasksService.createTask({
      userId,
      taskType,
      title,
      inputData,
    });

    // 2. 立即更新为 processing
    const processingTask = await this.tasksService.updateTask(task.id, userId, {
      status: 'processing',
      progress: 10,
    });

    if (!processingTask) {
      throw new BadRequestException('任务创建失败');
    }

    // 3. 异步处理（不阻塞请求）
    this.processTaskAsync(task.id, userId, taskType, inputData).catch((err) => {
      this.logger.error(`任务异步处理异常: ${task.id}`, JSON.stringify(err));
      this.shutdown?.endWork();
    });

    return processingTask;
  }

  private async processTaskAsync(
    taskId: string,
    userId: string,
    taskType: TaskType,
    inputData: Record<string, any>,
  ): Promise<void> {
    // 模拟 AI 处理时间：3-8 秒随机
    const delayMs = 3000 + Math.floor(Math.random() * 5000);

    setTimeout(async () => {
      try {
        if (this.shutdown?.isShuttingDown()) {
          await this.tasksService.updateTask(taskId, userId, {
            status: 'failed',
            errorMessage: 'Task interrupted by server shutdown.',
          });
          return;
        }

        await this.tasksService.updateTask(taskId, userId, { progress: 30 });
        await this.tasksService.updateTask(taskId, userId, { progress: 60 });

        let resultData: Record<string, any>;
        switch (taskType) {
          case 'outline':
            resultData = await generateOutline(inputData);
            break;
          case 'literature':
            resultData = await generateLiterature(inputData);
            break;
          case 'format':
            resultData = await generateFormat(inputData);
            break;
          case 'check':
            resultData = await generateCheck(inputData);
            break;
          case 'chart':
            resultData = await generateChart(inputData);
            break;
          case 'thesis':
            resultData = await generateThesis(inputData);
            break;
          case 'graduation-design':
            resultData = await generateGraduationDesign(inputData);
            break;
          case 'topic-generation':
            {
              const generated =
                await this.topicGenerationGenerator.generate(inputData);
              resultData = {
                ...generated.resultData,
                metadata: generated.metadata,
              };
              const usage = generated.metadata.usage;
              this.logger.log(
                `provider=${generated.metadata.provider} model=${generated.metadata.model} taskType=${taskType} ` +
                  `generationTimeMs=${generated.metadata.generationTimeMs} ` +
                  `promptTokens=${usage?.promptTokens ?? 0} ` +
                  `completionTokens=${usage?.completionTokens ?? 0} ` +
                  `totalTokens=${usage?.totalTokens ?? 0} success=true`,
              );
            }
            break;
          case 'literature-review':
            resultData = await generateLiteratureReview(inputData);
            break;
          case 'proposal':
            resultData = await generateProposal(inputData);
            break;
          case 'task-assignment':
            resultData = await generateTaskAssignment(inputData);
            break;
          case 'course-paper':
            resultData = await generateCoursePaper(inputData);
            break;
          case 'journal-paper':
            resultData = await generateJournalPaper(inputData);
            break;
          case 'practice-report':
            resultData = await generatePracticeReport(inputData);
            break;
          case 'project-application':
            resultData = await generateProjectApplication(inputData);
            break;
          case 'comment-revision':
            resultData = await generateCommentRevision(inputData);
            break;
          case 'data-analysis':
            resultData = await generateDataAnalysis(inputData);
            break;
          case 'questionnaire-design':
            resultData = await generateQuestionnaireDesign(inputData);
            break;
          case 'paper-reverse':
            resultData = await generatePaperReverse(inputData);
            break;
          case 'ai-reduce':
            resultData = await generateAiReduce(inputData);
            break;
          case 'ai-ppt':
            resultData = await generateAiPpt(inputData);
            break;
          default:
            throw new Error(`未知任务类型: ${taskType}`);
        }

        await this.tasksService.updateTask(taskId, userId, { progress: 85 });

        if (this.shutdown?.isShuttingDown()) {
          await this.tasksService.updateTask(taskId, userId, {
            status: 'failed',
            errorMessage: 'Task interrupted by server shutdown.',
          });
          return;
        }

        // 完成
        await this.tasksService.updateTask(taskId, userId, {
          status: 'completed',
          progress: 100,
          resultData,
        });

        this.logger.log(`任务完成: ${taskId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `任务失败: ${taskId}, taskType=${taskType}, ${errorMessage}`,
        );
        try {
          await this.tasksService.updateTask(taskId, userId, {
            status: 'failed',
            errorMessage,
          });
        } catch (updateErr) {
          this.logger.error(
            `更新任务失败状态异常: ${taskId}`,
            JSON.stringify(updateErr),
          );
        }
      } finally {
        this.shutdown?.endWork();
      }
    }, delayMs);
  }
}
