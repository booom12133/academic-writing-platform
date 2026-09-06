import { GroundedGenerationError } from '../grounded-generation.errors';
import type { GroundedModelOutput } from '../grounded-generation.types';
import { groundedModelOutputSchema } from './grounded-output.schema';

export function parseGroundedModelOutput(raw: string): GroundedModelOutput {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new GroundedGenerationError(
      'GROUNDED_GENERATION_INVALID_RESPONSE',
      'The generation provider returned invalid JSON.',
      502,
    );
  }
  const parsed = groundedModelOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new GroundedGenerationError(
      'GROUNDED_GENERATION_INVALID_RESPONSE',
      'The generation provider returned an invalid grounded response.',
      502,
      parsed.error.issues,
    );
  }
  return parsed.data;
}
