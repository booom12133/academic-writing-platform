import type { ValidatedDocumentInput } from '../document-parser.interface';
import { TxtParser } from './txt.parser';

const input = (buffer: Buffer): ValidatedDocumentInput => ({
  buffer,
  fileName: 'paper.txt',
  mimeType: 'text/plain',
  extension: '.txt',
  sourceType: 'txt',
  sizeBytes: buffer.length,
});

describe('TxtParser', () => {
  it('creates paragraphs from UTF-8 text separated by blank lines', async () => {
    const result = await new TxtParser().parse(
      input(Buffer.from('\uFEFFParagraph one.\r\nstill paragraph one.\r\n\r\nParagraph two.', 'utf8')),
    );

    expect(result.blocks).toEqual([
      { type: 'paragraph', text: 'Paragraph one.\nstill paragraph one.' },
      { type: 'paragraph', text: 'Paragraph two.' },
    ]);
  });

  it('rejects invalid UTF-8 without replacement characters', async () => {
    await expect(new TxtParser().parse(input(Buffer.from([0xc3, 0x28])))).rejects.toMatchObject({
      code: 'INVALID_TEXT_ENCODING',
    });
  });
});
