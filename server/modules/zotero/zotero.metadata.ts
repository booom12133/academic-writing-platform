import type { Author, CanonicalFieldInput, CanonicalSourceMetadataInput, CreateSourceRecordInput, MetadataAssertionInput } from '../knowledge/knowledge.types';
import { deriveParentIdentity } from './zotero.identity';
import { ZoteroError } from './zotero.errors';
import type { ZoteroItemDto } from './zotero.types';

export interface NormalizedZoteroMetadata {
  canonicalMetadata: CanonicalSourceMetadataInput;
  metadataAssertions: MetadataAssertionInput[];
  externalProvenance: NonNullable<CreateSourceRecordInput['externalProvenance']>;
}

export function normalizeZoteroMetadata(item: ZoteroItemDto, libraryId: string): NormalizedZoteroMetadata {
  const data = item.data;
  const values = new Map<string, string | number | Author[]>();
  const title = stringValue(data.title);
  if (title) values.set('title', title);
  const authors = creatorAuthors(data.creators);
  if (authors.length) values.set('authors', authors);
  const date = stringValue(data.date);
  const year = date?.match(/\b(\d{4})\b/u)?.[1];
  if (year) values.set('year', Number(year));
  for (const [field, source] of [
    ['venue', data.publicationTitle], ['abstract', data.abstractNote], ['doi', data.DOI], ['citationKey', data.citationKey],
    ['publisher', data.publisher], ['volume', data.volume], ['issue', data.issue], ['pages', data.pages], ['url', data.url],
    ['isbn', data.ISBN], ['issn', data.ISSN], ['language', data.language],
  ] as const) {
    const value = stringValue(source);
    if (value) values.set(field, value);
  }

  const observedAt = new Date().toISOString();
  const metadataAssertions: MetadataAssertionInput[] = [];
  const canonicalMetadata: CanonicalSourceMetadataInput = {};
  for (const [field, value] of values) {
    const localKey = `zotero:${field}`;
    metadataAssertions.push({ localKey, field: field as MetadataAssertionInput['field'], value, providerKind: 'reference-manager', provider: 'zotero', externalRecordId: item.key, observedAt, verificationStatus: 'observed' });
    (canonicalMetadata as Record<string, CanonicalFieldInput<unknown>>)[field] = { value, assertionKeys: [localKey], resolutionStatus: 'resolved' };
  }

  return {
    canonicalMetadata,
    metadataAssertions,
    externalProvenance: [{ connectorKind: 'reference-manager', provider: 'zotero', externalRecordId: deriveParentIdentity(libraryId, item.key), externalVersion: String(item.version), verificationStatus: 'observed' }],
  };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function creatorAuthors(value: unknown): Author[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((creator) => {
    if (!creator || typeof creator !== 'object') return [];
    const record = creator as Record<string, unknown>;
    if (record.creatorType !== undefined && record.creatorType !== 'author') return [];
    const given = stringValue(record.firstName);
    const family = stringValue(record.lastName);
    const literal = stringValue(record.name);
    const name = literal ?? [given, family].filter(Boolean).join(' ');
    return name ? [{ name, ...(given ? { given } : {}), ...(family ? { family } : {}) }] : [];
  });
}

export function assertSupportedPdfAttachment(item: ZoteroItemDto): void {
  const data = item.data;
  const linkMode = data.linkMode;
  const contentType = stringValue(data.contentType)?.toLowerCase();
  const filename = stringValue(data.filename)?.toLowerCase();
  if (linkMode !== 'imported_file' && linkMode !== 'imported_url') {
    throw new ZoteroError('ZOTERO_ATTACHMENT_UNSUPPORTED', 'The Zotero attachment is not a stored PDF.');
  }
  if (contentType !== 'application/pdf' && !filename?.endsWith('.pdf')) {
    throw new ZoteroError('ZOTERO_ATTACHMENT_UNSUPPORTED', 'The Zotero attachment is not a PDF.');
  }
}
