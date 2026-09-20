import type { OutlineNode, PaperProject, PaperSectionRevision } from '../../../shared/paper-project.interface';
import { PaperWritingContextBuilder } from './paper-writing-context.builder';

const node: OutlineNode = { id: 'node', nodeType: 'writing-unit', title: 'Methods', position: 0, status: 'active', generationNotes: 'Describe the design.' };
const project = (language: 'zh-CN' | 'en'): PaperProject => ({
  id: 'project', selectedTitle: 'Evidence-aware methods',
  profile: { schemaVersion: 1, researchIdea: 'Transparent writing', discipline: 'Information science', educationLevel: 'doctoral', paperType: 'empirical-qualitative', language, targetWords: 8000, requirements: 'Use a formal academic register.' },
  researchPlan: { schemaVersion: 1, researchProblem: 'Problem', researchQuestions: ['Question'], researchObjectives: ['Objective'], methodology: { approach: 'qualitative', methods: ['interviews'] }, dataMaterialRequirements: [], expectedContributions: ['Contribution'], limitationsAssumptions: [], keywords: ['writing'] },
  defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0, createdAt: '', updatedAt: '',
});

describe('PaperWritingContextBuilder', () => {
  it.each([
    ['zh-CN', 'Write the section in Chinese (zh-CN)'],
    ['en', 'Write the section in English'],
  ] as const)('makes %s the explicit output language', (language, directive) => {
    const context = new PaperWritingContextBuilder().build({ project: project(language), outline: [node], selectedNode: node });
    expect(context.text).toContain(directive);
  });

  it('propagates paper type, requirements, education level, target words, title, and generation notes', () => {
    const context = new PaperWritingContextBuilder().build({ project: project('en'), outline: [node], selectedNode: node });
    expect(context.text).toEqual(expect.stringContaining('Paper type: empirical-qualitative'));
    expect(context.text).toEqual(expect.stringContaining('Requirements: Use a formal academic register.'));
    expect(context.text).toEqual(expect.stringContaining('Education level: doctoral'));
    expect(context.text).toEqual(expect.stringContaining('Target words: 8000'));
    expect(context.text).toEqual(expect.stringContaining('Selected title: Evidence-aware methods'));
    expect(context.text).toEqual(expect.stringContaining('Generation notes: Describe the design.'));
  });

  it('keeps required profile constraints visible even when the research idea is oversized', () => {
    const oversized=project('zh-CN');oversized.profile.researchIdea='I'.repeat(20_000);
    const context=new PaperWritingContextBuilder().build({project:oversized,outline:[node],selectedNode:node});
    expect(context.text).toContain('Write the section in Chinese (zh-CN)');
    expect(context.text).toContain('Paper type: empirical-qualitative');
    expect(context.text).toContain('Requirements: Use a formal academic register.');
    expect(context.warnings).toContain('CONTEXT_TRUNCATED:researchIdea');
  });

  it('keeps rewrite instructions and base revision when optional planning context is huge', () => {
    const huge = project('en');
    huge.researchPlan = { ...huge.researchPlan!, researchProblem: 'P'.repeat(80_000) };
    const base = { id: 'revision', sectionId: 'section', revisionNumber: 1, content: `BASE-START ${'B'.repeat(19_000)} BASE-END` } as PaperSectionRevision;
    const context = new PaperWritingContextBuilder().build({ project: huge, outline: Array.from({ length: 1000 }, (_, position) => ({ ...node, id: `node-${position}`, title: `Outline ${position}`, position })), selectedNode: node, baseRevision: base, instruction: 'Rewrite without changing the argument.' });
    expect(context.text).toContain('Rewrite without changing the argument.');
    expect(context.text).toContain('BASE-START');
    expect(context.text).toContain('BASE-END');
    expect(context.text.length).toBeLessThanOrEqual(40_000);
    expect(context.warnings).toContain('CONTEXT_TRUNCATED:researchPlan');
  });
});
