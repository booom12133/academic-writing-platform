import { DocumentParseError } from './document-parser.errors';
import type { DocumentParser } from './document-parser.interface';
import { DocumentParserService } from './document-parser.service';
import type { ParsedDocumentDraft } from './document-parser.types';
import { DocxParser } from './parsers/docx.parser';
import { PdfParser } from './parsers/pdf.parser';

const draft: ParsedDocumentDraft = { blocks: [{ type: 'paragraph', text: 'parsed' }] };

const parser = (sourceType: DocumentParser['sourceType'], result: ParsedDocumentDraft | Error = draft): DocumentParser => ({
  sourceType,
  parse: jest.fn().mockImplementation(async () => {
    if (result instanceof Error) throw result;
    return result;
  }),
});

describe('DocumentParserService', () => {
  it('routes supported extensions to their parser and normalizes the result', async () => {
    const parsers = [parser('docx'), parser('pdf'), parser('txt'), parser('markdown')];
    const service = new DocumentParserService(parsers);

    await expect(service.parse({ buffer: Buffer.from('hello'), fileName: 'PAPER.TXT' })).resolves.toMatchObject({
      source: { type: 'txt', extension: '.txt', sizeBytes: 5 },
      blocks: [{ id: 'b000001', type: 'paragraph', text: 'parsed' }],
    });
    expect(parsers[2].parse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['paper.docx', Buffer.from([0x50, 0x4b]), 'docx'],
    ['paper.pdf', Buffer.from('%PDF-1.4'), 'pdf'],
    ['paper.txt', Buffer.from('text'), 'txt'],
    ['paper.md', Buffer.from('# heading'), 'markdown'],
    ['paper.markdown', Buffer.from('# heading'), 'markdown'],
  ])('routes %s to the %s parser', async (fileName, buffer, sourceType) => {
    const selected = parser(sourceType as DocumentParser['sourceType']);
    const service = new DocumentParserService([selected]);

    await service.parse({ fileName, buffer });

    expect(selected.parse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['paper.exe', Buffer.from('hello'), 'UNSUPPORTED_FILE_TYPE'],
    ['paper.txt', Buffer.alloc(0), 'EMPTY_FILE'],
    ['paper.txt', Buffer.alloc(25 * 1024 * 1024 + 1), 'FILE_TOO_LARGE'],
    ['paper.pdf', Buffer.from('not-pdf'), 'INVALID_FILE_SIGNATURE'],
    ['paper.docx', Buffer.from('not-docx'), 'INVALID_FILE_SIGNATURE'],
  ])('rejects %s with %s', async (fileName, buffer, code) => {
    const service = new DocumentParserService([]);
    await expect(service.parse({ fileName, buffer })).rejects.toMatchObject({ code });
  });

  it('rejects explicit MIME conflicts but accepts omitted MIME', async () => {
    const txt = parser('txt');
    const service = new DocumentParserService([txt]);

    await expect(service.parse({ fileName: 'paper.txt', mimeType: 'image/png', buffer: Buffer.from('text') })).rejects.toMatchObject({
      code: 'MIME_EXTENSION_MISMATCH',
    });
    await expect(service.parse({ fileName: 'paper.txt', buffer: Buffer.from('text') })).resolves.toMatchObject({
      source: { mimeType: undefined },
    });
  });

  it('does not accept a server path as file metadata', async () => {
    const service = new DocumentParserService([]);
    await expect(service.parse({ fileName: 'D:\\secret\\paper.txt', buffer: Buffer.from('text') })).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
    });
  });

  it('maps unknown parser failures to a safe public error', async () => {
    const service = new DocumentParserService([parser('txt', new Error('private parser stack details'))]);
    await expect(service.parse({ fileName: 'paper.txt', buffer: Buffer.from('text') })).rejects.toEqual(
      expect.objectContaining({ code: 'PARSER_FAILED', message: 'The document could not be parsed.' }),
    );
    await expect(service.parse({ fileName: 'paper.txt', buffer: Buffer.from('text') })).rejects.not.toThrow(
      'private parser stack details',
    );
  });

  it('preserves known parser error codes without exposing implementation details', async () => {
    const service = new DocumentParserService([
      parser('txt', new DocumentParseError('INVALID_TEXT_ENCODING', 'The text file is not valid UTF-8.')),
    ]);
    await expect(service.parse({ fileName: 'paper.txt', buffer: Buffer.from('text') })).rejects.toMatchObject({
      code: 'INVALID_TEXT_ENCODING',
    });
  });

  it('maps a structurally invalid DOCX to CORRUPT_DOCUMENT after signature validation', async () => {
    const service = new DocumentParserService([new DocxParser()]);
    await expect(service.parse({ fileName: 'invalid.docx', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]) })).rejects.toMatchObject({
      code: 'CORRUPT_DOCUMENT',
    });
  });

  it('maps a structurally invalid PDF to CORRUPT_DOCUMENT after signature validation', async () => {
    const service = new DocumentParserService([new PdfParser()]);
    await expect(service.parse({ fileName: 'invalid.pdf', buffer: Buffer.from('%PDF-1.4') })).rejects.toMatchObject({
      code: 'CORRUPT_DOCUMENT',
    });
  });
});
