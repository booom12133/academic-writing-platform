import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const moduleRoot = join(process.cwd(), 'server', 'modules', 'academic-search');

describe('Phase E5 frozen boundaries', () => {
  it('keeps the E5 module independent from persistence and earlier knowledge integrations', () => {
    const files = readdirSync(moduleRoot).filter((file) => file.endsWith('.ts'));
    const source = files.map((file) => readFileSync(join(moduleRoot, file), 'utf8')).join('\n');
    expect(source).not.toMatch(/from ['"].*knowledge|from ['"].*retrieval|from ['"].*zotero|from ['"].*ai-tools|from ['"].*database|migrations/u);
    expect(source).not.toMatch(/SourceRecord|EvidenceSet|drizzle|Repository/u);
    expect(files.some((file) => file.includes('migration') || file.includes('repository'))).toBe(false);
  });

  it('keeps OpenAlex continuation fields out of public request/response contracts', () => {
    const publicTypes = readFileSync(join(moduleRoot, 'academic-search.types.ts'), 'utf8');
    const controller = readFileSync(join(moduleRoot, 'academic-search.controller.ts'), 'utf8');
    expect(publicTypes).not.toMatch(/next_cursor|providerCursor/u);
    expect(controller).not.toMatch(/next_cursor|providerCursor/u);
  });

  it('has no E5 database migration or persistence artifact', () => {
    expect(existsSync(join(process.cwd(), 'drizzle', 'migrations', '0005_e5_academic_search.sql'))).toBe(false);
  });

  it('preserves the frozen distinction between discovery and evidence domains', () => {
    const types = readFileSync(join(moduleRoot, 'academic-search.types.ts'), 'utf8');
    expect(types).toContain('AcademicSearchResult');
    expect(types).toContain('AcademicDiscoverySet');
    expect(types).not.toContain('EvidenceSet');
    expect(types).not.toContain('SourceRecord');
  });
});
