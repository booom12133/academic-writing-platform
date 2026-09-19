import { ResearchPlanGenerator } from './research-plan.generator';
import { PaperOutlineGenerator } from './paper-outline.generator';
import { PaperSectionModelGenerator } from './paper-section-model.generator';
import { AcademicIntegrityValidator } from './academic-integrity.validator';

const result = (content: unknown) => ({ content: typeof content === 'string' ? content : JSON.stringify(content), provider: 'fake', model: 'fixture', usage: { totalTokens: 10 } });

describe('P4 structured generators', () => {
  it('retries malformed research plans once and preserves discipline-neutral output', async () => {
    const llm = { generate: jest.fn().mockResolvedValueOnce(result('not json')).mockResolvedValueOnce(result({
      schemaVersion: 1, researchProblem: 'Problem', researchQuestions: ['Question'], researchObjectives: ['Objective'],
      methodology: { approach: 'qualitative', methods: ['interviews'] }, dataMaterialRequirements: ['Participants'],
      expectedContributions: ['Insight'], limitationsAssumptions: ['Context bound'], keywords: ['qualitative'],
    })) } as any;
    const generated = await new ResearchPlanGenerator(llm).generate({ schemaVersion: 1, researchIdea: 'Idea', paperType: 'empirical-qualitative', language: 'en' });
    expect(generated.result.hypotheses).toBeUndefined();
    expect(llm.generate).toHaveBeenCalledTimes(2);
  });

  it('returns a validated hierarchical outline proposal without server ids', async () => {
    const llm = { generate: jest.fn().mockResolvedValue(result({ nodes: [
      { clientKey: 'intro', nodeType: 'container', title: 'Introduction', position: 0 },
      { clientKey: 'background', parentClientKey: 'intro', nodeType: 'writing-unit', title: 'Background', position: 0 },
    ] })) } as any;
    const generated = await new PaperOutlineGenerator(llm).generate({ title: 'Title', profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' } });
    expect(generated.result.nodes[1].parentClientKey).toBe('intro');
    expect(generated.result.nodes[1]).not.toHaveProperty('id');
  });

  it('rejects fabricated citation and result patterns from model-only output', async () => {
    const llm = { generate: jest.fn().mockResolvedValue(result({ content: 'The experiment found p = 0.01 (doi:10.1000/fake).', integrityWarnings: [] })) } as any;
    await expect(new PaperSectionModelGenerator(llm).generate({ context: 'Section', targetWords: 200 }))
      .rejects.toMatchObject({ code: 'PAPER_INTEGRITY_VALIDATION_FAILED' });
  });

  it('uses its single corrective retry when the first model-only draft is unsafe', async () => {
    const llm = { generate: jest.fn()
      .mockResolvedValueOnce(result({ content: 'Results showed p = 0.01.', integrityWarnings: [] }))
      .mockResolvedValueOnce(result({ content: 'The analysis will test the proposed relationship. 【待实证结果补充】', integrityWarnings: [] })) } as any;
    const generated = await new PaperSectionModelGenerator(llm).generate({ context: 'Section', targetWords: 200 });
    expect(generated.result.content).toContain('待实证结果补充');
    expect(llm.generate).toHaveBeenCalledTimes(2);
  });

  it.each([
    'We recruited n = 120 participants.',
    'The regression coefficient was 0.42.',
    'Results showed a significant improvement.',
    '该研究结果显示处理组表现更好。',
    'According to Smith (2024), the intervention is effective.',
    'Prior work (Smith, 2024) established this claim.',
    'We surveyed 120 students and observed a 25% increase in performance.',
  ])('rejects unsupported empirical claims: %s', (content) => {
    expect(() => new AcademicIntegrityValidator().validateModelOnly(content))
      .toThrow(expect.objectContaining({ code: 'PAPER_INTEGRITY_VALIDATION_FAILED' }));
  });

  it('allows prospective language and explicit result placeholders', () => {
    expect(() => new AcademicIntegrityValidator().validateModelOnly('We hypothesize a positive relationship. 【待实证结果补充】'))
      .not.toThrow();
  });

  it('provides the complete ResearchPlanV1 field shape to the model', async () => {
    const llm = { generate: jest.fn().mockResolvedValue(result({
      schemaVersion: 1, researchProblem: 'Problem', researchQuestions: ['Question'], researchObjectives: ['Objective'],
      methodology: { approach: 'review', methods: ['synthesis'] }, dataMaterialRequirements: [],
      expectedContributions: ['Contribution'], limitationsAssumptions: [], keywords: ['keyword'],
    })) } as any;
    await new ResearchPlanGenerator(llm).generate({ schemaVersion: 1, researchIdea: 'Idea', paperType: 'literature-review', language: 'en' });
    expect(llm.generate.mock.calls[0][0].messages[1].content).toContain('"researchProblem"');
    expect(llm.generate.mock.calls[0][0].messages[1].content).toContain('"methodology"');
  });
});
