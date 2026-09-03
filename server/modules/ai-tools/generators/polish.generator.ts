import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { LlmService } from '../llm/llm.service';
import { SkillComposer } from '../skills/skill.composer';
import { SkillRegistry } from '../skills/skill.registry';
import type { InvariantValidationResult } from '../skills/validators/invariant.types';
import { InvariantValidator } from '../skills/validators/invariant.validator';
import type { LlmGenerateResult } from '../llm/llm.types';

export interface PolishInput {
  text?: string;
  polishType?: string;
  language?: 'zh' | 'en';
  requirements?: string;
  inputMode?: 'text' | 'file';
  fileName?: string;
}

export interface PolishOutput {
  originalContent: string;
  revisedContent: string;
  changes: { original: string; revised: string; reason: string }[];
  warnings: string[];
  validation: InvariantValidationResult;
  metadata: {
    provider: 'deepseek';
    model: string;
    usage?: LlmGenerateResult['usage'];
    latencyMs: number;
  };
}

const polishResponseSchema = z.object({
  revisedContent: z.string().trim().min(1),
  changes: z.array(z.object({
    original: z.string(),
    revised: z.string(),
    reason: z.string(),
  })).default([]),
  warnings: z.array(z.string()).default([]),
});

@Injectable()
export class PolishGenerator {
  constructor(
    private readonly llmService: LlmService,
    private readonly skillComposer: SkillComposer,
    private readonly skillRegistry: SkillRegistry,
    private readonly invariantValidator: InvariantValidator,
  ) {}

  async generate(input: PolishInput): Promise<PolishOutput> {
    const originalContent = this.requireText(input);
    const language = input.language ?? detectLanguage(originalContent);
    const polishType = input.polishType?.trim() || 'grammar';
    const stack = this.skillRegistry.getStackFor('polish', language);
    const composed = this.skillComposer.compose(stack.id, {
      requirements: [
        `Polish type: ${polishType}`,
        input.requirements?.trim(),
      ].filter(Boolean).join('\n'),
      sourceText: originalContent,
    });
    const startedAt = Date.now();
    const response = await this.llmService.generate({
      messages: [
        { role: 'system', content: composed.system },
        { role: 'user', content: composed.user },
      ],
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 4000,
    });
    const parsed = parsePolishResponse(response.content);
    const validation = this.invariantValidator.validate({
      profile: stack.validatorProfile,
      original: originalContent,
      revised: parsed.revisedContent,
    });
    if (validation.status === 'ERROR') {
      throw new Error(`Invariant validation failed for academic polish: ${validation.summary.errors} error(s)`);
    }

    return {
      originalContent,
      revisedContent: parsed.revisedContent,
      changes: (parsed.changes ?? []).map((change) => ({
        original: change.original ?? '',
        revised: change.revised ?? '',
        reason: change.reason ?? '',
      })),
      warnings: [
        ...(parsed.warnings ?? []),
        ...validation.violations.filter((violation) => violation.severity === 'WARN').map((violation) => violation.message),
      ],
      validation,
      metadata: {
        provider: 'deepseek',
        model: response.model,
        usage: response.usage,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  private requireText(input: PolishInput): string {
    const text = input.text?.trim();
    if (text) return input.text as string;
    if (input.inputMode === 'file' || input.fileName) {
      throw new Error('Academic polish does not support file-only input until document parsing is available');
    }
    throw new Error('Academic polish text is required');
  }
}

function parsePolishResponse(content: string): z.infer<typeof polishResponseSchema> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('JSON parse error: DeepSeek returned invalid academic polish JSON');
  }
  const result = polishResponseSchema.safeParse(parsed);
  if (!result.success) throw new Error('Zod validation error: invalid academic polish output');
  return result.data;
}

function detectLanguage(text: string): 'zh' | 'en' {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return chinese > 0 && chinese >= latin * 0.2 ? 'zh' : 'en';
}
