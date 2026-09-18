import { AcademicSearchImportService } from './academic-search-import.service';

const work = (pdfUrl?: string) => ({
  updatedAtEpochMs: '1770000000000',
  result: {
    provider: 'openalex' as const, externalRecordId: 'https://openalex.org/W123', title: 'Imported paper', authors: [], abstract: 'Abstract is metadata',
    ...(pdfUrl ? { pdfUrl } : {}),
    provenance: { provider: 'openalex' as const, externalRecordId: 'https://openalex.org/W123', canonicalUrl: 'https://openalex.org/W123', retrievedAt: '2026-09-18T00:00:00.000Z', providerRank: 1, queryFingerprint: 'x', verificationStatus: 'observed' as const },
  },
});

describe('AcademicSearchImportService', () => {
  function harness(pdfUrl?: string) {
    const source = { id: 'source-1', userId: 'user-1', kind: 'scholarly-work', canonicalMetadata: {}, externalProvenance: [], status: 'active' };
    const gateway = { resolveWork: jest.fn().mockResolvedValue(work(pdfUrl)), fetchPdf: jest.fn().mockResolvedValue({ kind: 'downloaded', buffer: Buffer.from('%PDF-safe') }) };
    const repository = { createSourceRecord: jest.fn().mockResolvedValue(source), findSourceRecordByExternalIdentity: jest.fn().mockResolvedValue(null), findDocumentByExternalIdentity: jest.fn().mockResolvedValue(null) };
    const document = { version: 1, provider: 'self-hosted-filesystem', bucketId: 'self-hosted-filesystem', filePath: 'academic-writing/users/a'.padEnd(87, 'a'), fileName: 'W123.pdf', sourceType: 'pdf', sizeBytes: 9, sha256: 'b'.repeat(64) };
    const documentInput = { upload: jest.fn().mockResolvedValue({ document }), removeOwned: jest.fn().mockResolvedValue(undefined) };
    const knowledge = { importDocument: jest.fn().mockResolvedValue({ document: { id: 'document-1' }, version: { id: 'version-1' }, chunks: [{}], idempotent: false }), createNextVersion: jest.fn() };
    const sourceProjection = { id: 'source-1', kind: 'scholarly-work', title: 'Imported paper', abstract: 'Abstract is metadata', contentStatus: pdfUrl ? 'full-text-linked' : 'metadata-only', isGroundedEvidence: false };
    const product = { listSources: jest.fn().mockResolvedValue([sourceProjection]), getDocument: jest.fn().mockResolvedValue({ document: { id: 'document-1' } }) };
    return { service: new AcademicSearchImportService(gateway as never, repository as never, documentInput as never, knowledge as never, product as never), gateway, repository, documentInput, knowledge };
  }

  it('creates a metadata-only source without chunks, index, or evidence when no PDF is advertised', async () => {
    const { service, gateway, documentInput, knowledge } = harness();
    await expect(service.import('user-1', { provider: 'openalex', externalRecordId: 'W123' })).resolves.toMatchObject({ kind: 'metadata-only', fullTextReason: 'not-advertised', uploadRequired: true, source: { isGroundedEvidence: false } });
    expect(gateway.fetchPdf).not.toHaveBeenCalled();
    expect(documentInput.upload).not.toHaveBeenCalled();
    expect(knowledge.importDocument).not.toHaveBeenCalled();
  });

  it('sends a valid PDF through the existing document/knowledge pipeline and stops before indexing', async () => {
    const { service, documentInput, knowledge } = harness('https://papers.example/paper.pdf');
    await expect(service.import('user-1', { provider: 'openalex', externalRecordId: 'https://openalex.org/W123' })).resolves.toMatchObject({ kind: 'full-text', indexStatus: 'not-indexed', uploadRequired: false });
    expect(documentInput.upload).toHaveBeenCalledWith('user-1', expect.objectContaining({ mimetype: 'application/pdf' }));
    expect(knowledge.importDocument).toHaveBeenCalledWith(expect.objectContaining({
      sourceRecordId: 'source-1', originKind: 'external-attachment', input: { kind: 'stored-file', documentRef: expect.any(Object) },
    }));
    expect(JSON.stringify(knowledge.importDocument.mock.calls[0][0])).not.toContain('Abstract is metadata');
  });

  it('rejects client-supplied metadata and PDF URLs', async () => {
    const { service } = harness();
    await expect(service.import('user-1', { provider: 'openalex', externalRecordId: 'W123', pdfUrl: 'https://evil.example/a.pdf' })).rejects.toThrow(/invalid/i);
  });
});
