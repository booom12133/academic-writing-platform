import type { TaskType } from './api.interface';

export type TaskResultKind = 'polish' | 'paper-revision' | 'topic-generation' | 'legacy-preview';

export interface TaskResultEnvelope {
  schemaVersion: 1;
  kind: TaskResultKind;
  content?: string;
  originalContent?: string;
  revisedContent?: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
  exportable: boolean;
}

export type TaskResultAdapterResult =
  | { valid: true; envelope: TaskResultEnvelope }
  | { valid: false; reason: 'malformed' | 'unsupported' };

export type ProductionResultTaskType = Extract<
  TaskType,
  'topic-generation' | 'polish' | 'paper-revision'
>;
