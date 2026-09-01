import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ValidatedDocumentInput } from '../document-parser.interface';
import { DocumentNormalizer } from '../document-normalizer';
import { PdfParser } from './pdf.parser';

const fixture = (name: string) => join(process.cwd(), 'server', 'modules', 'document-parsing', '__fixtures__', name);

describe('PdfParser', () => {
  it('extracts selectable text with page provenance and page count', async () => {
    const buffer = await readFile(fixture('academic-basic.pdf'));
    const draft = await new PdfParser().parse({
      buffer,
      fileName: 'academic-basic.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      sourceType: 'pdf',
      sizeBytes: buffer.length,
    } satisfies ValidatedDocumentInput);
    const result = new DocumentNormalizer().normalize(
      { type: 'pdf', fileName: 'academic-basic.pdf', extension: '.pdf', mimeType: 'application/pdf', sizeBytes: buffer.length },
      draft,
    );

    expect(result.metadata.pageCount).toBe(2);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks.every((block) => block.pageNumber === 1 || block.pageNumber === 2)).toBe(true);
    expect(result.blocks.findIndex((block) => block.pageNumber === 1)).toBeLessThan(
      result.blocks.findIndex((block) => block.pageNumber === 2),
    );
    expect(result.plainText).toContain('This is page one.');
    expect(result.warnings).toContainEqual({
      code: 'PDF_LAYOUT_SIMPLIFIED',
      message: 'PDF text order was reconstructed with basic line grouping.',
    });
  });

  it('rejects a valid PDF with no selectable text', async () => {
    const buffer = await readFile(fixture('scanned-no-text.pdf'));
    await expect(new PdfParser().parse({
      buffer,
      fileName: 'scanned-no-text.pdf',
      extension: '.pdf',
      sourceType: 'pdf',
      sizeBytes: buffer.length,
    })).rejects.toMatchObject({ code: 'PDF_NO_SELECTABLE_TEXT' });
  });
});
