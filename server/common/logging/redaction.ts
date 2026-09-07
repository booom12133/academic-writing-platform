const SENSITIVE_KEY_PATTERN =
  /authorization|api[-_]?key|secret|password|token|jwt|prompt|response|content|document/i;

export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (!value || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : redactLogValue(child);
  }
  return result;
}

export function redactErrorClass(error: unknown): string {
  return error instanceof Error && error.constructor.name
    ? error.constructor.name
    : 'UnknownError';
}
