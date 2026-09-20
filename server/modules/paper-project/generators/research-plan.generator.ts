import { Injectable } from '@nestjs/common';
import type { ProjectProfileV1, ResearchPlanV1 } from '../../../../shared/paper-project.interface';
import { LlmService } from '../../ai-tools/llm/llm.service';
import { researchPlanSchema } from '../domain/paper-project.schemas';
import { PaperProjectError } from '../paper-project.errors';

@Injectable()
export class ResearchPlanGenerator {
  constructor(private readonly llm: LlmService) {}
  async generate(profile: ProjectProfileV1, options?: { selectedTitle?: string; instructions?: string }) {
    const shape = { schemaVersion: 1, researchProblem: 'string', researchQuestions: ['string'], hypotheses: [{ id: 'string', statement: 'string', rationale: 'optional string' }], propositions: [{ id: 'string', statement: 'string', rationale: 'optional string' }], researchObjectives: ['string'], methodology: { approach: 'string', design: 'optional string', methods: ['string'], dataOrMaterials: ['string'], samplingOrSelection: 'optional string', analysisPlan: ['string'], validationPlan: ['string'] }, dataMaterialRequirements: ['string'], expectedContributions: ['string'], limitationsAssumptions: ['string'], keywords: ['string'] };
    const base = `Create a discipline-neutral research plan as strict JSON for this profile: ${JSON.stringify(profile)}.${options?.selectedTitle ? ` The selected paper title is: ${JSON.stringify(options.selectedTitle)}.` : ''} Required ResearchPlanV1 field shape: ${JSON.stringify(shape)}. hypotheses and propositions are optional and may be omitted; the other top-level fields are required. Planned or expected results must not be stated as observed facts.${options?.instructions ? ` Instructions: ${options.instructions}` : ''}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.llm.generate({ messages: [{ role: 'system', content: 'Return only valid JSON matching ResearchPlanV1.' }, { role: 'user', content: attempt ? `${base}\nCorrect the previous invalid structure.` : base }], jsonMode: true, temperature: 0.2, maxTokens: 2400 });
      try {
        const parsed = researchPlanSchema.safeParse(JSON.parse(response.content));
        if (parsed.success) return { result: parsed.data as ResearchPlanV1, metadata: { provider: response.provider, model: response.model, usage: response.usage } };
      } catch { /* one corrective retry */ }
    }
    throw new PaperProjectError('PAPER_GENERATION_INVALID_RESPONSE', 'Research plan generation returned invalid structured output.');
  }
}
