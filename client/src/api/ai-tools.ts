import type { Task, TaskType, ToolConfig } from '@shared/api.interface';
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

export async function getTools(): Promise<ToolConfig[]> {
  const response = await axiosForBackend.get<ToolConfig[]>('/api/ai-tools/tools');
  return response.data;
}
