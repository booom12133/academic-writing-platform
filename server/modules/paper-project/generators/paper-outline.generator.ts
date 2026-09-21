import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ProjectProfileV1, ResearchPlanV1 } from '../../../../shared/paper-project.interface';
import { LlmService } from '../../ai-tools/llm/llm.service';
import { PaperProjectError } from '../paper-project.errors';

const nodeSchema = z.object({ clientKey: z.string().min(1).max(100), parentClientKey: z.string().min(1).max(100).optional(), nodeType: z.enum(['container','writing-unit']), title: z.string().trim().min(1).max(500), position: z.number().int().nonnegative(), targetWords: z.number().int().positive().optional(), generationNotes: z.string().max(5_000).optional() }).strict();
const outputSchema = z.object({ nodes: z.array(nodeSchema).min(1).max(200) }).strict();
export type OutlineProposal = z.infer<typeof outputSchema>;

function validTree(value: OutlineProposal): boolean {
  const byKey = new Map(value.nodes.map((node) => [node.clientKey, node]));
  if (byKey.size !== value.nodes.length) return false;
  const siblingPositions = new Set<string>();
  for (const node of value.nodes) {
    if (node.parentClientKey && !byKey.has(node.parentClientKey)) return false;
    if (node.parentClientKey && byKey.get(node.parentClientKey)?.nodeType === 'writing-unit') return false;
    const sibling = `${node.parentClientKey ?? 'root'}:${node.position}`;
    if (siblingPositions.has(sibling)) return false;
    siblingPositions.add(sibling);
    const seen = new Set<string>(); let cursor: typeof node | undefined = node;
    while (cursor?.parentClientKey) { if (seen.has(cursor.parentClientKey)) return false; seen.add(cursor.parentClientKey); cursor = byKey.get(cursor.parentClientKey); }
  }
  return true;
}

@Injectable()
export class PaperOutlineGenerator {
  constructor(private readonly llm: LlmService) {}
  async generate(input: { title: string; profile: ProjectProfileV1; researchPlan?: ResearchPlanV1; requirements?: string }) {
    const prompt = `Create a hierarchical production paper outline as JSON {nodes:[{clientKey,parentClientKey?,nodeType,title,position,targetWords?,generationNotes?}]}. Writing units must be leaves. ${JSON.stringify(input)}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.llm.generate({ messages: [{ role: 'system', content: 'Return strict JSON only.' }, { role: 'user', content: attempt ? `${prompt}\nCorrect the invalid tree.` : prompt }], jsonMode: true, temperature: 0.2, maxTokens: 3000 });
      try { const parsed = outputSchema.safeParse(JSON.parse(response.content)); if (parsed.success && validTree(parsed.data)) return { result: parsed.data, metadata: { provider: response.provider, model: response.model, usage: response.usage } }; } catch { /* retry */ }
    }
    throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE', 'Outline generation returned an invalid tree.');
  }
}
