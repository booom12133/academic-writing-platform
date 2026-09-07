import type { ToolConfig, TaskType } from './api.interface';

export type ProductCapabilityReadiness = 'production' | 'preview' | 'disabled';
export type ProductInputMode = 'text' | 'document-ref' | 'knowledge-selection';
export type ProductExecutionKind = 'llm' | 'document-pipeline' | 'integration' | 'legacy';

export interface ProductToolCapability extends ToolConfig {
  type: TaskType;
  readiness: ProductCapabilityReadiness;
  execution: ProductExecutionKind;
  inputModes: ProductInputMode[];
  replacementRoute?: string;
  supportsCopy: boolean;
  supportsExport: boolean;
}
