import { BadRequestException } from '@nestjs/common';
import type { TaskType } from '../../../shared/api.interface';
import { productCapabilityFor } from '../../../shared/product-capability.catalog';
import type { ProductToolCapability } from '../../../shared/product-capability.interface';

export const AI_TOOL_NOT_PRODUCTION_READY = 'AI_TOOL_NOT_PRODUCTION_READY';
export const AI_TOOL_INPUT_INVALID = 'AI_TOOL_INPUT_INVALID';

const METADATA_ONLY_FILE_KEYS = [
  'fileName',
  'fileSize',
  'fileCount',
  'refCount',
  'resourceCount',
] as const;

type InputRecord = Record<string, unknown>;

export function assertToolSubmissionAllowed(
  taskType: TaskType,
  inputData: Record<string, unknown>,
): void {
  const capability = productCapabilityFor(taskType);
  if (!capability || capability.readiness !== 'production') {
    throw new BadRequestException({
      code: AI_TOOL_NOT_PRODUCTION_READY,
      message:
        capability?.readiness === 'disabled'
          ? '该工具当前不可用，请使用真实学术搜索能力。'
          : '该工具尚未开放执行。',
    });
  }

  validateProductToolInput(capability, inputData);
}

export function validateProductToolInput(
  capability: ProductToolCapability,
  inputData: unknown,
): void {
  const input = asInputRecord(inputData);
  if (!input) {
    throw invalidInput('工具输入必须是对象。');
  }

  if (hasMetadataOnlyFileKey(input)) {
    throw invalidInput('文件工具必须使用真实 DocumentInputRef。');
  }

  switch (capability.type) {
    case 'topic-generation':
      validateTopicGenerationInput(input);
      return;
    case 'polish':
      validatePolishInput(input);
      return;
    case 'paper-revision':
      validatePaperRevisionInput(input);
      return;
    default:
      throw invalidInput('该工具没有可用的产品输入契约。');
  }
}

function validateTopicGenerationInput(input: InputRecord): void {
  const textFields = ['field', 'researchDirection', 'educationLevel', 'topic', 'requirements'];
  const hasText = textFields.some((field) => (
    typeof input[field] === 'string' && input[field].trim().length > 0
  ));
  const keywordsValid = input.keywords === undefined
    || (Array.isArray(input.keywords)
      && input.keywords.every((keyword) => typeof keyword === 'string'));

  if (!hasText || !keywordsValid) {
    throw invalidInput('选题生成至少需要一项有效文本输入。');
  }
}

function validatePolishInput(input: InputRecord): void {
  if (input.inputMode !== 'text' && input.inputMode !== 'file') {
    throw invalidInput('润色输入模式必须是 text 或 file。');
  }

  if (input.inputMode === 'text') {
    if (typeof input.text !== 'string' || !input.text.trim() || input.documentRef !== undefined) {
      throw invalidInput('润色文本模式需要有效文本且不能混用文档引用。');
    }
    return;
  }

  if (!isDocumentInputRef(input.documentRef)) {
    throw invalidInput('润色文件模式必须使用真实 DocumentInputRef。');
  }
}

function validatePaperRevisionInput(input: InputRecord): void {
  const mode = input.inputMode;
  if (mode !== undefined && mode !== 'text' && mode !== 'file') {
    throw invalidInput('论文修改输入模式必须是 text 或 file。');
  }

  const hasText = typeof input.text === 'string' && input.text.trim().length > 0;
  const hasDocumentRef = input.documentRef !== undefined;

  if (mode === 'text' && (!hasText || hasDocumentRef)) {
    throw invalidInput('论文修改文本模式需要有效文本且不能混用文档引用。');
  }
  if (mode === 'file' && !isDocumentInputRef(input.documentRef)) {
    throw invalidInput('论文修改文件模式必须使用真实 DocumentInputRef。');
  }
  if (mode === undefined && (hasText === hasDocumentRef
    || (hasDocumentRef && !isDocumentInputRef(input.documentRef)))) {
    throw invalidInput('论文修改需要唯一且有效的文本或 DocumentInputRef。');
  }
}

function asInputRecord(value: unknown): InputRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as InputRecord;
}

function hasMetadataOnlyFileKey(input: InputRecord): boolean {
  return METADATA_ONLY_FILE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(input, key));
}

function isDocumentInputRef(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return ref.version === 1
    && (ref.provider === 'platform-file' || ref.provider === 'self-hosted-filesystem')
    && nonEmptyString(ref.bucketId)
    && nonEmptyString(ref.filePath)
    && nonEmptyString(ref.fileName)
    && (ref.sourceType === 'docx'
      || ref.sourceType === 'pdf'
      || ref.sourceType === 'txt'
      || ref.sourceType === 'markdown')
    && (ref.mimeType === undefined || typeof ref.mimeType === 'string')
    && typeof ref.sizeBytes === 'number'
    && Number.isSafeInteger(ref.sizeBytes)
    && ref.sizeBytes >= 0
    && typeof ref.sha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(ref.sha256);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalidInput(message: string): BadRequestException {
  return new BadRequestException({ code: AI_TOOL_INPUT_INVALID, message });
}
