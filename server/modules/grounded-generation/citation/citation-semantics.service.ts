import type {
  CitationReference,
  GroundedClaim,
  GroundedModelOutput,
  EvidenceTrace,
  GroundingReport,
} from '../grounded-generation.types';
import type { ClaimBindingValidationResult } from '../validation/claim-binding.validator';
import type { BindingStatus, GroundingDiagnostic } from '../grounded-generation.types';

export interface RenderableGroundedUnit {
  unitId: string;
  text: string;
  citationIds: string[];
  bindingStatus: BindingStatus;
  diagnostics: GroundingDiagnostic[];
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
    const claims: GroundedClaim[] = [];
    const units = output.segments.flatMap((segment) => segment.units).map((unit, index) => {
      const binding = validation.unitBindings[index];
      const citationIds = binding.evidenceIds
        .map((evidenceId) => citationByEvidenceId.get(evidenceId))
        .filter((citationId): citationId is string => citationId !== undefined);
      if (unit.unitType === 'claim') {
        claims.push({
          claimId: unit.unitId,
          text: unit.text,
          bindingStatus: binding.bindingStatus,
          evidenceRefs: unit.evidenceRefs.filter((ref) => citationByEvidenceId.has(ref.evidenceId)),
        });
      }
      return {
        unitId: unit.unitId,
        text: unit.text,
        citationIds,
        bindingStatus: binding.bindingStatus,
        diagnostics: binding.diagnostics,
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
