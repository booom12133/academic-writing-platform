import { Injectable } from '@nestjs/common';

import type { ChunkedTaskContext } from '../../chunking/chunking.types';
import { AcademicToolExecutionService } from '../execution/academic-tool-execution.service';
import {
  joinTrustedSegments,
  renderedChunksToTrustedSegments,
} from './polish-source-boundary';
import type { PreparedPolishBilling } from './polish-input.types';

@Injectable()
export class PolishBillingService {
  constructor(private readonly execution: AcademicToolExecutionService) {}

  calculate(context: ChunkedTaskContext): PreparedPolishBilling {
    const rendered = this.execution.render(context);
    const billingText = joinTrustedSegments(
      renderedChunksToTrustedSegments(rendered),
    );
    const charCount = billingText.length;

    return {
      billingText,
      charCount,
      pointsCost: Math.max(10, Math.ceil(charCount / 500) * 10),
    };
  }
}
