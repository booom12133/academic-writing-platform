import { z } from 'zod';

export const groundedEvidenceRefSchema = z.object({
  evidenceId: z.string().min(1),
}).strict();

export const claimUnitSchema = z.object({
  unitId: z.string().min(1),
  unitType: z.enum(['claim', 'qualification', 'transition']),
  text: z.string().min(1),
  evidenceRefs: z.array(groundedEvidenceRefSchema).min(1),
}).strict();

export const groundedSegmentSchema = z.object({
  segmentId: z.string().min(1),
  units: z.array(claimUnitSchema).min(1),
}).strict();

export const groundedModelOutputSchema = z.object({
  segments: z.array(groundedSegmentSchema).min(1),
}).strict().superRefine((value, context) => {
  const segmentIds = new Set<string>();
  const unitIds = new Set<string>();
  value.segments.forEach((segment, segmentIndex) => {
    if (segmentIds.has(segment.segmentId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', segmentIndex, 'segmentId'], message: 'segmentId must be unique.' });
    }
    segmentIds.add(segment.segmentId);
    segment.units.forEach((unit, unitIndex) => {
      if (unitIds.has(unit.unitId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', segmentIndex, 'units', unitIndex, 'unitId'], message: 'unitId must be unique.' });
      }
      unitIds.add(unit.unitId);
      const evidenceIds = new Set<string>();
      unit.evidenceRefs.forEach((ref, evidenceIndex) => {
        if (evidenceIds.has(ref.evidenceId)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ['segments', segmentIndex, 'units', unitIndex, 'evidenceRefs', evidenceIndex, 'evidenceId'], message: 'evidenceId must not be duplicated within a unit.' });
        }
        evidenceIds.add(ref.evidenceId);
      });
    });
  });
});
