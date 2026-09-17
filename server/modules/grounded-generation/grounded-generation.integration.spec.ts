import type { EvidenceSet } from '../knowledge/retrieval/evidence-assembly';
import type { TextGenerationResult } from '../ai-tools/llm/llm.types';
import { GroundedEvidenceAdapter } from './evidence/grounded-evidence.adapter';
import { GroundedGenerationService } from './grounded-generation.service';

function evidenceSet(): EvidenceSet {
  return {
    status: 'complete', selectedVersionIds: ['version-1'], diagnostics: [],
    items: [{
      evidenceId: 'chunk:one', text: 'Zotero PDF evidence.',
      citationLocator: { chunkId: 'one', documentVersionId: 'version-1', sourceRecordId: 'source-1' },
      provenance: { documentId: 'document-1', documentVersionId: 'version-1', sourceBlockId: 'block-1', sourceBlockIndex: 0, section: 'content', headingPath: [], sourceUnitId: 'unit-1', sourceChunkOrdinal: 0, itemOrdinal: 0 },
      sourceIdentity: {
        id: 'source-1', userId: 'user-1', kind: 'scholarly-work', externalProvenance: [], status: 'active', createdAt: '', updatedAt: '',
        canonicalMetadata: { title: { value: 'Resolved Zotero title', assertionIds: [], resolutionStatus: 'resolved' } },
      },
    } as never],
    profile: undefined,
  } as unknown as EvidenceSet;
}

const validModelResult: TextGenerationResult = {
  content: JSON.stringify({ segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'claim', text: 'Generated claim.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }] }] }),
  provider: 'test-provider', model: 'test-model',
};

const productionInvalidModelResult: TextGenerationResult = {
  content: JSON.stringify({
    segments: [{
      type: 'claim',
      text: 'Generated claim.',
      evidenceIds: ['chunk:one'],
    }],
  }),
  provider: 'test-provider', model: 'test-model',
};

describe('grounded generation integration', () => {
  it('keeps E3 evidence provenance through generation, citation, and bibliography', async () => {
    const facade = { retrieve: jest.fn().mockResolvedValue(evidenceSet()) };
    const generate = jest.fn().mockResolvedValue(validModelResult);
    const service = new GroundedGenerationService(new GroundedEvidenceAdapter(facade), { generate });
    const queryText = 'What does the selected document conclude?';

    const result = await service.generate('user-1', { instructions: 'Draft.', queryText });
    const initialPrompt = generate.mock.calls[0][0].messages
      .map((message: { content: string }) => message.content)
      .join('\n');

    expect(result.content).toBe('Generated claim. [1]');
    expect(result.evidenceTrace[0].provenance.documentId).toBe('document-1');
    expect(result.evidenceTrace[0].citationLocator.sourceRecordId).toBe('source-1');
    expect(result.bibliography).toEqual([{ citationId: 'citation-1', fields: { title: 'Resolved Zotero title' } }]);
    expect(initialPrompt).toContain(`Research question / generation objective:\n${queryText}`);
  });

  it('retries one production-shaped invalid response with the same research question', async () => {
    const facade = { retrieve: jest.fn().mockResolvedValue(evidenceSet()) };
    const generate = jest.fn()
      .mockResolvedValueOnce(productionInvalidModelResult)
      .mockResolvedValueOnce(validModelResult);
    const service = new GroundedGenerationService(new GroundedEvidenceAdapter(facade), { generate });
    const researchQuestion = 'What does the selected document conclude?';

    const result = await service.generate('user-1', {
      instructions: 'Draft a grounded answer.',
      queryText: researchQuestion,
    });
    const initialPrompt = generate.mock.calls[0][0].messages
      .map((message: { content: string }) => message.content)
      .join('\n');
    const correctivePrompt = generate.mock.calls[1][0].messages
      .map((message: { content: string }) => message.content)
      .join('\n');

    expect(facade.retrieve).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][0]).toMatchObject({ jsonMode: true, temperature: 0 });
    expect(initialPrompt).toContain(`Research question / generation objective:\n${researchQuestion}`);
    expect(correctivePrompt).toContain(`Research question / generation objective:\n${researchQuestion}`);
    expect(generate.mock.calls[1][0].messages.at(-1).content).toContain('previous provider response failed');
    expect(result).toMatchObject({
      status: 'grounded',
      content: 'Generated claim. [1]',
      grounding: { groundingCoverage: 'complete' },
      provenance: { selectedVersionIds: ['version-1'] },
      generation: { provider: 'test-provider', model: 'test-model' },
    });
    expect(result.claims).not.toHaveLength(0);
    expect(result.citations).not.toHaveLength(0);
    expect(result.bibliography).not.toHaveLength(0);
    expect(result.evidenceTrace).not.toHaveLength(0);
  });

  it('fails closed after a corrective response also violates the schema', async () => {
    const facade = { retrieve: jest.fn().mockResolvedValue(evidenceSet()) };
    const generate = jest.fn().mockResolvedValue(productionInvalidModelResult);
    const service = new GroundedGenerationService(new GroundedEvidenceAdapter(facade), { generate });

    await expect(service.generate('user-1', {
      instructions: 'Draft a grounded answer.',
      queryText: 'What does the selected document conclude?',
    })).rejects.toMatchObject({
      code: 'GROUNDED_GENERATION_INVALID_RESPONSE',
      httpStatus: 502,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(facade.retrieve).toHaveBeenCalledTimes(1);
  });
});
