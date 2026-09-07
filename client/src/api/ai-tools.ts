import type { Task, TaskType } from '@shared/api.interface';
import type { ProductToolCapability } from '@shared/product-capability.interface';
import type { DocumentInputRef } from '@shared/document-input.interface';
import { productHttpClient } from './http';

export interface SubmitTaskData {
  taskType: TaskType;
  title: string;
  inputData: Record<string, unknown>;
}

export async function submitTask(data: SubmitTaskData): Promise<Task> {
  const response = await productHttpClient.post<Task>('/api/ai-tools/submit', data);
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

export interface PaperRevisionSubmitTaskData {
  title: string;
  inputMode: 'text' | 'file';
  text?: string;
  documentRef?: DocumentInputRef;
  revisionTypes?: string[];
  requirements?: string;
  language?: 'zh' | 'en';
  wordCount?: number;
}

export function canSubmitPaperRevision(
  inputMode: 'text' | 'file',
  text: string,
  documentRef: DocumentInputRef | null,
  revisionTypes: string[],
): boolean {
  if (revisionTypes.length === 0) return false;
  return inputMode === 'text' ? text.trim().length > 0 : documentRef !== null;
}

export function submitPaperRevisionTask(data: PaperRevisionSubmitTaskData): Promise<Task> {
  if (data.inputMode === 'text' && !data.text?.trim()) {
    return Promise.reject(new Error('Paper revision text is required'));
  }
  if (data.inputMode === 'file' && !data.documentRef) {
    return Promise.reject(new Error('A prepared document reference is required'));
  }

  const inputData: Record<string, unknown> = {
    inputMode: data.inputMode,
    ...(data.inputMode === 'text' ? { text: data.text } : { documentRef: data.documentRef }),
    ...(data.revisionTypes === undefined ? {} : { revisionTypes: data.revisionTypes }),
    ...(data.requirements === undefined ? {} : { requirements: data.requirements }),
    ...(data.language === undefined ? {} : { language: data.language }),
    ...(data.wordCount === undefined ? {} : { wordCount: data.wordCount }),
  };

  return submitTask({
    taskType: 'paper-revision',
    title: data.title,
    inputData,
  });
}

export async function getTools(): Promise<ProductToolCapability[]> {
  const response = await productHttpClient.get<ProductToolCapability[]>('/api/ai-tools/tools');
  return response.data;
}
