import type {
  CitationLocator,
  KnowledgeChunkProvenance,
  SourceRecord,
} from '../knowledge/knowledge.types';
import type { EvidenceSet } from '../knowledge/retrieval/evidence-assembly';
import type { LlmUsage } from '../ai-tools/llm/llm.types';

export type BindingStatus = 'bound' | 'partially-bound' | 'unbound';
export type GroundingCoverage = 'complete' | 'partial' | 'none';

export interface GroundedEvidenceRef {
  evidenceId: string;
}

export interface ClaimUnit {
  unitId: string;
  unitType: 'claim' | 'qualification' | 'transition';
  text: string;
  evidenceRefs: [GroundedEvidenceRef, ...GroundedEvidenceRef[]];
}

export interface GroundedSegment {
  segmentId: string;
  units: ClaimUnit[];
}

export interface GroundedModelOutput {
  segments: GroundedSegment[];
}

export interface GroundedClaim {
  claimId: string;
  text: string;
  bindingStatus: BindingStatus;
  evidenceRefs: GroundedEvidenceRef[];
}

export interface CitationReference {
  citationId: string;
  evidenceIds: string[];
}

export interface BibliographyEntry {
  citationId: string;
  fields: Record<string, unknown>;
}

export interface CitationPlacementV1 {
  schemaVersion: 1;
  citationId: string;
  localNumber: number;
  start: number;
  end: number;
  markerText: string;
}

export interface EvidenceTrace {
  evidenceId: string;
  citationLocator: CitationLocator;
  provenance: KnowledgeChunkProvenance;
  sourceRecord?: SourceRecord;
}

export interface GroundingDiagnostic {
  code:
    | 'empty-evidence'
    | 'no-usable-evidence'
    | 'unbound-unit'
    | 'unknown-evidence-id'
    | 'bibliography-metadata-unresolved';
  unitId?: string;
  evidenceId?: string;
  detail?: string;
}

export interface GroundingReport {
  groundingCoverage: GroundingCoverage;
  diagnostics: GroundingDiagnostic[];
}

export interface GenerationProvenance {
  selectedVersionIds: string[];
  retrievalProfile?: EvidenceSet['profile'];
}

export interface GenerationMetadata {
  provider: string;
  model: string;
  usage?: LlmUsage;
}

export interface GroundedGenerationResult {
  schemaVersion: 1;
  status: 'grounded' | 'partial' | 'blocked';
  content: string;
  claims: GroundedClaim[];
  citations: CitationReference[];
  bibliography: BibliographyEntry[];
  citationPlacements: CitationPlacementV1[];
  evidenceTrace: EvidenceTrace[];
  grounding: GroundingReport;
  provenance: GenerationProvenance;
  generation: GenerationMetadata;
}

export interface GroundedGenerationRequest {
  instructions: string;
  queryText: string;
  retrieval?: {
    selection?: import('../knowledge/retrieval/retrieval.types').RetrievalVersionSelection;
    filters?: import('../knowledge/retrieval/retrieval.types').RetrievalFilters;
    policy?: Partial<import('../knowledge/retrieval/retrieval.types').RetrievalPolicy>;
  };
  output?: {
    format: 'markdown' | 'plain';
    citationStyle: 'numeric-inline';
  };
  grounding?: {
    onUnbound: 'block' | 'annotate';
  };
}
