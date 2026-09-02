jest.mock('@shared/api.interface', () => ({
  TOOL_CONFIGS: [
    { type: 'polish', name: '语法润色', basePoints: 10 },
    { type: 'outline', name: '智能大纲', basePoints: 20 },
  ],
}), { virtual: true });
jest.mock('../tasks/tasks.service', () => ({ TasksService: class {} }));
jest.mock('./generators/topic-generation.generator', () => ({ TopicGenerationGenerator: class {} }));
jest.mock('./generators/polish.generator', () => ({ PolishGenerator: class {} }));
jest.mock('./generators/paper-revision.generator', () => ({ PaperRevisionGenerator: class {} }));

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

jest.mock('./polish/polish-submission.service', () => ({ PolishSubmissionService: class {} }));

import { AiToolsService } from './ai-tools.service';
import type { PolishSubmissionService } from './polish/polish-submission.service';
import type { TasksService } from '../tasks/tasks.service';
import type { TopicGenerationGenerator } from './generators/topic-generation.generator';
import type { PaperRevisionGenerator } from './generators/paper-revision.generator';

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
      {} as PaperRevisionGenerator,
      polishSubmission as unknown as PolishSubmissionService,
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
});
