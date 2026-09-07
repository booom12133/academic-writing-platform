import type { CitationReference, EvidenceTrace } from '../grounded-generation.types';
import { BibliographyBuilder } from './bibliography.builder';

describe('BibliographyBuilder', () => {
  it('renders only resolved canonical metadata fields', () => {
    const citations: CitationReference[] = [{ citationId: 'citation-1', evidenceIds: ['chunk:one'] }];
    const traces: EvidenceTrace[] = [{
      evidenceId: 'chunk:one',
      citationLocator: { chunkId: 'one', documentVersionId: 'version-1' },
      provenance: { documentId: 'document-1' } as never,
      sourceRecord: {
        id: 'source-1', userId: 'user-1', kind: 'scholarly-work', externalProvenance: [], status: 'active', createdAt: '', updatedAt: '',
        canonicalMetadata: {
          title: { value: 'Resolved title', assertionIds: [], resolutionStatus: 'resolved' },
          doi: { value: '10.1234/not-resolved', assertionIds: [], resolutionStatus: 'conflicting' },
        },
      },
    }];

    const result = new BibliographyBuilder().build(citations, traces);

    expect(result.entries).toEqual([{ citationId: 'citation-1', fields: { title: 'Resolved title' } }]);
    expect(result.entries[0].fields).not.toHaveProperty('doi');
    expect(result.diagnostics).toEqual([{ code: 'bibliography-metadata-unresolved', citationId: 'citation-1', field: 'doi' }]);
  });

  it('omits bibliography when canonical metadata is missing', () => {
    const result = new BibliographyBuilder().build(
      [{ citationId: 'citation-1', evidenceIds: ['chunk:one'] }],
      [{ evidenceId: 'chunk:one', citationLocator: {} as never, provenance: {} as never }],
    );

    expect(result.entries).toEqual([]);
    expect(result.diagnostics[0].code).toBe('bibliography-metadata-unresolved');
  });
});
