import { z } from 'zod';

export const sourceStrategySchema = z.enum(['MODEL_ONLY', 'WEB_RETRIEVED', 'USER_KNOWLEDGE', 'MIXED']);
export const projectProfileSchema = z.object({
  schemaVersion: z.literal(1),
  researchIdea: z.string().trim().min(1).max(10_000),
  discipline: z.string().trim().min(1).max(200).optional(),
  educationLevel: z.string().trim().min(1).max(100).optional(),
  paperType: z.enum([
    'empirical-quantitative', 'empirical-qualitative', 'mixed-methods',
    'computer-science-engineering', 'literature-review', 'conceptual-theoretical', 'other',
  ]),
  language: z.enum(['zh-CN', 'en']),
  targetWords: z.number().int().min(100).max(500_000).optional(),
  requirements: z.string().trim().max(20_000).optional(),
}).strict();

const optionalClaims = z.array(z.object({
  id: z.string().trim().min(1).max(100),
  statement: z.string().trim().min(1).max(5_000),
  rationale: z.string().trim().min(1).max(5_000).optional(),
}).strict()).max(100).optional();

export const researchPlanSchema = z.object({
  schemaVersion: z.literal(1),
  researchProblem: z.string().trim().min(1).max(10_000),
  researchQuestions: z.array(z.string().trim().min(1).max(5_000)).min(1).max(100),
  hypotheses: optionalClaims,
  propositions: optionalClaims,
  researchObjectives: z.array(z.string().trim().min(1).max(5_000)).min(1).max(100),
  methodology: z.object({
    approach: z.string().trim().min(1).max(2_000),
    design: z.string().trim().min(1).max(5_000).optional(),
    methods: z.array(z.string().trim().min(1).max(2_000)).min(1).max(100),
    dataOrMaterials: z.array(z.string().trim().min(1).max(2_000)).max(100).optional(),
    samplingOrSelection: z.string().trim().min(1).max(5_000).optional(),
    analysisPlan: z.array(z.string().trim().min(1).max(2_000)).max(100).optional(),
    validationPlan: z.array(z.string().trim().min(1).max(2_000)).max(100).optional(),
  }).strict(),
  dataMaterialRequirements: z.array(z.string().trim().min(1).max(2_000)).max(100),
  expectedContributions: z.array(z.string().trim().min(1).max(2_000)).min(1).max(100),
  limitationsAssumptions: z.array(z.string().trim().min(1).max(2_000)).max(100),
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
}).strict();

export const createPaperProjectRequestSchema = z.object({
  profile: projectProfileSchema,
  selectedTitle: z.string().trim().min(1).max(500).optional(),
  defaultSourceStrategy: sourceStrategySchema.optional(),
}).strict();

export const projectSourceBindingInputSchema = z.object({
  sourceRecordId: z.string().uuid().optional(),
  documentVersionId: z.string().uuid().optional(),
}).strict().refine((value) => Boolean(value.sourceRecordId || value.documentVersionId), {
  message: 'At least one canonical source identifier is required.',
});

export const uuidSchema = z.string().uuid();
