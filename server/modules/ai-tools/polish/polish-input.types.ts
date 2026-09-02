import type { DocumentInputRef } from '@shared/document-input.interface';
import type { Task } from '@shared/api.interface';
import type { ToolPreparationInput } from '../execution/tool-execution.types';

export interface PolishSubmissionInputData {
  inputMode: 'text' | 'file';
  text?: string;
  documentRef?: DocumentInputRef;
  fileName?: string;
  polishType?: string;
  language?: 'zh' | 'en';
  requirements?: string;
  wordCount?: number;
  pointsCost?: number;
}

export interface PolishSubmissionRequest {
  userId: string;
  title?: string;
  inputData: PolishSubmissionInputData;
}

export interface PolishChunkOptions extends Record<string, unknown> {
  polishType?: string;
  language?: 'zh' | 'en';
}

export interface NormalizedPolishSubmission {
  preparation: ToolPreparationInput;
  options: PolishChunkOptions;
}

export interface PreparedPolishBilling {
  billingText: string;
  charCount: number;
  pointsCost: number;
}

export interface PolishChunkOutput {
  originalContent: string;
  revisedContent: string;
  changes: { original: string; revised: string; reason: string }[];
  metadata: {
    provider: 'deepseek';
    model: string;
    latencyMs: number;
  };
}

export type PolishSubmissionResult = Task;
