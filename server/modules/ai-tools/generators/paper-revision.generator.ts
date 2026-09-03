import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { LlmService } from '../llm/llm.service';
import { SkillComposer } from '../skills/skill.composer';
import { SkillRegistry } from '../skills/skill.registry';
import type { InvariantValidationResult } from '../skills/validators/invariant.types';
import { InvariantValidator } from '../skills/validators/invariant.validator';
import type { LlmGenerateResult } from '../llm/llm.types';

export interface PaperRevisionInput {
  text?: string;
  revisionTypes?: string[];
  requirements?: string;
  language?: 'zh' | 'en';
  inputMode?: 'text' | 'file';
  fileName?: string;
}

export interface PaperRevisionOutput {
  originalContent: string;
  revisedContent: string;
  changeSummary: string[];
  unresolvedIssues: string[];
  authorInputNeeded: boolean;
  warnings: string[];
  validation: InvariantValidationResult;
  metadata: {
    provider: string;
    model: string;
    usage?: LlmGenerateResult['usage'];
    latencyMs: number;
  };
}

const revisionResponseSchema = z.object({
  revisedContent: z.string().trim().min(1),
  changeSummary: z.array(z.string()).default([]),
  unresolvedIssues: z.array(z.string()).default([]),
  authorInputNeeded: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
});

@Injectable()
export class PaperRevisionGenerator {
  constructor(
    private readonly llmService: LlmService,
    private readonly skillComposer: SkillComposer,
    private readonly skillRegistry: SkillRegistry,
    private readonly invariantValidator: InvariantValidator,
  ) {}

  async generate(input: PaperRevisionInput): Promise<PaperRevisionOutput> {
    const originalContent = this.requireText(input);
    const language = input.language ?? detectLanguage(originalContent);
    const stack = this.skillRegistry.getStackFor('revision', language);
    const requirements = [
      `Revision types: ${(input.revisionTypes ?? []).filter(Boolean).join(', ') || 'No specific revision type.'}`,
      input.requirements?.trim(),
    ].filter(Boolean).join('\n');
    const composed = this.skillComposer.compose(stack.id, {
      requirements,
      sourceText: originalContent,
    });
    const startedAt = Date.now();
    const response = await this.llmService.generate({
      messages: [
        { role: 'system', content: composed.system },
        { role: 'user', content: composed.user },
      ],
      jsonMode: true,
      temperature: 0.5,
      maxTokens: 5000,
    });
    const parsed = parseRevisionResponse(response.content);
    const validation = this.invariantValidator.validate({
      profile: stack.validatorProfile,
      original: originalContent,
      revised: parsed.revisedContent,
      userRequirements: input.requirements,
    });
    if (validation.status === 'ERROR') {
      throw new Error(`Invariant validation failed for academic revision: ${validation.summary.errors} error(s)`);
    }

    return {
      originalContent,
      revisedContent: parsed.revisedContent,
      changeSummary: parsed.changeSummary,
      unresolvedIssues: parsed.unresolvedIssues,
      authorInputNeeded: parsed.authorInputNeeded,
      warnings: [
        ...parsed.warnings,
        ...validation.violations.filter((violation) => violation.severity === 'WARN').map((violation) => violation.message),
      ],
      validation,
      metadata: {
        provider: response.provider,
        model: response.model,
        usage: response.usage,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  private requireText(input: PaperRevisionInput): string {
    const text = input.text?.trim();
    if (text) return input.text as string;
    if (input.inputMode === 'file' || input.fileName) {
      throw new Error('Academic revision does not support file-only input until document parsing is available');
    }
    throw new Error('Academic revision text is required');
  }
}

function parseRevisionResponse(content: string): z.infer<typeof revisionResponseSchema> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('JSON parse error: generator returned invalid academic revision JSON');
  }
  const result = revisionResponseSchema.safeParse(parsed);
  if (!result.success) throw new Error('Zod validation error: invalid academic revision output');
  if (result.data.authorInputNeeded && result.data.unresolvedIssues.length === 0) {
    throw new Error('Revision output consistency error: authorInputNeeded=true requires unresolvedIssues');
  }
  return result.data;
}

function detectLanguage(text: string): 'zh' | 'en' {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return chinese > 0 && chinese >= latin * 0.2 ? 'zh' : 'en';
}
