import {
  createPaperProjectRequestSchema,
  projectSourceBindingInputSchema,
  researchPlanSchema,
} from './paper-project.schemas';

describe('P4 paper project contracts', () => {
  const profile = {
    schemaVersion: 1 as const,
    researchIdea: 'How can retrieval provenance improve academic drafting?',
    paperType: 'literature-review' as const,
    language: 'en' as const,
  };

  it('accepts a zero-upload discipline-neutral project profile', () => {
    expect(createPaperProjectRequestSchema.parse({ profile })).toEqual({ profile });
  });

  it('keeps hypotheses and propositions optional in a research plan', () => {
    expect(researchPlanSchema.parse({
      schemaVersion: 1,
      researchProblem: 'Evidence provenance is difficult to inspect.',
      researchQuestions: ['How should provenance be surfaced?'],
      researchObjectives: ['Define a transparent workflow.'],
      methodology: { approach: 'literature review', methods: ['thematic synthesis'] },
      dataMaterialRequirements: ['Peer-reviewed papers'],
      expectedContributions: ['A reusable workflow'],
      limitationsAssumptions: ['Published evidence only'],
      keywords: ['provenance'],
    }).hypotheses).toBeUndefined();
  });

  it('accepts canonical source identifiers but rejects client-derived fields', () => {
    expect(projectSourceBindingInputSchema.parse({ sourceRecordId: crypto.randomUUID() }))
      .toEqual(expect.objectContaining({ sourceRecordId: expect.any(String) }));
    expect(() => projectSourceBindingInputSchema.parse({})).toThrow();
    expect(() => projectSourceBindingInputSchema.parse({
      documentVersionId: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
    })).toThrow();
    expect(() => projectSourceBindingInputSchema.parse({
      sourceRecordId: crypto.randomUUID(),
      originClass: 'WEB_IMPORTED',
    })).toThrow();
  });
});
