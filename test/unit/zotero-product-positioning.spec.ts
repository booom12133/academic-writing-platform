import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Zotero optional advanced integration positioning', () => {
  it('removes Zotero from primary navigation while preserving the direct route', () => {
    expect(read('client/src/components/Navbar.tsx')).not.toMatch(/path:\s*['"]\/zotero['"]/u);
    expect(read('client/src/app.tsx')).toContain('path="zotero"');
  });

  it('exposes Zotero from Profile integrations with explicit optional/deferred copy', () => {
    expect(read('client/src/pages/Profile/ProfileSidebar.tsx')).toContain("'integrations'");
    const integrations = read('client/src/pages/Profile/pages/Integrations.tsx');
    expect(integrations).toContain('/zotero');
    expect(integrations).toContain('可选高级集成');
    expect(integrations).toContain('OAuth');
    const page = read('client/src/pages/Zotero/ZoteroPage.tsx');
    expect(page).toContain('Optional Advanced Integration');
    expect(page).toContain('显式建立索引');
  });
});
