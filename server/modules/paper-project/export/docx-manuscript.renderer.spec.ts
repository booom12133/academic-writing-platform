import JSZip = require('jszip');

import type { ManuscriptProjectionV1 } from '@shared/manuscript.interface';
import { DocxManuscriptRenderer } from './docx-manuscript.renderer';

const projection: ManuscriptProjectionV1 = {
  schemaVersion: 1,
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  title: '跨语言 <Academic> Paper', language: 'zh-CN', bodyFingerprint: 'a'.repeat(64), manuscriptFingerprint: 'b'.repeat(64),
  readiness: 'INCOMPLETE', wordCount: 42,
  outline: [
    { nodeId: '550e8400-e29b-41d4-a716-446655440010', sectionId: '550e8400-e29b-41d4-a716-446655440020', title: 'Introduction', depth: 0, nodeType: 'writing-unit' },
    { nodeId: '550e8400-e29b-41d4-a716-446655440011', sectionId: '550e8400-e29b-41d4-a716-446655440021', title: 'Acknowledgements', depth: 0, nodeType: 'writing-unit' },
    { nodeId: '550e8400-e29b-41d4-a716-446655440012', sectionId: '550e8400-e29b-41d4-a716-446655440022', title: 'Appendix', depth: 1, nodeType: 'writing-unit' },
  ],
  derived: {
    abstract: { role: 'ABSTRACT', state: 'CURRENT', content: '摘要 body.' },
    keywords: { role: 'KEYWORDS', state: 'CURRENT', content: 'alpha; beta' },
  },
  blocks: [
    { kind: 'heading', nodeId: '550e8400-e29b-41d4-a716-446655440010', sectionId: '550e8400-e29b-41d4-a716-446655440020', level: 1, title: 'Introduction' },
    { kind: 'paragraph', sectionId: '550e8400-e29b-41d4-a716-446655440020', revisionId: '550e8400-e29b-41d4-a716-446655440030', text: '- item one\n- item two\n\n1. first\n2. second\n\n| A | B |\n|---|---|\n| <x> | $E=mc^2$ |' },
    { kind: 'heading', nodeId: '550e8400-e29b-41d4-a716-446655440011', sectionId: '550e8400-e29b-41d4-a716-446655440021', level: 1, title: 'Acknowledgements' },
    { kind: 'paragraph', sectionId: '550e8400-e29b-41d4-a716-446655440021', revisionId: '550e8400-e29b-41d4-a716-446655440031', text: 'Thanks <script>alert(1)</script>' },
    { kind: 'heading', nodeId: '550e8400-e29b-41d4-a716-446655440012', sectionId: '550e8400-e29b-41d4-a716-446655440022', level: 7, title: 'Appendix' },
    { kind: 'missing-section', nodeId: '550e8400-e29b-41d4-a716-446655440012', sectionId: '550e8400-e29b-41d4-a716-446655440022', text: '【本节尚未完成】' },
    { kind: 'references', entries: [{ number: 1, identity: 'source:1', fields: { title: 'Source & evidence', year: 2026 } }] },
  ],
  supportSummary: { validSections: 1, staleSections: 0, notClaimedSections: 1, missingSections: 1, managedCitationCount: 1, bibliographyEntryCount: 1, bibliographyState: 'COMPLETE' },
  citations: [], bibliography: [{ number: 1, identity: 'source:1', fields: { title: 'Source & evidence', year: 2026 } }],
  warnings: [{ code: 'MISSING_SECTION', severity: 'warning', message: 'missing' }],
  exportPolicy: { cleanAllowed: false, draftAllowed: true, acknowledgementCodes: ['MISSING_SECTION'] },
};

describe('DocxManuscriptRenderer', () => {
  it('renders editable OOXML with static TOC, supported blocks, fonts, page breaks, and exact createdAt', async () => {
    const createdAt = '2026-09-22T04:00:00.123Z';
    const result = await new DocxManuscriptRenderer().render(projection, {
      exportId: '550e8400-e29b-41d4-a716-446655440001', createdAt, mode: 'DRAFT', templateKey: 'generic-academic-v1',
    });
    const zip = await JSZip.loadAsync(result.buffer);
    for (const path of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'docProps/core.xml']) expect(zip.file(path)).not.toBeNull();
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const stylesXml = await zip.file('word/styles.xml')!.async('string');
    const coreXml = await zip.file('docProps/core.xml')!.async('string');
    expect(documentXml).toContain('Table of Contents');
    expect(documentXml.indexOf('Introduction')).toBeLessThan(documentXml.indexOf('Acknowledgements'));
    expect(documentXml.indexOf('Acknowledgements')).toBeLessThan(documentXml.indexOf('Appendix'));
    expect(documentXml.indexOf('Appendix')).toBeLessThan(documentXml.indexOf('References'));
    expect(documentXml).not.toMatch(/w:fldChar|PAGEREF|TOC \\/u);
    expect(documentXml).toMatch(/w:numPr/u);
    expect(documentXml).toMatch(/w:tbl/u);
    expect(documentXml).toMatch(/w:pageBreakBefore/u);
    expect(documentXml).toContain('$E=mc^2$');
    expect(documentXml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(documentXml).not.toContain('<script>');
    expect(stylesXml).toMatch(/w:ascii="Times New Roman"/u);
    expect(stylesXml).toMatch(/w:eastAsia="宋体"/u);
    expect(stylesXml).toMatch(/w:eastAsia="黑体"/u);
    expect(stylesXml).toMatch(/w:styleId="ManuscriptHeading7"/u);
    expect(coreXml).toContain(`<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>`);
    expect(coreXml).toContain(`<dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>`);
    const relationshipFiles = Object.keys(zip.files).filter((path) => path.endsWith('.rels'));
    for (const path of relationshipFiles) expect(await zip.file(path)!.async('string')).not.toMatch(/TargetMode="External"/u);
  });

  it('declares Times New Roman for every English body and heading font family', async () => {
    const result = await new DocxManuscriptRenderer().render({ ...projection, language: 'en' }, {
      exportId: '550e8400-e29b-41d4-a716-446655440001', createdAt: '2026-09-22T04:00:00.123Z', mode: 'CLEAN', templateKey: 'generic-academic-v1',
    });
    const styles = await (await JSZip.loadAsync(result.buffer)).file('word/styles.xml')!.async('string');
    expect(styles).not.toMatch(/宋体|黑体/u);
    expect(styles).toMatch(/w:ascii="Times New Roman"[^>]*w:eastAsia="Times New Roman"[^>]*w:hAnsi="Times New Roman"/u);
  });
});
