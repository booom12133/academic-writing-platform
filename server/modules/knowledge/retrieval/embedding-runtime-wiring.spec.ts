import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { LocalDevelopmentDatabaseModule } from '../../../database/local-development.module';
import { EMBEDDING_CONFIG } from '../indexing/embedding.config';
import {
  EMBEDDING_PROVIDER,
} from '../indexing/embedding.provider';

describe('E2 embedding runtime wiring', () => {
  it('exports the existing provider and config without changing indexing behavior', async () => {
    process.env.RUNTIME_PROFILE = 'local';
    process.env.DOCUMENT_STORAGE_DRIVER = 'filesystem';
    process.env.DOCUMENT_STORAGE_ROOT = join(process.cwd(), 'test-documents');
    // Require after storage configuration is selected because the provider is created at module definition time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KnowledgeIndexingModule } = require('../indexing/knowledge-indexing.module') as typeof import('../indexing/knowledge-indexing.module');
    const moduleRef = await Test.createTestingModule({
      imports: [LocalDevelopmentDatabaseModule, KnowledgeIndexingModule],
    }).compile();

    expect(moduleRef.get(EMBEDDING_PROVIDER)).toBeDefined();
    expect(moduleRef.get(EMBEDDING_CONFIG)).toBeDefined();
    await moduleRef.close();
  });
});
