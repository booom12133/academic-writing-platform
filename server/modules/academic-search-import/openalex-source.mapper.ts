import type { CreateSourceRecordInput, MetadataAssertionInput } from '../knowledge/knowledge.types';
import type { ResolvedOpenAlexWork } from '../academic-search/openalex-import.gateway';

export function mapOpenAlexSource(work: ResolvedOpenAlexWork): Omit<CreateSourceRecordInput, 'userId'> {
  const item = work.result;
  const observedAt = item.provenance.retrievedAt;
  const values: Array<{ field: MetadataAssertionInput['field']; value: MetadataAssertionInput['value'] }> = [
    { field: 'title', value: item.title },
    ...(item.authors.length ? [{ field: 'authors' as const, value: item.authors.map(({ name, orcid }) => ({ name, ...(orcid ? { orcid } : {}) })) }] : []),
    ...(item.publicationYear === undefined ? [] : [{ field: 'year' as const, value: item.publicationYear }]),
    ...(item.venue ? [{ field: 'venue' as const, value: item.venue }] : []),
    ...(item.abstract ? [{ field: 'abstract' as const, value: item.abstract }] : []),
    ...(item.doi ? [{ field: 'doi' as const, value: item.doi }] : []),
    ...(item.landingPageUrl ? [{ field: 'url' as const, value: item.landingPageUrl }] : []),
  ];
  const metadataAssertions = values.map((entry, index) => ({
    localKey: `openalex-${index}-${entry.field}`,
    field: entry.field,
    value: entry.value,
    providerKind: 'academic-discovery',
    provider: 'openalex',
    externalRecordId: item.externalRecordId,
    observedAt,
    verificationStatus: 'observed' as const,
  }));
  const canonicalMetadata = Object.fromEntries(metadataAssertions.map((assertion) => [assertion.field, {
    value: assertion.value,
    assertionKeys: [assertion.localKey],
    resolutionStatus: 'resolved',
  }])) as CreateSourceRecordInput['canonicalMetadata'];
  return {
    kind: 'scholarly-work',
    canonicalMetadata,
    metadataAssertions,
    externalProvenance: [{
      connectorKind: 'academic-discovery', provider: 'openalex', externalRecordId: item.externalRecordId,
      externalVersion: work.updatedAtEpochMs, canonicalUrl: item.provenance.canonicalUrl,
      retrievedAt: observedAt, verificationStatus: 'observed',
    }],
  };
}
