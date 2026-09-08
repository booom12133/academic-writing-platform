import { productHttpClient } from './http';
import {
  mapGroundedGenerationResult,
} from '../lib/grounded-writing';

export type GroundedGenerationErrorCode =
  | 'GROUNDED_GENERATION_INVALID_QUERY'
  | 'GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE'
  | 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE'
  | 'GROUNDED_GENERATION_PROVIDER_UNAVAILABLE'
  | 'GROUNDED_GENERATION_TIMEOUT'
  | 'GROUNDED_GENERATION_INVALID_RESPONSE'
  | 'GROUNDED_GENERATION_CITATION_INVALID'
  | 'GROUNDED_GENERATION_RATE_LIMITED';

export interface GroundedGenerationRequest {
  instructions: string;
  queryText: string;
  retrieval?: {
    selection?:
      | { mode: 'active' }
      | { mode: 'explicit'; documentVersionIds: string[] };
    filters?: {
      documentIds?: string[];
      sourceRecordIds?: string[];
      sourceKinds?: string[];
      originKinds?: string[];
      sourceTypes?: string[];
    };
    policy?: {
      topK?: number;
      candidateLimit?: number;
      minRetrievalScore?: number;
    };
  };
  output?: {
    format: 'markdown' | 'plain';
    citationStyle: 'numeric-inline';
  };
  grounding?: {
    onUnbound: 'block' | 'annotate';
  };
}

export interface GroundedClaim {
  claimId: string;
  text: string;
  bindingStatus: 'bound' | 'partially-bound' | 'unbound';
  evidenceRefs: Array<{ evidenceId: string }>;
}

export interface GroundedCitation {
  citationId: string;
  evidenceIds: string[];
}

export interface GroundedBibliographyEntry {
  citationId: string;
  fields: Record<string, unknown>;
}

export interface GroundedGenerationDiagnostic {
  code: string;
  unitId?: string;
  evidenceId?: string;
  detail?: string;
}

export interface GroundedEvidenceTrace {
  evidenceId: string;
  citationLocator: Record<string, unknown>;
  provenance: Record<string, unknown>;
  sourceRecord?: Record<string, unknown>;
}

export interface GroundedGenerationResult {
  schemaVersion: 1;
  status: 'grounded' | 'partial' | 'blocked';
  content: string;
  claims: GroundedClaim[];
  citations: GroundedCitation[];
  bibliography: GroundedBibliographyEntry[];
  evidenceTrace: GroundedEvidenceTrace[];
  grounding: {
    groundingCoverage: 'complete' | 'partial' | 'none';
    diagnostics: GroundedGenerationDiagnostic[];
  };
  provenance: {
    selectedVersionIds: string[];
    retrievalProfile?: Record<string, unknown>;
  };
  generation: {
    provider: string;
    model: string;
    usage?: Record<string, unknown>;
  };
}

const SAFE_MESSAGES: Record<GroundedGenerationErrorCode, string> = {
  GROUNDED_GENERATION_INVALID_QUERY: '有据写作请求无效，请检查输入内容。',
  GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE: '当前没有足够的可用证据，请先选择已建立索引的资料。',
  GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE: '证据检索暂时不可用，请稍后重试。',
  GROUNDED_GENERATION_PROVIDER_UNAVAILABLE: '有据生成服务暂时不可用，请稍后重试。',
  GROUNDED_GENERATION_TIMEOUT: '有据生成超时，请稍后重试。',
  GROUNDED_GENERATION_INVALID_RESPONSE: '有据生成返回了不可用的结果。',
  GROUNDED_GENERATION_CITATION_INVALID: '生成结果的引用绑定不完整，请调整资料或生成要求。',
  GROUNDED_GENERATION_RATE_LIMITED: '有据生成服务暂时繁忙，请稍后重试。',
};

const RETRYABLE_CODES = new Set<GroundedGenerationErrorCode>([
  'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE',
  'GROUNDED_GENERATION_PROVIDER_UNAVAILABLE',
  'GROUNDED_GENERATION_TIMEOUT',
  'GROUNDED_GENERATION_RATE_LIMITED',
]);

