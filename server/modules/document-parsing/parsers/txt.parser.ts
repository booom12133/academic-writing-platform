import { Injectable } from '@nestjs/common';

import { DocumentParseError } from '../document-parser.errors';
import type { DocumentParser, ValidatedDocumentInput } from '../document-parser.interface';
import type { ParsedDocumentDraft } from '../document-parser.types';

@Injectable()
export class TxtParser implements DocumentParser {
  readonly sourceType = 'txt' as const;

  async parse(input: ValidatedDocumentInput): Promise<ParsedDocumentDraft> {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input.buffer);
    } catch (error) {
      throw new DocumentParseError('INVALID_TEXT_ENCODING', 'The text file is not valid UTF-8.', error);
    }

    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    return {
      blocks: text
        .split(/\n\s*\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => ({ type: 'paragraph' as const, text: paragraph })),
    };
  }
}
