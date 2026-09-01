import { readFile } from 'node:fs/promises';

import type { ValidatedDocumentInput } from '../document-parser.interface';
import { DocumentNormalizer } from '../document-normalizer';
import { MarkdownParser } from './markdown.parser';

const fixturePath = `${process.cwd()}/server/modules/document-parsing/__fixtures__/academic-basic.md`;

describe('MarkdownParser', () => {
  it('preserves headings, paragraphs, lists, code, formula, and references in order', async () => {
    const buffer = await readFile(fixturePath);
    const input: ValidatedDocumentInput = {
      buffer,
      fileName: 'academic-basic.md',
      mimeType: 'text/markdown',
      extension: '.md',
      sourceType: 'markdown',
      sizeBytes: buffer.length,
    };

    const draft = await new MarkdownParser().parse(input);
    const result = new DocumentNormalizer().normalize(
      {
        type: 'markdown',
        fileName: input.fileName,
        extension: input.extension,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
      draft,
    );

    expect(draft.title).toBe('Academic Paper');
    expect(result.blocks.map((block) => block.type)).toEqual([
      'heading',
      'heading',
      'paragraph',
      'list-item',
      'list-item',
      'list-item',
      'list-item',
      'code',
      'formula',
      'heading',
      'paragraph',
    ]);
    expect(result.blocks.find((block) => block.type === 'paragraph')?.text).toBe('This is the introduction.');
    expect(result.blocks.find((block) => block.type === 'code')).toMatchObject({
      text: 'print("hello")',
      language: 'python',
    });
    expect(result.blocks.find((block) => block.type === 'formula')).toMatchObject({
      text: 'E = mc^2',
      display: true,
    });
    expect(result.referenceSection).toMatchObject({ detection: 'explicit-heading' });
    expect(result.plainText).toContain('- Item A');
    expect(result.plainText).toContain('1. First');
  });
});
