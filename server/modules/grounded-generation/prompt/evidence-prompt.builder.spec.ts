import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';
import { EvidencePromptBuilder } from './evidence-prompt.builder';

describe('EvidencePromptBuilder', () => {
  it('labels every server-provided evidence item with its stable id', () => {
    const evidenceSet = {
      items: [
        { evidenceId: 'chunk:one', text: 'First evidence.' },
        { evidenceId: 'chunk:two', text: 'Second evidence.' },
      ],
    } as unknown as EvidenceSet;

    const messages = new EvidencePromptBuilder().build('Draft an answer.', evidenceSet);
    const prompt = messages.map((message) => message.content).join('\n');

    expect(prompt).toContain('[EVIDENCE chunk:one]');
    expect(prompt).toContain('[EVIDENCE chunk:two]');
    expect(prompt).toContain('do not output a top-level content field');
  });
});
