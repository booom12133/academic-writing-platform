import type {
  ProductionResultTaskType,
  TaskResultAdapterResult,
  TaskResultEnvelope,
} from '@shared/task-result.interface';
import type { TaskType } from '@shared/api.interface';

export function adaptTaskResult(taskType: TaskType, resultData: unknown): TaskResultAdapterResult {
  if (taskType === 'polish') return adaptPolishResult(resultData);
  if (taskType === 'paper-revision') return adaptPaperRevisionResult(resultData);
  if (taskType === 'topic-generation') return adaptTopicResult(resultData);
  return { valid: false, reason: 'unsupported' };
}

export function normalizeTaskResultText(envelope: TaskResultEnvelope): string {
  return (envelope.content ?? envelope.revisedContent ?? envelope.originalContent ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function adaptPolishResult(resultData: unknown): TaskResultAdapterResult {
  if (!isRecord(resultData)
    || !nonEmptyString(resultData.originalContent)
    || !nonEmptyString(resultData.revisedContent)
    || !Array.isArray(resultData.changes)
    || !validWarnings(resultData.warnings)) {
    return { valid: false, reason: 'malformed' };
  }

  return validEnvelope('polish', {
    originalContent: resultData.originalContent,
    revisedContent: resultData.revisedContent,
    content: resultData.revisedContent,
    warnings: resultData.warnings,
    metadata: resultData.metadata,
  });
}

function adaptPaperRevisionResult(resultData: unknown): TaskResultAdapterResult {
  if (!isRecord(resultData)
    || !nonEmptyString(resultData.originalContent)
    || !nonEmptyString(resultData.revisedContent)
    || !Array.isArray(resultData.changeSummary)
    || !resultData.changeSummary.every((item) => typeof item === 'string')
    || !Array.isArray(resultData.unresolvedIssues)
    || !validWarnings(resultData.warnings)) {
    return { valid: false, reason: 'malformed' };
  }

  return validEnvelope('paper-revision', {
    originalContent: resultData.originalContent,
    revisedContent: resultData.revisedContent,
    content: resultData.revisedContent,
    warnings: resultData.warnings,
    metadata: resultData.metadata,
  });
}

function adaptTopicResult(resultData: unknown): TaskResultAdapterResult {
  if (!isRecord(resultData) || !Array.isArray(resultData.topics) || resultData.topics.length === 0) {
    return { valid: false, reason: 'malformed' };
  }

  const topics = resultData.topics;
  if (!topics.every((topic) => isRecord(topic)
    && nonEmptyString(topic.title)
    && nonEmptyString(topic.researchDirection)
    && nonEmptyString(topic.innovation)
    && nonEmptyString(topic.difficulty)
    && Array.isArray(topic.keyIdeas)
    && topic.keyIdeas.length > 0
    && topic.keyIdeas.every((idea) => typeof idea === 'string' && idea.trim().length > 0))) {
    return { valid: false, reason: 'malformed' };
  }

  const content = topics.map((topic, index) => {
    const item = topic as Record<string, unknown>;
    return [
      `${index + 1}. ${item.title as string}`,
      `研究方向：${item.researchDirection as string}`,
      `创新切入点：${item.innovation as string}`,
      `难度：${item.difficulty as string}`,
      `研究思路：${(item.keyIdeas as string[]).join('；')}`,
    ].join('\n');
  }).join('\n\n');

  return validEnvelope('topic-generation', {
    content,
    warnings: [],
    metadata: resultData.metadata,
  });
}

function validEnvelope(
  kind: ProductionResultTaskType,
  values: Partial<Pick<TaskResultEnvelope, 'content' | 'originalContent' | 'revisedContent'>>
    & Pick<TaskResultEnvelope, 'warnings'>
    & { metadata?: unknown },
): TaskResultAdapterResult {
  const { metadata, ...envelopeValues } = values;
  const envelope: TaskResultEnvelope = {
    schemaVersion: 1,
    kind,
    ...envelopeValues,
    exportable: true,
  };
  if (isRecord(metadata)) envelope.metadata = metadata;
  return { valid: true, envelope };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validWarnings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
