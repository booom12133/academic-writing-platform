import type { ManuscriptSnapshot } from '../../../../shared/manuscript.interface';
import { ManuscriptProjectionService } from './manuscript-projection.service';

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
});
