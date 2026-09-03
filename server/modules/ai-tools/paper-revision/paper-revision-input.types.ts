import type { DocumentInputRef } from '@shared/document-input.interface';
import type { Task } from '@shared/api.interface';
import type { ToolPreparationInput } from '../execution/tool-execution.types';

export interface PaperRevisionSubmissionInputData {
  inputMode?: 'text' | 'file';
  text?: string;
  documentRef?: DocumentInputRef;
  revisionTypes?: string[];
  requirements?: string;
  language?: 'zh' | 'en';
  fileName?: string;
  wordCount?: number;
  pointsCost?: number;
}

export interface PaperRevisionSubmissionRequest {
  userId: string;
  title?: string;
  inputData: PaperRevisionSubmissionInputData;
}

export interface PaperRevisionChunkOptions extends Record<string, unknown> {
  revisionTypes?: string[];
  language?: 'zh' | 'en';
}

export interface NormalizedPaperRevisionSubmission {
  preparation: ToolPreparationInput;
  options: PaperRevisionChunkOptions;
}

export type PaperRevisionSubmissionResult = Task;
