import { mapOpenAlexSource } from './openalex-source.mapper';

describe('OpenAlex source mapper', () => {
  it('keeps abstract as observed source metadata and never creates document text input', () => {
    const mapped = mapOpenAlexSource({
      updatedAtEpochMs: '1770000000000',
      result: {
        provider: 'openalex', externalRecordId: 'https://openalex.org/W123', title: 'A paper',
        authors: [{ name: 'A. Author' }], publicationYear: 2026, venue: 'Journal', abstract: 'Metadata abstract only', doi: '10.1000/test',
        provenance: { provider: 'openalex', externalRecordId: 'https://openalex.org/W123', canonicalUrl: 'https://openalex.org/W123', retrievedAt: '2026-09-18T00:00:00.000Z', providerRank: 1, queryFingerprint: 'x', verificationStatus: 'observed' },
      },
    });
    expect(mapped.canonicalMetadata?.abstract?.value).toBe('Metadata abstract only');
    expect(mapped.metadataAssertions).toContainEqual(expect.objectContaining({ field: 'abstract', verificationStatus: 'observed' }));
    expect(JSON.stringify(mapped)).not.toContain('sourceText');
    expect(mapped.externalProvenance?.[0]).toMatchObject({ connectorKind: 'academic-discovery', provider: 'openalex' });
  });
});
