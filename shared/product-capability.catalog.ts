import { TOOL_CONFIGS, type TaskType } from './api.interface';
import type { ProductToolCapability } from './product-capability.interface';

type CapabilityState = Pick<
  ProductToolCapability,
  'readiness' | 'execution' | 'inputModes' | 'replacementRoute' | 'supportsCopy' | 'supportsExport'
>;

const CAPABILITY_STATE: Record<TaskType, CapabilityState> = {
  thesis: { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'graduation-design': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'topic-generation': { readiness: 'production', execution: 'llm', inputModes: ['text'], supportsCopy: true, supportsExport: true },
  outline: { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'literature-review': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  literature: { readiness: 'disabled', execution: 'legacy', inputModes: ['text'], replacementRoute: '/academic-search', supportsCopy: false, supportsExport: false },
  proposal: { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'task-assignment': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'course-paper': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'journal-paper': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'practice-report': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'project-application': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'paper-revision': { readiness: 'production', execution: 'document-pipeline', inputModes: ['text', 'document-ref'], supportsCopy: true, supportsExport: true },
  'comment-revision': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  polish: { readiness: 'production', execution: 'document-pipeline', inputModes: ['text', 'document-ref'], supportsCopy: true, supportsExport: true },
  format: { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  check: { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'ai-reduce': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  chart: { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'data-analysis': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'questionnaire-design': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'paper-reverse': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
  'ai-ppt': { readiness: 'preview', execution: 'legacy', inputModes: ['text'], supportsCopy: false, supportsExport: false },
};

export const PRODUCT_CAPABILITY_CATALOG: readonly ProductToolCapability[] = TOOL_CONFIGS.map(
  (config) => ({ ...config, ...CAPABILITY_STATE[config.type] }),
);

export function getProductCapabilities(): ProductToolCapability[] {
  return PRODUCT_CAPABILITY_CATALOG.map((capability) => ({
    ...capability,
    inputModes: [...capability.inputModes],
  }));
}

export function productCapabilityFor(type: TaskType): ProductToolCapability | undefined {
  const capability = PRODUCT_CAPABILITY_CATALOG.find((entry) => entry.type === type);
  return capability
    ? { ...capability, inputModes: [...capability.inputModes] }
    : undefined;
}
