import { Test } from '@nestjs/testing';
import { join } from 'node:path';
import { LocalDevelopmentDatabaseModule } from '../../../database/local-development.module';
import { KnowledgeEvidenceService } from './knowledge-evidence.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';

describe('KnowledgeRetrievalModule', () => {
  it('wires E3 retrieval with the existing E1/E2 modules', async () => {
    process.env.RUNTIME_PROFILE = 'local';
    process.env.DOCUMENT_STORAGE_DRIVER = 'filesystem';
    process.env.DOCUMENT_STORAGE_ROOT = join(process.cwd(), 'test-documents');
    // Require after storage configuration is selected because the imported E1 module creates its provider at definition time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KnowledgeRetrievalModule } = require('./knowledge-retrieval.module') as typeof import('./knowledge-retrieval.module');
    const moduleRef = await Test.createTestingModule({
      imports: [LocalDevelopmentDatabaseModule, KnowledgeRetrievalModule],
    }).compile();

    expect(moduleRef.get(KnowledgeRetrievalService)).toBeDefined();
    expect(moduleRef.get(KnowledgeEvidenceService)).toBeDefined();
    await moduleRef.close();
  });
});
