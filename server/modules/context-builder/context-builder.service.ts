import { Injectable } from '@nestjs/common';

import { ContextBuilderError } from './context-builder.errors';
import {
  BuildTaskContextInput,
  TaskContext,
} from './context-builder.types';

@Injectable()
export class ContextBuilderService {
  build(_input: BuildTaskContextInput): TaskContext {
    throw new ContextBuilderError(
      'INVALID_CONTEXT_INPUT',
      'Context input is not valid.',
    );
  }
}
