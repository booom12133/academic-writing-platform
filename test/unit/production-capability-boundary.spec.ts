jest.mock('@shared/api.interface', () => ({
  TOOL_CONFIGS: [
    { type: 'polish', name: '语法润色', basePoints: 10 },
    { type: 'paper-revision', name: 'AI论文修改', basePoints: 30 },
    { type: 'topic-generation', name: '智能拟题', basePoints: 15 },
    { type: 'literature', name: '文献推荐', basePoints: 30 },
    { type: 'outline', name: '智能大纲', basePoints: 20 },
  ],
}), { virtual: true });
jest.mock('../../server/modules/tasks/tasks.service', () => ({ TasksService: class {} }));
jest.mock('../../server/modules/ai-tools/generators/topic-generation.generator', () => ({
  TopicGenerationGenerator: class {},
}));
jest.mock('../../server/modules/ai-tools/polish/polish-submission.service', () => ({
  PolishSubmissionService: class {},
}));
jest.mock('../../server/modules/ai-tools/paper-revision/paper-revision-submission.service', () => ({
  PaperRevisionSubmissionService: class {},
}));

import { AiToolsService } from '../../server/modules/ai-tools/ai-tools.service';
import type { TasksService } from '../../server/modules/tasks/tasks.service';
import type { TopicGenerationGenerator } from '../../server/modules/ai-tools/generators/topic-generation.generator';
import type { PolishSubmissionService } from '../../server/modules/ai-tools/polish/polish-submission.service';
import type { PaperRevisionSubmissionService } from '../../server/modules/ai-tools/paper-revision/paper-revision-submission.service';

describe('production capability execution boundary', () => {
  it('rejects invalid production file input before invoking the accepted service', async () => {
    const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
    const polishSubmission = { submit: jest.fn() };
    const service = new AiToolsService(
      tasks as unknown as TasksService,
      {} as TopicGenerationGenerator,
      polishSubmission as unknown as PolishSubmissionService,
      {} as PaperRevisionSubmissionService,
    );

    await expect(service.submitTask({
      userId: 'user-1',
      taskType: 'polish',
      title: 'Invalid file input',
      inputData: { inputMode: 'file', fileName: 'source.pdf', fileSize: 12 },
    })).rejects.toMatchObject({
      response: { code: 'AI_TOOL_INPUT_INVALID' },
    });

    expect(polishSubmission.submit).not.toHaveBeenCalled();
    expect(tasks.createTask).not.toHaveBeenCalled();
  });

  it('rejects literature before any generic task or legacy generator execution', async () => {
    const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
    const service = new AiToolsService(
      tasks as unknown as TasksService,
      {} as TopicGenerationGenerator,
      {} as PolishSubmissionService,
      {} as PaperRevisionSubmissionService,
    );

    await expect(service.submitTask({
      userId: 'user-1',
      taskType: 'literature',
      title: 'Literature',
      inputData: { topic: 'neural networks' },
    })).rejects.toMatchObject({
      response: { code: 'AI_TOOL_NOT_PRODUCTION_READY' },
    });

    expect(tasks.createTask).not.toHaveBeenCalled();
  });
});
