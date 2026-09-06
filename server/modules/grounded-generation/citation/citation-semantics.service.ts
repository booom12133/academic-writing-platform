import type {
  CitationReference,
  GroundedClaim,
  GroundedModelOutput,
  EvidenceTrace,
  GroundingReport,
} from '../grounded-generation.types';
import type { ClaimBindingValidationResult } from '../validation/claim-binding.validator';

export interface RenderableGroundedUnit {
  unitId: string;
  text: string;
  citationIds: string[];
}

export interface CitationSemanticsResult {
  claims: GroundedClaim[];
  citations: CitationReference[];
  evidenceTrace: EvidenceTrace[];
  grounding: GroundingReport;
  units: RenderableGroundedUnit[];
}

export class CitationSemanticsService {
  create(output: GroundedModelOutput, validation: ClaimBindingValidationResult): CitationSemanticsResult {
    const evidenceIds = validation.evidenceTrace.map((trace) => trace.evidenceId);
    const citationByEvidenceId = new Map(
      evidenceIds.map((evidenceId, index) => [evidenceId, `citation-${index + 1}`]),
    );
    const units = output.segments.flatMap((segment) => segment.units).map((unit) => ({
      unitId: unit.unitId,
      text: unit.text,
      citationIds: unit.evidenceRefs
        .map((ref) => citationByEvidenceId.get(ref.evidenceId))
        .filter((citationId): citationId is string => citationId !== undefined),
    }));
    const claims = output.segments.flatMap((segment) => segment.units)
      .filter((unit) => unit.unitType === 'claim')
      .map((unit) => {
        const citationIds = units.find((candidate) => candidate.unitId === unit.unitId)?.citationIds ?? [];
        const bindingStatus = citationIds.length === unit.evidenceRefs.length
          ? 'bound' as const
          : citationIds.length === 0 ? 'unbound' as const : 'partially-bound' as const;
        return {
          claimId: unit.unitId,
          text: unit.text,
          bindingStatus,
          evidenceRefs: unit.evidenceRefs.filter((ref) => citationByEvidenceId.has(ref.evidenceId)),
        };
      });
    return {
      claims,
      citations: evidenceIds.map((evidenceId, index) => ({
        citationId: `citation-${index + 1}`,
        evidenceIds: [evidenceId],
      })),
      evidenceTrace: validation.evidenceTrace,
      grounding: {
        groundingCoverage: validation.groundingCoverage,
        diagnostics: validation.diagnostics,
      },
      units,
    };
  }
}