export class GroundedGenerationApiError extends Error {
  constructor(
    public readonly code: GroundedGenerationErrorCode | 'GROUNDED_GENERATION_REQUEST_FAILED',
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
    public readonly uiState: 'error' | 'blocked' = 'error',
    public readonly diagnostics: GroundedGenerationDiagnostic[] = [],
  ) {
    super(message);
    this.name = 'GroundedGenerationApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function generate(
  request: GroundedGenerationRequest,
): Promise<GroundedGenerationResult> {
  try {
    const response = await productHttpClient.post<unknown>(
      '/api/grounded-generation/generate',
      toGroundedGenerationPayload(request),
    );
    const result = mapGroundedGenerationResult(response.data);
    if (!result) {
      throw new GroundedGenerationApiError(
        'GROUNDED_GENERATION_INVALID_RESPONSE',
        SAFE_MESSAGES.GROUNDED_GENERATION_INVALID_RESPONSE,
      );
    }
    return result;
  } catch (error) {
    if (error instanceof GroundedGenerationApiError) throw error;
    throw normalizeGroundedGenerationError(error);
  }
}

function toGroundedGenerationPayload(
  request: GroundedGenerationRequest,
): GroundedGenerationRequest {
  const payload: GroundedGenerationRequest = {
    instructions: request.instructions.trim(),
    queryText: request.queryText.trim(),
    output: {
      format: request.output?.format ?? 'markdown',
      citationStyle: 'numeric-inline',
    },
  };
  if (request.retrieval) {
    payload.retrieval = {};
    if (request.retrieval.selection) {
      payload.retrieval.selection = request.retrieval.selection.mode === 'active'
        ? { mode: 'active' }
        : {
            mode: 'explicit',
            documentVersionIds: [...request.retrieval.selection.documentVersionIds],
          };
    }
    if (request.retrieval.filters) {
      payload.retrieval.filters = copyRetrievalFilters(request.retrieval.filters);
    }
    if (request.retrieval.policy) {
      payload.retrieval.policy = { ...request.retrieval.policy };
    }
  }
  if (request.grounding) payload.grounding = { ...request.grounding };
  return payload;
}

function copyRetrievalFilters(
  filters: NonNullable<GroundedGenerationRequest['retrieval']>['filters'],
): NonNullable<GroundedGenerationRequest['retrieval']>['filters'] {
  return {
    ...(filters?.documentIds ? { documentIds: [...filters.documentIds] } : {}),
    ...(filters?.sourceRecordIds ? { sourceRecordIds: [...filters.sourceRecordIds] } : {}),
    ...(filters?.sourceKinds ? { sourceKinds: [...filters.sourceKinds] } : {}),
    ...(filters?.originKinds ? { originKinds: [...filters.originKinds] } : {}),
    ...(filters?.sourceTypes ? { sourceTypes: [...filters.sourceTypes] } : {}),
  };
}

function normalizeGroundedGenerationError(error: unknown): GroundedGenerationApiError {
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const status = typeof response?.status === 'number' ? response.status : undefined;
  const data = isRecord(response?.data) ? response.data : undefined;
  const payload = isRecord(data?.error) ? data.error : undefined;
  const candidateCode = typeof payload?.code === 'string' ? payload.code : undefined;
  const code = isGroundedGenerationErrorCode(candidateCode)
    ? candidateCode
    : 'GROUNDED_GENERATION_REQUEST_FAILED';
  const message = code === 'GROUNDED_GENERATION_REQUEST_FAILED'
    ? '有据写作请求失败，请稍后重试。'
    : SAFE_MESSAGES[code];
  const isBlocked = code === 'GROUNDED_GENERATION_CITATION_INVALID';
  return new GroundedGenerationApiError(
    code,
    message,
    status,
    code !== 'GROUNDED_GENERATION_REQUEST_FAILED' && RETRYABLE_CODES.has(code),
    isBlocked ? 'blocked' : 'error',
    isBlocked ? parseSafeGroundingDiagnostics(payload?.details) : [],
  );
}

function parseSafeGroundingDiagnostics(value: unknown): GroundedGenerationDiagnostic[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !isNonEmptyString(item.code)) return [];
    const optionalKeys = ['unitId', 'evidenceId', 'detail'] as const;
    if (optionalKeys.some((key) => item[key] !== undefined && typeof item[key] !== 'string')) return [];
    return [{
      code: item.code.trim(),
      ...(typeof item.unitId === 'string' ? { unitId: item.unitId } : {}),
      ...(typeof item.evidenceId === 'string' ? { evidenceId: item.evidenceId } : {}),
      ...(typeof item.detail === 'string' ? { detail: item.detail } : {}),
    }];
  });
}

function isGroundedGenerationErrorCode(value: unknown): value is GroundedGenerationErrorCode {
  return typeof value === 'string' && value in SAFE_MESSAGES;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export { SAFE_MESSAGES as GROUNDED_GENERATION_SAFE_MESSAGES };
