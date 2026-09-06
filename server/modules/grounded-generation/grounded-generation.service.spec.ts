import type { EvidenceSet } from '../knowledge/retrieval/evidence-assembly';
import type { TextGenerationResult } from '../ai-tools/llm/llm.types';
import type { GroundedGenerationRequest } from './grounded-generation.types';
import { GroundedGenerationService } from './grounded-generation.service';

function evidenceSet(): EvidenceSet {
  return {
    status: 'complete',
    selectedVersionIds: ['version-1'],
    items: [{
      evidenceId: 'chunk:one', text: 'Evidence.',
      citationLocator: { chunkId: 'one', documentVersionId: 'version-1' },
      provenance: { documentId: 'document-1' },
    } as never],
    diagnostics: [],
    profile: undefined,
  };
}

const request: GroundedGenerationRequest = {
  instructions: 'Draft a grounded sentence.',
  queryText: 'grounded query',
};

const modelResult: TextGenerationResult = {
  content: JSON.stringify({
    segments: [{
      segmentId: 'segment-1',
      units: [{ unitId: 'unit-1', unitType: 'claim', text: 'Grounded sentence.', evidenceRefs: [{ evidenceId: 'chunk:one' }] }],
    }],
  }),
  provider: 'test-provider',
  model: 'test-model',
};

describe('GroundedGenerationService', () => {
  it('returns synchronously rendered grounded content from E3 evidence and D4 output', async () => {
    const evidence = { retrieve: jest.fn().mockResolvedValue(evidenceSet()) };
    const llm = { generate: jest.fn().mockResolvedValue(modelResult) };
    const result = await new GroundedGenerationService(evidence, llm).generate('user-1', request);

    expect(result.status).toBe('grounded');
    expect(result.content).toBe('Grounded sentence. [1]');
    expect(result.claims[0].bindingStatus).toBe('bound');
    expect(llm.generate).toHaveBeenCalledWith(expect.objectContaining({ jsonMode: true }));
  });

  it('blocks unbound units by default', async () => {
    const evidence = { retrieve: jest.fn().mockResolvedValue(evidenceSet()) };
    const llm = { generate: jest.fn().mockResolvedValue({ ...modelResult, content: JSON.stringify({ segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'transition', text: 'Unbound.', evidenceRefs: [{ evidenceId: 'chunk:missing' }] }] }] }) }) };

    await expect(new GroundedGenerationService(evidence, llm).generate('user-1', request)).rejects.toMatchObject({
      code: 'GROUNDED_GENERATION_CITATION_INVALID',
      httpStatus: 422,
    });
  });

  it('returns partial annotated output when explicitly requested', async () => {
    const evidence = { retrieve: jest.fn().mockResolvedValue(evidenceSet()) };
    const llm = { generate: jest.fn().mockResolvedValue({ ...modelResult, content: JSON.stringify({ segments: [{ segmentId: 'segment-1', units: [{ unitId: 'unit-1', unitType: 'transition', text: 'Annotated.', evidenceRefs: [{ evidenceId: 'chunk:missing' }] }] }] }) }) };

    const result = await new GroundedGenerationService(evidence, llm).generate('user-1', { ...request, grounding: { onUnbound: 'annotate' } });

    expect(result.status).toBe('partial');
    expect(result.content).toContain('[unbound]');
    expect(result.grounding.groundingCoverage).toBe('none');
  });

  it('rejects structurally empty evidence before calling the provider', async () => {
    const evidence = { retrieve: jest.fn().mockResolvedValue({ ...evidenceSet(), status: 'empty', items: [] }) };
    const llm = { generate: jest.fn() };

    await expect(new GroundedGenerationService(evidence, llm).generate('user-1', request)).rejects.toMatchObject({
      code: 'GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE',
      httpStatus: 422,
    });
    expect(llm.generate).not.toHaveBeenCalled();
  });

  it('does not treat an AcademicDiscoverySet-shaped object as evidence', async () => {
    const evidence = { retrieve: jest.fn().mockResolvedValue({ status: 'complete', items: [{ provider: 'openalex', title: 'Discovery only' }] }) };
    const llm = { generate: jest.fn() };

    await expect(new GroundedGenerationService(evidence, llm).generate('user-1', request)).rejects.toMatchObject({
      code: 'GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE',
    });
    expect(llm.generate).not.toHaveBeenCalled();
  });
});
