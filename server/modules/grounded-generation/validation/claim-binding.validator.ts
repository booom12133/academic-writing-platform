import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';
import type {
  EvidenceTrace,
  GroundingDiagnostic,
  GroundedModelOutput,
  BindingStatus,
  GroundingCoverage,
} from '../grounded-generation.types';

export interface ClaimBindingValidationResult {
  bindingStatus: BindingStatus;
  groundingCoverage: GroundingCoverage;
  diagnostics: GroundingDiagnostic[];
  evidenceTrace: EvidenceTrace[];
}

export class ClaimBindingValidator {
  validate(output: GroundedModelOutput, evidenceSet: EvidenceSet): ClaimBindingValidationResult {
    const evidenceById = new Map(evidenceSet.items.map((item) => [item.evidenceId, item]));
    const diagnostics: GroundingDiagnostic[] = [];
    const evidenceTrace: EvidenceTrace[] = [];
    const seenEvidenceIds = new Set<string>();
    const units = output.segments.flatMap((segment) => segment.units);
    let boundUnits = 0;

    if (evidenceById.size === 0) {
      diagnostics.push({ code: 'empty-evidence' });
    }

    for (const unit of units) {
      if (!Array.isArray(unit.evidenceRefs) || unit.evidenceRefs.length === 0) {
        diagnostics.push({ code: 'unbound-unit', unitId: unit.unitId });
        continue;
      }
      const validRefs = unit.evidenceRefs.filter((ref) => evidenceById.has(ref.evidenceId));
      if (validRefs.length === 0) {
        diagnostics.push({ code: 'unbound-unit', unitId: unit.unitId });
      } else if (validRefs.length === unit.evidenceRefs.length) {
        boundUnits += 1;
      } else {
        diagnostics.push({ code: 'unbound-unit', unitId: unit.unitId });
      }
      for (const ref of validRefs) {
        if (seenEvidenceIds.has(ref.evidenceId)) continue;
        const item = evidenceById.get(ref.evidenceId)!;
        seenEvidenceIds.add(ref.evidenceId);
        evidenceTrace.push({
          evidenceId: item.evidenceId,
          citationLocator: item.citationLocator,
          provenance: item.provenance,
          ...(item.sourceIdentity === undefined ? {} : { sourceRecord: item.sourceIdentity }),
        });
      }
      for (const ref of unit.evidenceRefs.filter((candidate) => !evidenceById.has(candidate.evidenceId))) {
        diagnostics.push({ code: 'unknown-evidence-id', unitId: unit.unitId, evidenceId: ref.evidenceId });
      }
    }

    const groundingCoverage: GroundingCoverage =
      units.length === 0 || boundUnits === units.length
        ? 'complete'
        : boundUnits === 0
          ? 'none'
          : 'partial';
    const bindingStatus: BindingStatus =
      groundingCoverage === 'complete'
        ? 'bound'
        : groundingCoverage === 'partial'
          ? 'partially-bound'
          : 'unbound';
    return { bindingStatus, groundingCoverage, diagnostics, evidenceTrace };
  }
}
