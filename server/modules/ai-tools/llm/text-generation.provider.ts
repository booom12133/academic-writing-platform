import type {
  TextGenerationHealth,
  TextGenerationRequest,
  TextGenerationResult,
} from './llm.types';

export const TEXT_GENERATION_PROVIDER = Symbol('TEXT_GENERATION_PROVIDER');

export interface TextGenerationProvider {
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
  checkHealth(): Promise<TextGenerationHealth>;
}
