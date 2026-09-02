import type { Task, TaskType, ToolConfig } from '@shared/api.interface';
import type { DocumentInputRef } from '@shared/document-input.interface';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface SubmitTaskData {
  taskType: TaskType;
  title: string;
  inputData: Record<string, unknown>;
}

export async function submitTask(data: SubmitTaskData): Promise<Task> {
  const response = await axiosForBackend.post<Task>('/api/ai-tools/submit', data);
  return response.data;
}

export interface PolishSubmitTaskData {
  title: string;
  inputMode: 'text' | 'file';
  text?: string;
  documentRef?: DocumentInputRef;
  polishType?: string;
  language?: 'zh' | 'en';
  requirements?: string;
  wordCount?: number;
}

export function submitPolishTask(data: PolishSubmitTaskData): Promise<Task> {
  if (data.inputMode === 'text' && !data.text?.trim()) {
    return Promise.reject(new Error('Academic polish text is required'));
  }
  if (data.inputMode === 'file' && !data.documentRef) {
    return Promise.reject(new Error('A prepared document reference is required'));
  }

  const inputData: Record<string, unknown> = {
    inputMode: data.inputMode,
    ...(data.inputMode === 'text' ? { text: data.text } : { documentRef: data.documentRef }),
    ...(data.polishType === undefined ? {} : { polishType: data.polishType }),
    ...(data.language === undefined ? {} : { language: data.language }),
    ...(data.requirements === undefined ? {} : { requirements: data.requirements }),
    ...(data.wordCount === undefined ? {} : { wordCount: data.wordCount }),
  };

  return submitTask({
    taskType: 'polish',
    title: data.title,
    inputData,
  });
}

export async function getTools(): Promise<ToolConfig[]> {
  const response = await axiosForBackend.get<ToolConfig[]>('/api/ai-tools/tools');
  return response.data;
}
