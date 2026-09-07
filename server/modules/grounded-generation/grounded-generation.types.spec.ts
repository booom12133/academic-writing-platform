import type { CitationLocator, KnowledgeChunkProvenance } from '../knowledge/knowledge.types';
import type { EvidenceSet } from '../knowledge/retrieval/evidence-assembly';
import {
  type ClaimUnit,
  type GroundedGenerationRequest,
  type GroundedGenerationResult,
  type GroundedModelOutput,
  type GroundedEvidenceRef,
} from './grounded-generation.types';

describe('grounded generation contracts', () => {
  it('requires every generated unit to carry at least one evidence id', () => {
    const ref: GroundedEvidenceRef = { evidenceId: 'chunk:evidence-1' };
    const unit: ClaimUnit = {
      unitId: 'unit-1',
      unitType: 'transition',
      text: 'The transition is grounded.',
      evidenceRefs: [ref],
    };

    expect(unit.evidenceRefs).toHaveLength(1);
    expect('supportType' in ref).toBe(false);
  });

  it('models structured output without an independent content channel', () => {
    const output: GroundedModelOutput = { segments: [] };
    expect(output).not.toHaveProperty('content');
  });

  it('keeps locator and chunk provenance as separate result fields', () => {
    const locator = {} as CitationLocator;
    const provenance = {} as KnowledgeChunkProvenance;
    const evidenceTrace = { evidenceId: 'chunk:evidence-1', citationLocator: locator, provenance };
    const result = {
      evidenceTrace: [evidenceTrace],
    } as unknown as GroundedGenerationResult;

    expect(result.evidenceTrace[0].citationLocator).toBe(locator);
    expect(result.evidenceTrace[0].provenance).toBe(provenance);
  });

  it('retains the E3 evidence set as an input contract', () => {
    const input = {} as EvidenceSet;
    expect(input).toBeDefined();
  });

  it('types optional parent controls with required approved inner fields', () => {
    const request: GroundedGenerationRequest = {
      instructions: 'Write.',
      queryText: 'query',
      output: { format: 'markdown', citationStyle: 'numeric-inline' },
      grounding: { onUnbound: 'block' },
    };

    expect(request.output?.citationStyle).toBe('numeric-inline');
    expect(request.grounding?.onUnbound).toBe('block');
  });
});
