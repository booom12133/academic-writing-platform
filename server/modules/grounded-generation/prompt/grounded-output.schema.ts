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
  units: z.array(claimUnitSchema),
}).strict();

export const groundedModelOutputSchema = z.object({
  segments: z.array(groundedSegmentSchema),
}).strict();
