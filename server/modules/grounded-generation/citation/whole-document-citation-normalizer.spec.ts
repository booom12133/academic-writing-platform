import type { EvidenceTrace } from '../grounded-generation.types';
import { WholeDocumentCitationNormalizer } from './whole-document-citation-normalizer';

const trace = (evidenceId: string, sourceRecordId: string, version: string): EvidenceTrace => ({
  evidenceId,
  citationLocator: { chunkId: evidenceId, documentVersionId: version, sourceRecordId },
  provenance: { documentId: `document-${evidenceId}`, documentVersionId: version, sourceRecordId, sourceBlockId: 'b', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'u', sourceChunkOrdinal: 0, itemOrdinal: 0 },
  sourceRecord: { id: sourceRecordId, userId: 'user', kind: 'scholarly-work', canonicalMetadata: {}, externalProvenance: [], status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
});

describe('WholeDocumentCitationNormalizer', () => {
  it('reuses first global identities across sections and changes only managed placements', () => {
    const result = new WholeDocumentCitationNormalizer().normalize([
      {
        sectionId: 'a', revisionId: 'ra', supportState: 'VALID', content: 'User [1]. A [1]',
        citations: [{ citationId: 'citation-1', evidenceIds: ['x', 'y'] }],
        bibliography: [{ citationId: 'citation-1', fields: { title: 'Shared fields' } }],
        evidenceTrace: [trace('x', 'source-x', 'version-x'), trace('y', 'source-y', 'version-y')],
        citationPlacements: [{ schemaVersion: 1, citationId: 'citation-1', localNumber: 1, start: 12, end: 15, markerText: '[1]' }],
      },
      {
        sectionId: 'b', revisionId: 'rb', supportState: 'VALID', content: 'B [1]',
        citations: [{ citationId: 'citation-1', evidenceIds: ['x'] }],
        bibliography: [{ citationId: 'citation-1', fields: { title: 'Shared fields' } }],
        evidenceTrace: [trace('x', 'source-x', 'version-x')],
        citationPlacements: [{ schemaVersion: 1, citationId: 'citation-1', localNumber: 1, start: 2, end: 5, markerText: '[1]' }],
      },
    ]);

    expect(result.sections.map((section) => section.content)).toEqual(['User [1]. A [1][2]', 'B [1]']);
    expect(result.mapping).toEqual([
      { sectionId: 'a', localCitationId: 'citation-1', globalNumbers: [1, 2] },
      { sectionId: 'b', localCitationId: 'citation-1', globalNumbers: [1] },
    ]);
    expect(result.bibliography.map((entry) => [entry.number, entry.identity])).toEqual([[1, 'source:source-x'], [2, 'source:source-y']]);
  });

  it('preserves stale and model-only text without claiming historical citations', () => {
    const result = new WholeDocumentCitationNormalizer().normalize([
      { sectionId: 'stale', revisionId: 'rs', supportState: 'STALE_AFTER_EDIT', content: 'Edited [1]', citations: [{ citationId: 'citation-1', evidenceIds: ['x'] }], bibliography: [], evidenceTrace: [trace('x', 'source-x', 'version-x')] },
      { sectionId: 'model', revisionId: 'rm', supportState: 'NOT_CLAIMED', content: 'Ordinary [1]', citations: [], bibliography: [], evidenceTrace: [] },
    ]);
    expect(result.sections.map((section) => section.content)).toEqual(['Edited [1]', 'Ordinary [1]']);
    expect(result.citations).toEqual([]);
    expect(result.bibliography).toEqual([]);
  });

  it('fails clean normalization safely for legacy placements and conflicting identity chains', () => {
    const legacy = new WholeDocumentCitationNormalizer().normalize([{ sectionId: 'a', revisionId: 'r', supportState: 'VALID', content: 'A [1]', citations: [{ citationId: 'citation-1', evidenceIds: ['x'] }], bibliography: [], evidenceTrace: [trace('x', 'source-x', 'version-x')] }]);
    expect(legacy.warnings).toContainEqual(expect.objectContaining({ code: 'CITATION_RENUMBER_UNSAFE', severity: 'blocking' }));

    const conflictingTrace = trace('x', 'source-x', 'version-x');
    conflictingTrace.citationLocator.sourceRecordId = 'source-other';
    const conflict = new WholeDocumentCitationNormalizer().normalize([{ sectionId: 'a', revisionId: 'r', supportState: 'VALID', content: 'A [1]', citations: [{ citationId: 'citation-1', evidenceIds: ['x'] }], bibliography: [{ citationId: 'citation-1', fields: { title: 'X' } }], evidenceTrace: [conflictingTrace], citationPlacements: [{ schemaVersion: 1, citationId: 'citation-1', localNumber: 1, start: 2, end: 5, markerText: '[1]' }] }]);
    expect(conflict.warnings).toContainEqual(expect.objectContaining({ code: 'CITATION_IDENTITY_CONFLICT', severity: 'blocking' }));
  });
});
