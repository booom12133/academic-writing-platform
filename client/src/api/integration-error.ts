export type ProductIntegrationKind = 'academic-search' | 'zotero';

export class ProductIntegrationError extends Error {
  constructor(
    public readonly kind: ProductIntegrationKind,
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProductIntegrationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const SAFE_MESSAGES: Record<ProductIntegrationKind, Record<string, string>> = {
  'academic-search': {
    ACADEMIC_SEARCH_INVALID_QUERY: '搜索条件无效，请检查关键词和筛选条件。',
    ACADEMIC_SEARCH_CURSOR_INVALID: '搜索结果页已失效，请重新搜索。',
    ACADEMIC_SEARCH_RATE_LIMITED: '学术搜索暂时繁忙，请稍后重试。',
    ACADEMIC_SEARCH_TIMEOUT: '学术搜索超时，请稍后重试。',
    ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE: '学术搜索服务暂时不可用，请稍后重试。',
    ACADEMIC_SEARCH_INVALID_RESPONSE: '学术搜索返回了不可用的结果。',
  },
  zotero: {
    ZOTERO_INVALID_CREDENTIAL: 'Zotero 凭据无效，请重新连接。',
    ZOTERO_INSUFFICIENT_PRIVILEGES: 'Zotero 凭据缺少所需的读取权限。',
    ZOTERO_CONNECTION_DISABLED: 'Zotero 连接不可用，请重新连接。',
    ZOTERO_ITEM_NOT_FOUND: 'Zotero 条目不存在或已不可用。',
    ZOTERO_ATTACHMENT_UNSUPPORTED: '该 Zotero 附件类型暂不支持。',
    ZOTERO_ATTACHMENT_UNAVAILABLE: 'Zotero 附件暂时无法获取，请稍后重试。',
    ZOTERO_ATTACHMENT_TOO_LARGE: 'Zotero 附件超过平台支持的大小限制。',
    ZOTERO_ATTACHMENT_INTEGRITY_FAILED: 'Zotero 附件校验失败，请稍后重试。',
    ZOTERO_RATE_LIMITED: 'Zotero 服务暂时繁忙，请稍后重试。',
    ZOTERO_UPSTREAM_TIMEOUT: 'Zotero 请求超时，请稍后重试。',
    ZOTERO_UPSTREAM_FAILED: 'Zotero 服务暂时不可用，请稍后重试。',
    ZOTERO_METADATA_INVALID: 'Zotero 元数据无法导入。',
  },
};

const RETRYABLE_CODES = new Set([
  'ACADEMIC_SEARCH_RATE_LIMITED',
  'ACADEMIC_SEARCH_TIMEOUT',
  'ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE',
  'ZOTERO_ATTACHMENT_UNAVAILABLE',
  'ZOTERO_RATE_LIMITED',
  'ZOTERO_UPSTREAM_TIMEOUT',
  'ZOTERO_UPSTREAM_FAILED',
]);

export function normalizeProductIntegrationError(
  error: unknown,
  kind: ProductIntegrationKind,
): ProductIntegrationError {
  if (error instanceof ProductIntegrationError) return error;
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const status = typeof response?.status === 'number' ? response.status : undefined;
  const data = isRecord(response?.data) ? response.data : undefined;
  const payload = isRecord(data?.error) ? data.error : undefined;
  const code = typeof payload?.code === 'string' ? payload.code : `${kind.toUpperCase().replace('-', '_')}_REQUEST_FAILED`;
  const message = SAFE_MESSAGES[kind][code] ?? '外部服务请求失败，请稍后重试。';
  return new ProductIntegrationError(kind, code, message, status, RETRYABLE_CODES.has(code));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
