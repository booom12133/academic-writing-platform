import { Inject, Injectable } from '@nestjs/common';

import { DocumentParseError } from './document-parser.errors';
import type { DocumentParser, ValidatedDocumentInput } from './document-parser.interface';
import { DocumentNormalizer } from './document-normalizer';
import type {
  DocumentSource,
  DocumentSourceType,
  ParseDocumentInput,
  ParsedDocument,
} from './document-parser.types';

export const DOCUMENT_PARSERS = Symbol('DOCUMENT_PARSERS');
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

const MIME_TYPES: Record<string, Set<string>> = {
  '.docx': new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream']),
  '.pdf': new Set(['application/pdf', 'application/octet-stream']),
  '.txt': new Set(['text/plain', 'application/octet-stream']),
  '.md': new Set(['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream']),
  '.markdown': new Set(['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream']),
};

const SOURCE_TYPES: Record<string, DocumentSourceType> = {
  '.docx': 'docx',
  '.pdf': 'pdf',
  '.txt': 'txt',
  '.md': 'markdown',
  '.markdown': 'markdown',
};

@Injectable()
export class DocumentParserService {
  private readonly normalizer = new DocumentNormalizer();

  constructor(@Inject(DOCUMENT_PARSERS) private readonly parsers: DocumentParser[] = []) {}

  async parse(input: ParseDocumentInput): Promise<ParsedDocument> {
    const validated = this.validate(input);
    const parser = this.parsers.find((candidate) => candidate.sourceType === validated.sourceType);
    if (!parser) throw new DocumentParseError('PARSER_FAILED', 'No parser is registered for this document type.');

    const source: DocumentSource = {
      type: validated.sourceType,
      fileName: validated.fileName,
      extension: validated.extension,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
    };

    try {
      const draft = await parser.parse(validated);
      return this.normalizer.normalize(source, draft);
    } catch (error) {
      if (error instanceof DocumentParseError) throw error;
      throw new DocumentParseError('PARSER_FAILED', 'The document could not be parsed.', error);
    }
  }

  private validate(input: ParseDocumentInput): ValidatedDocumentInput {
    if (!input || !Buffer.isBuffer(input.buffer)) {
      throw new DocumentParseError('PARSER_FAILED', 'A document buffer is required.');
    }
    if (!input.fileName || input.fileName.includes('/') || input.fileName.includes('\\')) {
      throw new DocumentParseError('UNSUPPORTED_FILE_TYPE', 'The document file name must be a safe file name.');
    }

    const sizeBytes = input.buffer.length;
    if (sizeBytes === 0) throw new DocumentParseError('EMPTY_FILE', 'The document file is empty.');
    if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new DocumentParseError('FILE_TOO_LARGE', 'The document exceeds the 25 MiB size limit.');
    }

    const extensionValue = this.getExtension(input.fileName);
    const sourceType = SOURCE_TYPES[extensionValue];
    if (!sourceType) throw new DocumentParseError('UNSUPPORTED_FILE_TYPE', 'The document file type is not supported.');
    const extension = extensionValue as ValidatedDocumentInput['extension'];

    const mimeType = input.mimeType?.split(';', 1)[0].trim().toLowerCase() || undefined;
    if (mimeType && !MIME_TYPES[extension].has(mimeType)) {
      throw new DocumentParseError('MIME_EXTENSION_MISMATCH', 'The MIME type does not match the file extension.');
    }

    this.validateSignature(extension, input.buffer);
    return { ...input, mimeType, extension, sourceType, sizeBytes };
  }

  private getExtension(fileName: string): ValidatedDocumentInput['extension'] | string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase();
  }

  private validateSignature(extension: string, buffer: Buffer): void {
    if (extension === '.pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new DocumentParseError('INVALID_FILE_SIGNATURE', 'The PDF file signature is invalid.');
    }
    if (extension === '.docx' && (buffer[0] !== 0x50 || buffer[1] !== 0x4b)) {
      throw new DocumentParseError('INVALID_FILE_SIGNATURE', 'The DOCX ZIP file signature is invalid.');
    }
  }
}
