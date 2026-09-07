import { z } from 'zod';
import { GroundedGenerationError } from './grounded-generation.errors';
import type { GroundedGenerationRequest } from './grounded-generation.types';
import { createRetrievalConfig, normalizeRetrievalPolicy } from '../knowledge/retrieval/retrieval.config';

const retrievalSelectionSchema = z.union([
  z.object({ mode: z.literal('active') }).strict(),
  z.object({ mode: z.literal('explicit'), documentVersionIds: z.array(z.string().min(1)).min(1) }).strict(),
]);

const retrievalFiltersSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).optional(),
  sourceRecordIds: z.array(z.string().min(1)).min(1).optional(),
  sourceKinds: z.array(z.enum(['user-declared', 'scholarly-work', 'reference-library-item'])).min(1).optional(),
  originKinds: z.array(z.enum(['user-upload', 'generated-artifact', 'external-attachment'])).min(1).optional(),
  sourceTypes: z.array(z.enum(['docx', 'pdf', 'txt', 'markdown'])).min(1).optional(),
}).strict();

const retrievalPolicySchema = z.object({
  topK: z.number().int().min(1).max(200).optional(),
  candidateLimit: z.number().int().min(1).max(1_000).optional(),
  minRetrievalScore: z.number().finite().optional(),
}).strict().superRefine((value, context) => {
  if (value.topK !== undefined && value.candidateLimit !== undefined && value.candidateLimit < value.topK) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['candidateLimit'], message: 'candidateLimit must be at least topK.' });
  }
});

const groundedGenerationRequestSchema = z.object({
  instructions: z.string().trim().min(1),
  queryText: z.string().trim().min(1),
  retrieval: z.object({
    selection: retrievalSelectionSchema.optional(),
    filters: retrievalFiltersSchema.optional(),
    policy: retrievalPolicySchema.optional(),
  }).strict().optional(),
  output: z.object({
    format: z.enum(['markdown', 'plain']),
    citationStyle: z.literal('numeric-inline'),
  }).strict().optional(),
  grounding: z.object({
    onUnbound: z.enum(['block', 'annotate']),
  }).strict().optional(),
}).strict();

export function parseGroundedGenerationRequest(input: unknown): GroundedGenerationRequest {
  const parsed = groundedGenerationRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new GroundedGenerationError(
      'GROUNDED_GENERATION_INVALID_QUERY',
      'The grounded generation request is invalid.',
      400,
      parsed.error.issues,
    );
  }
  try {
    if (parsed.data.retrieval?.policy !== undefined) {
      normalizeRetrievalPolicy(parsed.data.retrieval.policy, createRetrievalConfig());
    }
  } catch (error) {
    throw new GroundedGenerationError(
      'GROUNDED_GENERATION_INVALID_QUERY',
      error instanceof Error ? error.message : 'The retrieval policy is invalid.',
      400,
      error,
    );
  }
  return parsed.data as GroundedGenerationRequest;
}
