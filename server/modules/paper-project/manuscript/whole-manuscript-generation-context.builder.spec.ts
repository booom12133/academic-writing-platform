import type { ManuscriptSnapshot } from '../../../../shared/manuscript.interface';
import { WholeManuscriptGenerationContextBuilder } from './whole-manuscript-generation-context.builder';

function snapshot(contents: string[]): ManuscriptSnapshot {
  const outline = contents.map((_, index) => ({ id: `node-${index}`, nodeType: 'writing-unit' as const, title: `Section ${index + 1}`, position: index, status: 'active' as const, sectionId: `section-${index}` }));
  const sections = contents.map((_, index) => ({ id: `section-${index}`, outlineNodeId: `node-${index}`, status: 'active' as const, currentRevisionNumber: 1, sectionRole: 'OUTLINE' as const }));
  return {
    project: { id: 'project', selectedTitle: 'Preserved title', profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' }, researchPlan: { schemaVersion: 1, researchProblem: 'Preserved research problem', researchQuestions: ['Q'], researchObjectives: ['O'], methodology: { approach: 'analysis', methods: ['M'] }, dataMaterialRequirements: [], expectedContributions: [], limitationsAssumptions: [], keywords: [] }, defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    outline,
    sections,
    revisionsBySectionId: Object.fromEntries(contents.map((content, index) => [`section-${index}`, { id: `revision-${index}`, sectionId: `section-${index}`, revisionNumber: 1, content, contentHash: `${index}`.repeat(64), origin: 'USER_EDIT', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], generationMetadata: {}, warnings: [], createdAt: '2026-01-01T00:00:00.000Z' }])),
  };
}

describe('WholeManuscriptGenerationContextBuilder', () => {
  it('bounds context, preserves envelope, fairly covers every section, and uses head/middle/tail excerpts', () => {
    const result = new WholeManuscriptGenerationContextBuilder().build({
      snapshot: snapshot([`HEAD-A${'a'.repeat(39_990)}TAIL-A`, `HEAD-B${'b'.repeat(39_990)}TAIL-B`, `HEAD-C${'c'.repeat(39_990)}TAIL-C`]),
      operation: 'ABSTRACT',
    });
    expect(Array.from(result.text).length).toBeLessThanOrEqual(60_000);
    expect(result.text).toContain('Preserved title');
    expect(result.text).toContain('Preserved research problem');
    expect(result.metadata.includedSectionIds).toEqual(['section-0', 'section-1', 'section-2']);
    expect(result.metadata.truncatedSections).toHaveLength(3);
    expect(result.text).toContain('HEAD-A');
    expect(result.text).toContain('TAIL-A');
    expect(result.text).toContain('HEAD-C');
    expect(result.text).toContain('TAIL-C');
  });

  it('fails without calling a generator when the truthful required envelope cannot fit', () => {
    const input = snapshot(['body']);
    input.project.researchPlan!.researchProblem = 'x'.repeat(60_000);
    expect(() => new WholeManuscriptGenerationContextBuilder().build({ snapshot: input, operation: 'KEYWORDS' })).toThrow(expect.objectContaining({ code: 'PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE' }));
  });

  it('is deterministic for 10k, 50k, and 100k code-point fixtures', () => {
    for (const size of [10_000, 50_000, 100_000]) {
      const input = snapshot(['x'.repeat(size)]);
      const first = new WholeManuscriptGenerationContextBuilder().build({ snapshot: input, operation: 'ABSTRACT' });
      const second = new WholeManuscriptGenerationContextBuilder().build({ snapshot: input, operation: 'ABSTRACT' });
      expect(first).toEqual(second);
    }
  });
});
