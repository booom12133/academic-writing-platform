import { canonicalJson, computeBodyFingerprint, countManuscriptWordsV1 } from './manuscript-fingerprint';
import type { ManuscriptSnapshot } from '../../../../shared/manuscript.interface';

const snapshot = (): ManuscriptSnapshot => ({
  project: {
    id: 'project',
    selectedTitle: 'A title',
    profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' },
    researchPlan: {
      schemaVersion: 1,
      researchProblem: 'Problem',
      researchQuestions: ['Q'],
      researchObjectives: ['O'],
      methodology: { approach: 'qualitative', methods: ['analysis'] },
      dataMaterialRequirements: [], expectedContributions: [], limitationsAssumptions: [], keywords: [],
    },
    defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  outline: [{ id: 'node', nodeType: 'writing-unit', title: 'Intro', position: 0, status: 'active', sectionId: 'section' }],
  sections: [{ id: 'section', outlineNodeId: 'node', status: 'active', currentRevisionNumber: 1, sectionRole: 'OUTLINE' }],
  revisionsBySectionId: {
    section: { id: 'revision', sectionId: 'section', revisionNumber: 1, content: 'Body', contentHash: 'hash', origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' },
  },
});

describe('manuscript fingerprints', () => {
  it('canonicalizes object keys without reordering arrays', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 }, list: [2, 1] })).toBe('{"a":{"x":3,"y":2},"list":[2,1],"z":1}');
  });

  it('changes when an exact current revision identity changes', () => {
    const original = snapshot();
    const changed = snapshot();
    changed.revisionsBySectionId.section!.id = 'revision-2';
    expect(computeBodyFingerprint(original)).not.toBe(computeBodyFingerprint(changed));
    expect(computeBodyFingerprint(snapshot())).toBe(computeBodyFingerprint(snapshot()));
  });

  it('counts each CJK code point and each contiguous Unicode word or number token', () => {
    expect(countManuscriptWordsV1('研究 AI tools 2026 😀')).toBe(5);
  });
});
