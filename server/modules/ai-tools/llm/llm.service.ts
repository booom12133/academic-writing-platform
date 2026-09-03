import { Inject, Injectable } from '@nestjs/common';

import {
  TEXT_GENERATION_PROVIDER,
  type TextGenerationProvider,
} from './text-generation.provider';
import type {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmHealthResult,
} from './llm.types';

@Injectable()
export class LlmService {
  constructor(
    @Inject(TEXT_GENERATION_PROVIDER)
    private readonly textGenerationProvider: TextGenerationProvider,
  ) {}

  generate(options: LlmGenerateOptions): Promise<LlmGenerateResult> {
    return this.textGenerationProvider.generate(options);
  }

  checkHealth(): Promise<LlmHealthResult> {
    return this.textGenerationProvider.checkHealth();
  }
}
