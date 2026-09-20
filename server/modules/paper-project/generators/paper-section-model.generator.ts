import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../../ai-tools/llm/llm.service';
import { PaperProjectError } from '../paper-project.errors';
import { AcademicIntegrityValidator } from './academic-integrity.validator';

const outputSchema = z.object({ content: z.string().trim().min(1).max(100_000), integrityWarnings: z.array(z.string().max(1_000)).max(50) }).strict();

@Injectable()
export class PaperSectionModelGenerator {
  private readonly integrity: AcademicIntegrityValidator;
  constructor(private readonly llm: LlmService, integrity?: AcademicIntegrityValidator) { this.integrity = integrity ?? new AcademicIntegrityValidator(); }
  async generate(input: { context: string; targetWords?: number; instruction?: string }) {
    const prompt = `Draft an academic section as strict JSON {content,integrityWarnings}. Never invent citations, DOI, or observed/measured/statistical results (including numeric samples, coefficients, p-values, intervals, experiments, or findings). Methodology vocabulary and prospective statements about planned sample-size determination, coefficient estimation, or future confidence-interval reporting are allowed. Use 【待实证结果补充】 or prospective language where results are absent. Target words: ${input.targetWords ?? 'appropriate'}. Context: ${input.context}${input.instruction ? `\nInstruction: ${input.instruction}` : ''}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.llm.generate({ messages: [{ role: 'system', content: 'Return strict JSON only; this is MODEL_ONLY and cannot claim evidence.' }, { role: 'user', content: attempt ? `${prompt}\nCorrect the previous invalid or unsafe response.` : prompt }], jsonMode: true, temperature: 0.4, maxTokens: 4000 });
      try {
        const parsed = outputSchema.safeParse(JSON.parse(response.content));
        if (parsed.success) { this.integrity.validateModelOnly(parsed.data.content); return { result: parsed.data, metadata: { provider: response.provider, model: response.model, usage: response.usage } }; }
      } catch (error) { if (error instanceof PaperProjectError && error.code === 'PAPER_INTEGRITY_VALIDATION_FAILED' && attempt === 1) throw error; }
    }
    throw new PaperProjectError('PAPER_GENERATION_INVALID_RESPONSE', 'Section generation returned invalid structured output.');
  }
}
