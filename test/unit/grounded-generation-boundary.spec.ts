import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'server', 'modules', 'grounded-generation');

describe('E6 frozen boundaries', () => {
  it('does not add task integration or persistence files', () => {
    const moduleSource = readFileSync(join(root, 'grounded-generation.module.ts'), 'utf8');
    expect(moduleSource).not.toContain('TasksModule');
    expect(moduleSource).not.toContain('KnowledgeIndexingService');
  });

  it('keeps the LLM output schema free of an independent content channel', () => {
    const schema = readFileSync(join(root, 'prompt', 'grounded-output.schema.ts'), 'utf8');
    expect(schema).not.toContain('content');
  });

  it('keeps the E3 public facade export boundary unchanged', () => {
    const e3Module = readFileSync(join(process.cwd(), 'server', 'modules', 'knowledge', 'retrieval', 'knowledge-retrieval.module.ts'), 'utf8');
    expect(e3Module).toContain('KnowledgeEvidenceService');
    expect(e3Module).not.toContain('exports: [KnowledgeRetrievalService, KnowledgeEvidenceService, EvidenceAssemblyService]');
  });
});
