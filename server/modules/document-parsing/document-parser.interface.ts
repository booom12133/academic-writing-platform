import type {
  DocumentSourceType,
  ParsedDocumentDraft,
} from './document-parser.types';

export interface ValidatedDocumentInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  extension: '.docx' | '.pdf' | '.txt' | '.md' | '.markdown';
  sourceType: DocumentSourceType;
  sizeBytes: number;
}

export interface DocumentParser {
  readonly sourceType: DocumentSourceType;
  parse(input: ValidatedDocumentInput): Promise<ParsedDocumentDraft>;
}
