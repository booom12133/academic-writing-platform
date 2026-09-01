import { Injectable } from '@nestjs/common';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { DocumentParseError } from '../document-parser.errors';
import type { DocumentParser, ValidatedDocumentInput } from '../document-parser.interface';
import type { DraftDocumentBlock, ParsedDocumentDraft } from '../document-parser.types';

interface PdfTextItem {
  str?: string;
  transform?: number[];
  height?: number;
  width?: number;
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPage {
  getTextContent(): Promise<PdfTextContent>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

type PdfJsApi = typeof import('pdfjs-dist/legacy/build/pdf.js');
const requireFromParser = createRequire(__filename);
let pdfjsLib: PdfJsApi | undefined;

@Injectable()
export class PdfParser implements DocumentParser {
  readonly sourceType = 'pdf' as const;

  async parse(input: ValidatedDocumentInput): Promise<ParsedDocumentDraft> {
    let document: PdfDocument | undefined;
    try {
      const pdfjs = getPdfJs();
      const standardFontDataUrl = join(dirname(requireFromParser.resolve('pdfjs-dist/package.json')), 'standard_fonts');
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(input.buffer),
        standardFontDataUrl: `${standardFontDataUrl}/`,
        verbosity: 0,
      });
      document = (await loadingTask.promise) as unknown as PdfDocument;
      const blocks: DraftDocumentBlock[] = [];
      let hasSelectableText = false;

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items.filter((item) => Boolean(item.str?.trim()));
        if (items.length) hasSelectableText = true;
        blocks.push(...reconstructPage(items, pageNumber));
      }

      if (!hasSelectableText) {
        throw new DocumentParseError(
          'PDF_NO_SELECTABLE_TEXT',
          'The PDF contains no selectable text. OCR is not supported in Phase C1.',
        );
      }

      return {
        blocks,
        metadata: { pageCount: document.numPages },
        warnings: [{
          code: 'PDF_LAYOUT_SIMPLIFIED',
          message: 'PDF text order was reconstructed with basic line grouping.',
        }],
      };
    } catch (error) {
      if (error instanceof DocumentParseError) throw error;
      if (isPasswordError(error)) {
        throw new DocumentParseError('PASSWORD_PROTECTED_DOCUMENT', 'The PDF is password protected.', error);
      }
      if (isCorruptPdfError(error)) {
        throw new DocumentParseError('CORRUPT_DOCUMENT', 'The PDF document is corrupt or unreadable.', error);
      }
      throw new DocumentParseError('PARSER_FAILED', 'The PDF could not be parsed.', error);
    } finally {
      if (document) await document.destroy().catch(() => undefined);
    }
  }
}

function getPdfJs(): PdfJsApi {
  if (pdfjsLib) return pdfjsLib;
  const globals = globalThis as Record<string, unknown>;
  if (!globals.DOMMatrix) globals.DOMMatrix = class DOMMatrix {};
  if (!globals.Path2D) globals.Path2D = class Path2D {};
  pdfjsLib = requireFromParser('pdfjs-dist/legacy/build/pdf.js') as PdfJsApi;
  return pdfjsLib;
}

interface PdfLine {
  y: number;
  x: number;
  height: number;
  text: string;
}

function reconstructPage(items: PdfTextItem[], pageNumber: number): DraftDocumentBlock[] {
  const lines: PdfLine[] = [];
  for (const item of items) {
    const transform = item.transform ?? [];
    const x = transform[4] ?? 0;
    const y = transform[5] ?? 0;
    const height = Math.abs(item.height || transform[3] || 12);
    const line = lines.find((candidate) => Math.abs(candidate.y - y) <= Math.max(2, height * 0.2));
    if (line) {
      line.text = joinText(line.text, item.str ?? '');
      line.x = Math.min(line.x, x);
    } else {
      lines.push({ y, x, height, text: item.str?.trim() ?? '' });
    }
  }

  lines.sort((left, right) => right.y - left.y || left.x - right.x);
  return lines.flatMap((line): DraftDocumentBlock[] => {
    const text = line.text.trim();
    if (!text) return [];
    const type = isLikelyHeading(text) ? 'heading' : 'paragraph';
    return type === 'heading'
      ? [{ type, level: 1 as const, text, pageNumber }]
      : [{ type, text, pageNumber }];
  });
}

function joinText(left: string, right: string): string {
  if (!left) return right.trim();
  if (!right) return left;
  return `${left}${/\s$/.test(left) || /^\s/.test(right) ? '' : ' '}${right.trim()}`;
}

function isLikelyHeading(text: string): boolean {
  return text.length <= 100 && !/[.!?。！？:]$/.test(text) && !/^\s*\[?\d+[\].)]/.test(text);
}

function isPasswordError(error: unknown): boolean {
  const value = error as { name?: string; message?: string };
  return value?.name === 'PasswordException' || /password|encrypted/i.test(value?.message ?? '');
}

function isCorruptPdfError(error: unknown): boolean {
  const value = error as { name?: string; message?: string };
  return value?.name === 'InvalidPDFException' || /invalid pdf|corrupt pdf|invalid file/i.test(value?.message ?? '');
}
