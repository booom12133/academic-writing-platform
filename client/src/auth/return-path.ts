export function sanitizeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return '/';
  }

  return value;
}
