jest.mock('pdfjs-dist/legacy/build/pdf.js', () => ({
  getDocument: jest.fn(),
}));

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

import type { ValidatedDocumentInput } from '../document-parser.interface';
import { PdfParser } from './pdf.parser';

describe('PdfParser error mapping', () => {
  it('maps PDF.js password exceptions to PASSWORD_PROTECTED_DOCUMENT', async () => {
    const error = Object.assign(new Error('password required'), { name: 'PasswordException' });
    (pdfjsLib.getDocument as jest.Mock).mockReturnValueOnce({ promise: Promise.reject(error) });

    const input: ValidatedDocumentInput = {
      buffer: Buffer.from('%PDF-1.4'),
      fileName: 'protected.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      sourceType: 'pdf',
      sizeBytes: 8,
    };

    await expect(new PdfParser().parse(input)).rejects.toEqual(
      expect.objectContaining({
        code: 'PASSWORD_PROTECTED_DOCUMENT',
        message: 'The PDF is password protected.',
      }),
    );
  });
});
