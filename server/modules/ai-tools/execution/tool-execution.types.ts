import type { DocumentInputRef } from '@shared/document-input.interface';
import type { ContextHeadingRef, ContextTaskType } from '../../context-builder/context-builder.types';
import type {
  ChunkedTaskContext,
  ChunkingPolicy,
  ChunkItem,
  TextFragmentChunkItem,
  WholeUnitChunkItem,
} from '../../chunking/chunking.types';
import type { InvariantValidationResult } from '../skills/validators/invariant.types';
import type { LlmUsage } from '../llm/llm.types';

export const TOOL_EXECUTION_CONTRACT_VERSION = 1 as const;

export interface ToolPreparationInput {
  userId: string;
  taskType: ContextTaskType;
  userInstructions?: string;
  chunkingPolicy: ChunkingPolicy;
  source:
    | { mode: 'text'; text: string }
    | { mode: 'file'; documentRef: DocumentInputRef };
}

export interface PreparedToolInput {
  context: ChunkedTaskContext;
  documentRef?: DocumentInputRef;
}

export interface ToolChunkProvenance {
  chunkId: string;
  section: 'content' | 'references';
  sourceBlockId: string;
  sourceBlockIndex: number;
  fragmentId?: string;
  span?: { start: number; endExclusive: number };
  headingPath: ContextHeadingRef[];
  pageNumber?: number;
}

export interface RenderedToolItem {
  itemId: string;
  kind: ChunkItem['kind'];
  text: string;
  provenance: ToolChunkProvenance;
}

export interface RenderedToolChunk {
  chunkId: string;
  sourceId: 'document-1';
  section: 'content' | 'references';
  eligibleForExecution: boolean;
  text: string;
  items: RenderedToolItem[];
  provenance: ToolChunkProvenance[];
}

export interface ToolChunkExecutionInput {
  taskType: ContextTaskType;
  userInstructions?: string;
  options: Record<string, unknown>;
  chunk: RenderedToolChunk;
}

export interface ToolChunkExecutionResult {
  output?: Record<string, unknown>;
  warnings?: string[];
  validation?: InvariantValidationResult;
  usage?: LlmUsage;
}

export interface ToolChunkExecutor {
  execute(input: ToolChunkExecutionInput): Promise<ToolChunkExecutionResult>;
}

export interface ToolExecutionChunkRecord {
  chunk: RenderedToolChunk;
  mode: 'executed' | 'pass-through';
  provenance: ToolChunkProvenance[];
  result?: ToolChunkExecutionResult;
}

export interface AggregatedValidation {
  status: InvariantValidationResult['status'];
  results: Array<{ chunkId: string; validation: InvariantValidationResult }>;
  summary: { errors: number; warnings: number };
}

export interface AcademicToolExecutionResult {
  version: typeof TOOL_EXECUTION_CONTRACT_VERSION;
  task: ChunkedTaskContext['task'];
  source: ChunkedTaskContext['source'];
  chunks: ToolExecutionChunkRecord[];
  warnings: string[];
  validation: AggregatedValidation;
  usage: Required<LlmUsage>;
}

export type RenderableChunkItem = WholeUnitChunkItem | TextFragmentChunkItem;
