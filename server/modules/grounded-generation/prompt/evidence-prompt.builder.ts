import type { LlmMessage } from '../../ai-tools/llm/llm.types';
import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';

const SYSTEM_INSTRUCTIONS = [
  'Return JSON matching the GroundedModelOutput schema.',
  'Return only structured segments and units; do not output a top-level content field.',
  'Every claim, qualification, and transition unit must contain at least one evidence id.',
  'Use only evidence ids supplied in the evidence blocks.',
  'Do not output citation markers, bibliography, locators, provenance, or support classifications.',
  'Do not invent DOI, pages, authors, venues, data, results, or opinions.',
].join(' ');

export class EvidencePromptBuilder {
  build(instructions: string, evidenceSet: EvidenceSet): LlmMessage[] {
    const evidenceBlocks = evidenceSet.items.map((item) => [
      `[EVIDENCE ${item.evidenceId}]`,
      item.text,
      '[/EVIDENCE]',
    ].join('\n')).join('\n\n');
    return [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `${instructions}\n\n${evidenceBlocks}` },
    ];
  }
}
