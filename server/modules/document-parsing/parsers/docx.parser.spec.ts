import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ValidatedDocumentInput } from '../document-parser.interface';
import { DocumentNormalizer } from '../document-normalizer';
import { DocxParser } from './docx.parser';

describe('DocxParser', () => {
  it('preserves title, headings, paragraphs, lists, and tables from DOCX HTML', async () => {
    const buffer = await readFile(
      join(process.cwd(), 'server', 'modules', 'document-parsing', '__fixtures__', 'academic-basic.docx'),
    );
    const draft = await new DocxParser().parse({
      buffer,
      fileName: 'academic-basic.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
      sourceType: 'docx',
      sizeBytes: buffer.length,
    } satisfies ValidatedDocumentInput);
    const result = new DocumentNormalizer().normalize(
      {
        type: 'docx',
        fileName: 'academic-basic.docx',
        extension: '.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: buffer.length,
      },
      draft,
    );

    expect(result.title).toBe('Paper Title');
    expect(result.blocks.map((block) => block.type)).toEqual([
      'heading',
      'heading',
      'paragraph',
      'heading',
      'paragraph',
      'list-item',
      'list-item',
      'list-item',
      'list-item',
      'table',
      'heading',
      'paragraph',
    ]);
    expect(result.blocks.find((block) => block.type === 'table')).toMatchObject({
      rows: [
        { cells: ['Method', 'mAP'] },
        { cells: ['A', '92.4'] },
        { cells: ['B', '93.1'] },
      ],
    });
    expect(result.blocks.filter((block) => block.type === 'list-item').map((block) => block.ordered)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(result.referenceSection).toMatchObject({ detection: 'explicit-heading' });
    expect(result.plainText).toContain('Paper Title');
    expect(result.plainText).toContain('Bullet item one');
  });
});
