import { Test } from '@nestjs/testing';
import { join } from 'node:path';
import { LocalDevelopmentDatabaseModule } from '../../database/local-development.module';

jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  ...jest.requireActual('@lark-apaas/fullstack-nestjs-core'),
  NeedLogin: () => (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => descriptor,
}));


describe('KnowledgeModule', () => {
  it('resolves E1 services and neutral ingestion dependencies without a controller', async () => {
    process.env.RUNTIME_PROFILE = 'local';
    process.env.DOCUMENT_STORAGE_DRIVER = 'filesystem';
    process.env.DOCUMENT_STORAGE_ROOT = join(process.cwd(), 'test-documents');
    // Require after the storage mode is selected because the storage provider is created at module definition time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KnowledgeModule } = require('./knowledge.module') as typeof import('./knowledge.module');
    const moduleRef = await Test.createTestingModule({
      imports: [LocalDevelopmentDatabaseModule, KnowledgeModule],
    }).compile();

    expect(moduleRef.get(KnowledgeModule)).toBeDefined();
    expect(moduleRef.get((await import('./knowledge.service')).KnowledgeService)).toBeDefined();
    expect(moduleRef.get((await import('../document-parsing/document-parser.service')).DocumentParserService)).toBeDefined();
    expect(moduleRef.get((await import('../context-builder/context-builder.service')).ContextBuilderService)).toBeDefined();
    expect(moduleRef.get((await import('../chunking/chunking.service')).ChunkingService)).toBeDefined();
    expect(moduleRef.get((await import('../document-input/document-input.service')).DocumentInputService)).toBeDefined();
    await moduleRef.close();
  });
});
