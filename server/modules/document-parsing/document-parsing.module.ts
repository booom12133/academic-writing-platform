import { Module } from '@nestjs/common';

import { DocumentParserService, DOCUMENT_PARSERS } from './document-parser.service';
import { DocxParser } from './parsers/docx.parser';
import { MarkdownParser } from './parsers/markdown.parser';
import { PdfParser } from './parsers/pdf.parser';
import { TxtParser } from './parsers/txt.parser';

@Module({
  providers: [
    DocxParser,
    PdfParser,
    TxtParser,
    MarkdownParser,
    {
      provide: DOCUMENT_PARSERS,
      useFactory: (
        docxParser: DocxParser,
        pdfParser: PdfParser,
        txtParser: TxtParser,
        markdownParser: MarkdownParser,
      ) => [docxParser, pdfParser, txtParser, markdownParser],
      inject: [DocxParser, PdfParser, TxtParser, MarkdownParser],
    },
    DocumentParserService,
  ],
  exports: [DocumentParserService],
})
export class DocumentParsingModule {}
