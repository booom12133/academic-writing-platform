import type { TaskType } from '@shared/api.interface';
import { isValidDocumentInputRef } from '../../lib/document-input-ref';

export const AI_TOOL_INPUT_INVALID = 'AI_TOOL_INPUT_INVALID';

export type ToolInputContractResult =
  | { valid: true }
  | { valid: false; code: typeof AI_TOOL_INPUT_INVALID; message: string };

const METADATA_ONLY_FILE_KEYS = [
  'fileName',
  'fileSize',
  'fileCount',
  'refCount',
  'resourceCount',
] as const;

export function validateToolInputContract(
  taskType: TaskType,
  inputData: unknown,
): ToolInputContractResult {
  if (!isRecord(inputData)) return invalid('工具输入必须是对象。');
  if (METADATA_ONLY_FILE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(inputData, key))) {
    return invalid('文件工具必须使用真实 DocumentInputRef。');
  }

  if (taskType === 'polish') return validatePolish(inputData);
  if (taskType === 'paper-revision') return validatePaperRevision(inputData);
  if (taskType === 'topic-generation') return validateTopicGeneration(inputData);
  return { valid: true };
}

function validatePolish(input: Record<string, unknown>): ToolInputContractResult {
  if (input.inputMode === 'text') {
    return typeof input.text === 'string' && input.text.trim() && input.documentRef === undefined
      ? { valid: true }
      : invalid('润色文本模式需要有效文本。');
  }
  return input.inputMode === 'file' && isValidDocumentInputRef(input.documentRef)
    ? { valid: true }
    : invalid('润色文件模式必须使用真实 DocumentInputRef。');
}

function validatePaperRevision(input: Record<string, unknown>): ToolInputContractResult {
  const hasText = typeof input.text === 'string' && input.text.trim().length > 0;
  const hasRef = input.documentRef !== undefined && isValidDocumentInputRef(input.documentRef);
  if (input.inputMode === 'text') return hasText && input.documentRef === undefined
    ? { valid: true }
    : invalid('论文修改文本模式需要有效文本。');
  if (input.inputMode === 'file') return hasRef
    ? { valid: true }
    : invalid('论文修改文件模式必须使用真实 DocumentInputRef。');
  return hasText !== hasRef ? { valid: true } : invalid('论文修改需要唯一且有效的文本或 DocumentInputRef。');
}

function validateTopicGeneration(input: Record<string, unknown>): ToolInputContractResult {
  const hasText = ['field', 'researchDirection', 'educationLevel', 'topic', 'requirements']
    .some((field) => typeof input[field] === 'string' && input[field].trim().length > 0);
  const keywordsValid = input.keywords === undefined
    || (Array.isArray(input.keywords) && input.keywords.every((keyword) => typeof keyword === 'string'));
  return hasText && keywordsValid ? { valid: true } : invalid('选题生成至少需要一项有效文本输入。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message: string): ToolInputContractResult {
  return { valid: false, code: AI_TOOL_INPUT_INVALID, message };
}
