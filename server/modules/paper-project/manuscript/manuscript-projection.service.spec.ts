import type { ManuscriptSnapshot } from '../../../../shared/manuscript.interface';
import { ManuscriptProjectionService } from './manuscript-projection.service';
import { computeBodyFingerprint, computeConclusionBasisFingerprint } from './manuscript-fingerprint';

function fixture(): ManuscriptSnapshot {
  return {
    project: { id: 'project', profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'zh-CN' }, defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    outline: [
      { id: 'root', nodeType: 'container', title: '第一章', position: 0, status: 'active' },
      { id: 'node-a', parentId: 'root', nodeType: 'writing-unit', title: '研究背景', position: 0, status: 'active', sectionId: 'section-a' },
      { id: 'node-b', parentId: 'root', nodeType: 'writing-unit', title: '研究方法', position: 1, status: 'active', sectionId: 'section-b' },
    ],
    sections: [
      { id: 'section-a', outlineNodeId: 'node-a', status: 'active', currentRevisionNumber: 1, sectionRole: 'OUTLINE' },
      { id: 'section-b', outlineNodeId: 'node-b', status: 'active', currentRevisionNumber: 0, sectionRole: 'OUTLINE' },
      { id: 'orphan', status: 'orphaned', currentRevisionNumber: 1, sectionRole: 'OUTLINE' },
    ],
    revisionsBySectionId: {
      'section-a': { id: 'revision-a', sectionId: 'section-a', revisionNumber: 1, content: '真实正文', contentHash: 'hash-a', origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' },
      orphan: { id: 'revision-orphan', sectionId: 'orphan', revisionNumber: 1, content: '不得进入正文', contentHash: 'hash-o', origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' },
    },
  };
}

describe('ManuscriptProjectionService', () => {
  it('keeps missing headings explicit and excludes orphaned content', async () => {
    const service = new ManuscriptProjectionService({ loadManuscriptSnapshot: jest.fn().mockResolvedValue(fixture()) } as any);
    const projection = await service.getProjection('user', 'project');

    expect(projection.readiness).toBe('INCOMPLETE');
    expect(projection.blocks).toContainEqual(expect.objectContaining({ kind: 'missing-section', nodeId: 'node-b' }));
    expect(JSON.stringify(projection.blocks)).not.toContain('不得进入正文');
    expect(projection.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'TITLE_MISSING', 'RESEARCH_PLAN_MISSING', 'MISSING_SECTION', 'ORPHANED_SECTION_EXCLUDED', 'DERIVED_CONTENT_MISSING',
    ]));
  });

  it('projects placement-normalized citations and one global references block', async () => {
    const snapshot = fixture();
    const revision = snapshot.revisionsBySectionId['section-a']!;
    revision.content = 'User [1]. Claim [1]';
    revision.supportState = 'VALID';
    revision.citations = [{ citationId: 'citation-1', evidenceIds: ['evidence-1'] }];
    revision.bibliography = [{ citationId: 'citation-1', fields: { title: 'Verified title' } }];
    revision.evidenceTrace = [{
      evidenceId: 'evidence-1',
      citationLocator: { chunkId: 'chunk', documentVersionId: 'version', sourceRecordId: 'source' },
      provenance: { documentId: 'document', documentVersionId: 'version', sourceRecordId: 'source', sourceBlockId: 'b', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'u', sourceChunkOrdinal: 0, itemOrdinal: 0 },
      sourceRecord: { id: 'source', userId: 'user', kind: 'scholarly-work', canonicalMetadata: {}, externalProvenance: [], status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    }];
    revision.generationMetadata = { citationPlacements: [{ schemaVersion: 1, citationId: 'citation-1', localNumber: 1, start: 16, end: 19, markerText: '[1]' }] };
    const service = new ManuscriptProjectionService({ loadManuscriptSnapshot: jest.fn().mockResolvedValue(snapshot) } as any);

    const projection = await service.getProjection('user', 'project');

    expect(projection.blocks.filter((block) => block.kind === 'references')).toEqual([{ kind: 'references', entries: [{ number: 1, identity: 'source:source', fields: { title: 'Verified title' } }] }]);
    expect(projection.supportSummary.managedCitationCount).toBe(1);
    expect(projection.citations[0]).toMatchObject({ number: 1, identity: 'source:source' });
  });

  it('tracks derived freshness and conclusion freshness without self-staling the target revision', async () => {
    const snapshot = fixture();
    snapshot.project.selectedTitle = 'Title';
    const bodyFingerprint = computeBodyFingerprint(snapshot);
    for (const [role, id] of [['ABSTRACT', 'abstract'], ['KEYWORDS', 'keywords']] as const) {
      snapshot.sections.push({ id, sectionRole: role, status: 'active', currentRevisionNumber: 1 });
      snapshot.revisionsBySectionId[id] = { id: `${id}-revision`, sectionId: id, revisionNumber: 1, content: id, contentHash: id.padEnd(64, '0'), origin: 'AI_GENERATION', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: { operation: 'DERIVED_GENERATION', derivedRole: role, derivedFromBodyFingerprint: bodyFingerprint }, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' };
    }
    const conclusion = snapshot.revisionsBySectionId['section-a']!;
    conclusion.generationMetadata = { operation: 'CONCLUSION_REFRESH', conclusionTargetSectionId: 'section-a', conclusionBasisFingerprint: computeConclusionBasisFingerprint(snapshot, 'section-a') };
    const service = new ManuscriptProjectionService({ loadManuscriptSnapshot: jest.fn().mockResolvedValue(snapshot) } as any);
    const current = await service.getProjection('user', 'project');
    expect(current.derived.abstract.state).toBe('CURRENT');
    expect(current.warnings).not.toContainEqual(expect.objectContaining({ code: 'CONCLUSION_REFRESH_STALE' }));

    snapshot.project.selectedTitle = 'Changed title';
    const stale = service.project(snapshot);
    expect(stale.warnings).toContainEqual(expect.objectContaining({ code: 'CONCLUSION_REFRESH_STALE', sectionId: 'section-a' }));

    conclusion.generationMetadata = { operation: 'USER_SAVE' };
    const userEdited = service.project(snapshot);
    expect(userEdited.warnings).not.toContainEqual(expect.objectContaining({ code: 'CONCLUSION_REFRESH_STALE' }));
  });
});
