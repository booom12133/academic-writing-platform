import { Injectable } from '@nestjs/common';

import type {
  PreparedToolInput,
  ToolPreparationInput,
} from './tool-execution.types';
import { ToolInputPreparationService } from './tool-input-preparation.service';

@Injectable()
export class ToolSubmissionPreparationService {
  constructor(private readonly inputPreparation: ToolInputPreparationService) {}

  async prepareBeforeBilling<T>(
    input: ToolPreparationInput,
    afterPreparation: (prepared: PreparedToolInput) => Promise<T>,
  ): Promise<T> {
    const prepared = await this.inputPreparation.prepare(input);
    return afterPreparation(prepared);
  }
}
