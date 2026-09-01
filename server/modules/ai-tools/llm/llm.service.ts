import { Injectable } from '@nestjs/common';

import { DeepSeekProvider } from './deepseek.provider';
import type {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmHealthResult,
} from './llm.types';

@Injectable()
export class LlmService {
  constructor(private readonly deepSeekProvider: DeepSeekProvider) {}

  generate(options: LlmGenerateOptions): Promise<LlmGenerateResult> {
    return this.deepSeekProvider.generate(options);
  }

  checkHealth(): Promise<LlmHealthResult> {
    return this.deepSeekProvider.checkConnectivity();
  }
}
