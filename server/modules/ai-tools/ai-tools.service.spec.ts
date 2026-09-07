jest.mock(
  '@shared/api.interface',
  () => ({
    TOOL_CONFIGS: [
      { type: 'polish', name: '语法润色', basePoints: 10 },
      { type: 'paper-revision', name: 'AI论文修改', basePoints: 30 },
      { type: 'outline', name: '智能大纲', basePoints: 20 },
    ],
  }),
  { virtual: true },
);
jest.mock('../tasks/tasks.service', () => ({ TasksService: class {} }));
jest.mock('./generators/topic-generation.generator', () => ({
  TopicGenerationGenerator: class {},
}));
jest.mock('./generators/polish.generator', () => ({
  PolishGenerator: class {},
}));

const generatorModuleNames = [
  'outline',
  'literature',
  'format',
  'check',
  'chart',
  'thesis',
  'graduation-design',
  'literature-review',
  'proposal',
  'task-assignment',
  'course-paper',
  'journal-paper',
  'practice-report',
  'project-application',
  'comment-revision',
  'data-analysis',
  'questionnaire-design',
  'paper-reverse',
  'ai-reduce',
  'ai-ppt',
];
for (const moduleName of generatorModuleNames) {
  jest.mock(`./generators/${moduleName}.generator`, () => ({
    generate: jest.fn(),
  }));
}

jest.mock('./polish/polish-submission.service', () => ({
  PolishSubmissionService: class {},
}));
jest.mock('./paper-revision/paper-revision-submission.service', () => ({
  PaperRevisionSubmissionService: class {},
}));

import { AiToolsService } from './ai-tools.service';
import type { PolishSubmissionService } from './polish/polish-submission.service';
import type { TasksService } from '../tasks/tasks.service';
import type { TopicGenerationGenerator } from './generators/topic-generation.generator';
import type { PaperRevisionSubmissionService } from './paper-revision/paper-revision-submission.service';
import { ApplicationShutdownCoordinator } from '../../common/lifecycle/application-shutdown.coordinator';

describe('AiToolsService Polish cutover', () => {
  it('delegates Polish before generic Task creation and returns the delegated processing Task', async () => {
    const processingTask = {
      id: 'task-1',
      userId: 'user-1',
      taskType: 'polish',
      title: 'Polish',
      status: 'processing',
      progress: 10,
      pointsCost: 10,
      inputData: {},
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };
    const tasks = {
      createTask: jest.fn(),
      updateTask: jest.fn(),
    };
    const polishSubmission = {
      submit: jest.fn().mockResolvedValue(processingTask),
    };
    const service = new AiToolsService(
      tasks as unknown as TasksService,
      {} as TopicGenerationGenerator,
      polishSubmission as unknown as PolishSubmissionService,
      {} as PaperRevisionSubmissionService,
    );
    const inputData = {
      inputMode: 'file',
      documentRef: {
        version: 1,
        provider: 'platform-file',
        bucketId: 'bucket-1',
        filePath: 'academic-writing/users/scope/file-1/note.txt',
        fileName: 'note.txt',
        sourceType: 'txt',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
      },
    };

    const result = await service.submitTask({
      userId: 'user-1',
      taskType: 'polish',
      title: 'Polish',
      inputData,
    });

    expect(result).toBe(processingTask);
    expect(polishSubmission.submit).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'Polish',
      inputData,
    });
    expect(tasks.createTask).not.toHaveBeenCalled();
  });

  it('delegates Paper Revision before generic Task creation', async () => {
    const processingTask = {
      id: 'revision-task-1',
      userId: 'user-1',
      taskType: 'paper-revision',
      title: 'Revision',
      status: 'processing',
      progress: 10,
      pointsCost: 30,
      inputData: {},
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    };
    const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
    const paperRevisionSubmission = {
      submit: jest.fn().mockResolvedValue(processingTask),
    };
    const inputData = { text: 'source', requirements: 'revise' };
    const service = new AiToolsService(
      tasks as unknown as TasksService,
      {} as TopicGenerationGenerator,
      {} as PolishSubmissionService,
      paperRevisionSubmission as unknown as PaperRevisionSubmissionService,
    );

    const result = await service.submitTask({
      userId: 'user-1',
      taskType: 'paper-revision',
      title: 'Revision',
      inputData,
    });

    expect(result).toBe(processingTask);
    expect(paperRevisionSubmission.submit).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'Revision',
      inputData,
    });
    expect(tasks.createTask).not.toHaveBeenCalled();
  });

  it('keeps outline submissions on the generic path', async () => {
    const created = { id: 'outline-task' };
    const processing = { id: 'outline-task', status: 'processing' };
    const tasks = {
      createTask: jest.fn().mockResolvedValue(created),
      updateTask: jest.fn().mockResolvedValue(processing),
    };
    const paperRevisionSubmission = { submit: jest.fn() };
    const service = new AiToolsService(
      tasks as unknown as TasksService,
      {} as TopicGenerationGenerator,
      {} as PolishSubmissionService,
      paperRevisionSubmission as unknown as PaperRevisionSubmissionService,
    );

    const result = await service.submitTask({
      userId: 'user-1',
      taskType: 'outline',
      title: 'Outline',
      inputData: { topic: 'topic' },
    });

    expect(result).toBe(processing);
    expect(tasks.createTask).toHaveBeenCalledWith({
      userId: 'user-1',
      taskType: 'outline',
      title: 'Outline',
      inputData: { topic: 'topic' },
    });
    expect(paperRevisionSubmission.submit).not.toHaveBeenCalled();
  });

  it('rejects new generic work once shutdown has started', async () => {
    const tasks = { createTask: jest.fn(), updateTask: jest.fn() };
    const coordinator = new ApplicationShutdownCoordinator();
    coordinator.beginShutdown();
    const service = new AiToolsService(
      tasks as unknown as TasksService,
      {} as TopicGenerationGenerator,
      {} as PolishSubmissionService,
      {} as PaperRevisionSubmissionService,
      coordinator,
    );

    await expect(
      service.submitTask({
        userId: 'user-1',
        taskType: 'outline',
        title: 'Outline',
        inputData: { topic: 'topic' },
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(tasks.createTask).not.toHaveBeenCalled();
  });
});
