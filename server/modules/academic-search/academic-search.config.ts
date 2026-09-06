export const ACADEMIC_SEARCH_CONFIG = Symbol('ACADEMIC_SEARCH_CONFIG');

const DEVELOPMENT_CURSOR_SECRET = 'development-only-academic-search-cursor-secret';

export interface AcademicSearchConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  defaultPageSize: number;
  maxPageSize: 100;
  cursorSecret: string;
  cursorTtlMs: number;
  apiKey?: string;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveAcademicSearchConfig(env: NodeJS.ProcessEnv = process.env): AcademicSearchConfig {
  const maxRetries = Math.min(positiveInteger(env.ACADEMIC_SEARCH_MAX_RETRIES, 2), 4);
  const maxPageSize = 100 as const;
  const defaultPageSize = Math.min(positiveInteger(env.ACADEMIC_SEARCH_DEFAULT_PAGE_SIZE, 20), maxPageSize);
  const cursorSecret = env.ACADEMIC_SEARCH_CURSOR_SECRET;
  if (!cursorSecret && env.NODE_ENV === 'production') throw new Error('ACADEMIC_SEARCH_CURSOR_SECRET is required in production');
  return {
    baseUrl: env.OPENALEX_API_BASE_URL?.replace(/\/$/u, '') || 'https://api.openalex.org',
    timeoutMs: Math.min(positiveInteger(env.ACADEMIC_SEARCH_TIMEOUT_MS, 10_000), 60_000),
    maxRetries,
    retryDelayMs: Math.min(positiveInteger(env.ACADEMIC_SEARCH_RETRY_DELAY_MS, 250), 5_000),
    defaultPageSize,
    maxPageSize,
    cursorSecret: cursorSecret || DEVELOPMENT_CURSOR_SECRET,
    cursorTtlMs: Math.min(positiveInteger(env.ACADEMIC_SEARCH_CURSOR_TTL_MS, 30 * 60_000), 24 * 60 * 60_000),
    ...(env.OPENALEX_API_KEY ? { apiKey: env.OPENALEX_API_KEY } : {}),
  };
}
