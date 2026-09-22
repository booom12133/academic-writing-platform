const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const FILE_NAME = '[^/\\\\\\u0000-\\u001f\\u007f]+';
const DOCUMENT_KEY = new RegExp(`^academic-writing/users/[a-f0-9]{64}/${UUID}/${FILE_NAME}$`, 'u');
const EXPORT_KEY = new RegExp(`^academic-writing/users/[a-f0-9]{64}/exports/${UUID}/${UUID}/${FILE_NAME}$`, 'u');
const ENCODED_SEPARATOR = /%(?:2f|5c)/iu;

export function assertCanonicalObjectKey(objectKey: string): void {
  if (typeof objectKey !== 'string' || objectKey.length > 1_024 || objectKey.includes('..') || objectKey.includes('\\') || ENCODED_SEPARATOR.test(objectKey)) {
    throw new Error('The object storage key is invalid.');
  }
  if (!DOCUMENT_KEY.test(objectKey) && !EXPORT_KEY.test(objectKey)) {
    throw new Error('The object storage key is not a canonical generated path.');
  }
  const fileName = objectKey.split('/').at(-1) ?? '';
  if (Array.from(fileName).length > 160 || /[<>:"|?*]|[. ]$/u.test(fileName)) {
    throw new Error('The object storage filename is invalid.');
  }
}
