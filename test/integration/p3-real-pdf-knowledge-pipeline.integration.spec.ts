import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { createStandardPostgresConfig } from '../../server/database/standard-postgres.module';
import type { AppDatabase } from '../../server/database/database.types';
import { ChunkingService } from '../../server/modules/chunking/chunking.service';
import { ContextBuilderService } from '../../server/modules/context-builder/context-builder.service';
import { DocumentInputService } from '../../server/modules/document-input/document-input.service';
import { SelfHostedFilesystemDocumentStorageAdapter } from '../../server/modules/document-input/filesystem-document-storage.adapter';
import { DocumentParserService } from '../../server/modules/document-parsing/document-parser.service';
import { PdfParser } from '../../server/modules/document-parsing/parsers/pdf.parser';
import { createEmbeddingConfig } from '../../server/modules/knowledge/indexing/embedding.config';
import type { EmbeddingProvider } from '../../server/modules/knowledge/indexing/embedding.provider';
import type {
  EmbeddingHealth,
  EmbeddingModelIdentity,
  EmbeddingRequest,
  EmbeddingResult,
} from '../../server/modules/knowledge/indexing/embedding.types';
import { KnowledgeIndexRepository } from '../../server/modules/knowledge/indexing/knowledge-index.repository';
import { KnowledgeIndexingService } from '../../server/modules/knowledge/indexing/knowledge-indexing.service';
import { KnowledgeRepository } from '../../server/modules/knowledge/knowledge.repository';
import { EvidenceAssemblyService } from '../../server/modules/knowledge/retrieval/evidence-assembly';
import { KnowledgeEvidenceService } from '../../server/modules/knowledge/retrieval/knowledge-evidence.service';
import { KnowledgeRetrievalRepository } from '../../server/modules/knowledge/retrieval/knowledge-retrieval.repository';
import { KnowledgeRetrievalService } from '../../server/modules/knowledge/retrieval/knowledge-retrieval.service';
import { createRetrievalConfig } from '../../server/modules/knowledge/retrieval/retrieval.config';
import { KnowledgeService } from '../../server/modules/knowledge/knowledge.service';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;
const fixturePath = join(
  process.cwd(),
  'server/modules/document-parsing/__fixtures__/academic-textual-realworld.pdf',
);

class SameVectorEmbeddingProvider implements EmbeddingProvider {
  private readonly identity: EmbeddingModelIdentity = {
    provider: 'p3-pdf-fixture',
    model: 'same-vector-v1',
    modelRevision: '1',
    dimensions: 2,
  };

  async getIdentity(): Promise<EmbeddingModelIdentity> {
    return { ...this.identity };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      identity: await this.getIdentity(),
      items: request.items.map((item) => ({
        inputFingerprint: item.inputFingerprint,
        vector: [1, 0],
      })),
    };
  }

  async checkHealth(): Promise<EmbeddingHealth> {
    return {
      configured: true,
      provider: this.identity.provider,
      reachable: true,
      model: this.identity.model,
      dimensions: this.identity.dimensions,
    };
  }
}

describeIfDatabase('P3 real-world PDF knowledge pipeline', () => {
  let pool: Pool;
  let storageRoot: string;

  beforeAll(async () => {
    pool = new Pool(createStandardPostgresConfig({
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
    }));
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle/migrations' });
    storageRoot = await mkdtemp(join(tmpdir(), 'p3-real-pdf-'));
  });

  afterAll(async () => {
    await pool.end();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('uploads, parses, versions, chunks, explicitly indexes, and retrieves the textual PDF', async () => {
    const db = drizzle(pool) as AppDatabase;
    const userId = `p3-real-pdf-${randomUUID()}`;
    const parser = new DocumentParserService([new PdfParser()]);
    const contextBuilder = new ContextBuilderService();
    const chunker = new ChunkingService();
    const storage = new SelfHostedFilesystemDocumentStorageAdapter(storageRoot);
    const documentInput = new DocumentInputService(storage, parser, contextBuilder, chunker);
    const knowledgeRepository = new KnowledgeRepository(db);
    const knowledge = new KnowledgeService(
      knowledgeRepository,
      parser,
      contextBuilder,
      chunker,
      documentInput,
    );
    const provider = new SameVectorEmbeddingProvider();
    const embeddingConfig = createEmbeddingConfig({ EMBEDDING_MAX_INPUT_CODE_POINTS: '10000' });
    const indexing = new KnowledgeIndexingService(
      knowledgeRepository,
      new KnowledgeIndexRepository(db),
      provider,
      embeddingConfig,
    );
    const retrieval = new KnowledgeRetrievalService(
      new KnowledgeRetrievalRepository(db),
      provider,
      embeddingConfig,
      createRetrievalConfig({
        RETRIEVAL_DISTANCE_METRIC: 'cosine',
        RETRIEVAL_DEFAULT_TOP_K: '4',
        RETRIEVAL_DEFAULT_CANDIDATE_LIMIT: '16',
      }),
    );
    const evidence = new KnowledgeEvidenceService(
      retrieval,
      knowledgeRepository,
      new EvidenceAssemblyService(),
    );
    const buffer = await readFile(fixturePath);

    const descriptor = await documentInput.upload(userId, {
      buffer,
      originalname: 'academic-textual-realworld.pdf',
      mimetype: 'application/pdf',
    });

    expect(descriptor.document.sizeBytes).toBe(buffer.length);
    expect(descriptor.document.sha256).toMatch(/^[a-f0-9]{64}$/u);

    const imported = await knowledge.importDocument({
      userId,
      idempotencyKey: `p3-real-pdf:${descriptor.document.sha256}`,
      displayName: 'Sanitized real-world academic PDF',
      originKind: 'user-upload',
      input: { kind: 'stored-file', documentRef: descriptor.document },
      chunkingPolicy: { maxSize: 1200 },
    });

    expect(imported.document.activeVersionId).toBe(imported.version.id);
    expect(imported.version.lifecycleStatus).toBe('active');
    expect(imported.version.readinessStatus).toBe('content-ready-for-indexing');
    expect(imported.chunks.length).toBeGreaterThan(0);
    expect(imported.chunks.some((chunk) => chunk.provenance.pageStart !== undefined)).toBe(true);

    const indexed = await indexing.indexVersion({
      userId,
      documentVersionId: imported.version.id,
    });
    expect(indexed.status).toBe('indexed');

    const assembled = await evidence.retrieve({
      userId,
      queryText: 'academic textual regression evidence',
      selection: { mode: 'explicit', documentVersionIds: [imported.version.id] },
      policy: { topK: 4, candidateLimit: 16 },
    });

    expect(assembled.items.length).toBeGreaterThan(0);
    expect(assembled.items.every((item) => item.citationLocator.documentVersionId === imported.version.id)).toBe(true);
  });
});
