import { PaperSourceService, classifyActualSupport } from './paper-source.service';

describe('P4 canonical source binding and actual support', () => {
  it('rejects a mismatched source/version chain before persistence', async () => {
    const projects = { require: jest.fn().mockResolvedValue({ lockVersion: 0 }), replaceSources: jest.fn() } as any;
    const knowledge = {
      getVersion: jest.fn().mockResolvedValue({ id: 'v1', userId: 'u', documentId: 'd1', lifecycleStatus: 'active' }),
      getDocument: jest.fn().mockResolvedValue({ id: 'd1', userId: 'u', sourceRecordId: 'source-real', lifecycleStatus: 'active' }),
      getSourceRecord: jest.fn().mockResolvedValue({ id: 'source-other', userId: 'u', externalProvenance: [] }),
    } as any;
    const service = new PaperSourceService(projects, knowledge, { getIndexStatus: jest.fn() } as any);
    await expect(service.replace('u', crypto.randomUUID(), { expectedLockVersion: 0, bindings: [{ sourceRecordId: crypto.randomUUID(), documentVersionId: crypto.randomUUID() }] }))
      .rejects.toMatchObject({ code: 'PAPER_SOURCE_CANONICAL_CHAIN_MISMATCH' });
    expect(projects.replaceSources).not.toHaveBeenCalled();
  });

  it('classifies mixed requests from evidence actually cited', () => {
    const sources = [
      { documentVersionId: 'user-v', originClass: 'USER_KNOWLEDGE' },
      { documentVersionId: 'web-v', originClass: 'WEB_IMPORTED' },
    ] as any;
    expect(classifyActualSupport('MIXED', [{ provenance: { documentVersionId: 'user-v' } }] as any, sources))
      .toEqual({ actualSupportMode: 'USER_EVIDENCE', warnings: ['Requested mixed evidence, but only user knowledge was cited.'] });
    expect(classifyActualSupport('MIXED', [{ provenance: { documentVersionId: 'user-v' } }, { provenance: { documentVersionId: 'web-v' } }] as any, sources).actualSupportMode)
      .toBe('MIXED_EVIDENCE');
  });

  it('rejects tombstoned knowledge before persisting a binding', async () => {
    const projects = { require: jest.fn().mockResolvedValue({ lockVersion: 0 }), replaceSources: jest.fn() } as any;
    const versionId = crypto.randomUUID();
    const knowledge = {
      getVersion: jest.fn().mockResolvedValue({ id: versionId, documentId: crypto.randomUUID(), lifecycleStatus: 'tombstoned' }),
      getDocument: jest.fn(),
      getSourceRecord: jest.fn(),
    } as any;
    const service = new PaperSourceService(projects, knowledge, { getLatestIndexForVersion: jest.fn() } as any);

    await expect(service.replace('u', crypto.randomUUID(), {
      expectedLockVersion: 0,
      bindings: [{ documentVersionId: versionId }],
    })).rejects.toMatchObject({ code: 'PAPER_SOURCE_OWNERSHIP_MISMATCH' });
    expect(projects.replaceSources).not.toHaveBeenCalled();
    expect(knowledge.getDocument).not.toHaveBeenCalled();
  });

  it('derives web origin and readiness from the canonical source/version chain', async () => {
    const sourceRecordId = crypto.randomUUID();
    const documentVersionId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const projects = {
      require: jest.fn().mockResolvedValue({ lockVersion: 0 }),
      replaceSources: jest.fn(async (_userId:string,_projectId:string,_expected:number,sources:any[]) => ({
        lockVersion: 1,
        sources: sources.map((source,index) => ({ id:`binding-${index}`,...source,selectionStatus:'selected',evidenceAvailability:'NOT_INDEXED' })),
      })),
    } as any;
    const knowledge = {
      getVersion: jest.fn().mockResolvedValue({ id: documentVersionId, documentId, lifecycleStatus: 'active' }),
      getDocument: jest.fn().mockResolvedValue({ id: documentId, sourceRecordId, lifecycleStatus: 'active' }),
      getSourceRecord: jest.fn().mockResolvedValue({ id: sourceRecordId, status: 'active', externalProvenance: [{ connectorKind: 'academic-discovery', provider: 'openalex' }] }),
    } as any;
    const indexes = { getLatestIndexForVersion: jest.fn().mockResolvedValue({ status: 'indexed' }) } as any;
    const service = new PaperSourceService(projects, knowledge, indexes);

    const result = await service.replace('u', crypto.randomUUID(), {
      expectedLockVersion: 0,
      bindings: [{ sourceRecordId, documentVersionId }],
    });

    expect(projects.replaceSources).toHaveBeenCalledWith('u', expect.any(String), 0, [{ sourceRecordId, documentVersionId, originClass: 'WEB_IMPORTED' }]);
    expect(result.sources[0]).toMatchObject({ originClass: 'WEB_IMPORTED', evidenceAvailability: 'READY' });
    expect(indexes.getLatestIndexForVersion).toHaveBeenCalledWith('u', documentVersionId);
  });
});
