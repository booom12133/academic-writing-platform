import type {
  Task,
  TaskListResponse,
  CreateTaskRequest,
  TaskStatus,
} from '@shared/api.interface';
import { productHttpClient } from './http';

export interface GetTaskListParams {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  taskType?: string;
  keyword?: string;
}

export async function createTask(data: CreateTaskRequest): Promise<Task> {
  const response = await productHttpClient.post<Task>('/api/tasks', data);
  return response.data;
}

export async function getTaskList(params: GetTaskListParams): Promise<TaskListResponse> {
  const response = await productHttpClient.get<TaskListResponse>('/api/tasks', { params });
  return response.data;
}

export async function getTask(id: string): Promise<Task> {
  const response = await productHttpClient.get<Task>(`/api/tasks/${id}`);
  return response.data;
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  const response = await productHttpClient.delete<{ success: boolean }>(`/api/tasks/${id}`);
  return response.data;
}

export interface TaskStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export async function getTaskStats(): Promise<TaskStats> {
  const response = await productHttpClient.get<TaskStats>('/api/tasks/stats/count');
  return response.data;
}
