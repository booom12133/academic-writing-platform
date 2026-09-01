export type DocumentSourceType = 'docx' | 'pdf' | 'txt' | 'markdown';

export interface ParseDocumentInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}

export interface DocumentSource {
  type: DocumentSourceType;
  fileName: string;
  extension: '.docx' | '.pdf' | '.txt' | '.md' | '.markdown';
  mimeType?: string;
  sizeBytes: number;
}

export interface BaseDocumentBlock {
  id: string;
  text: string;
  pageNumber?: number;
}

export interface HeadingBlock extends BaseDocumentBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ParagraphBlock extends BaseDocumentBlock {
  type: 'paragraph';
}

export interface ListItemBlock extends BaseDocumentBlock {
  type: 'list-item';
  ordered: boolean;
  depth: number;
}

export interface TableBlock extends BaseDocumentBlock {
  type: 'table';
  rows: Array<{ cells: string[] }>;
}

export interface CodeBlock extends BaseDocumentBlock {
  type: 'code';
  language?: string;
}

export interface FormulaBlock extends BaseDocumentBlock {
  type: 'formula';
  display: boolean;
}

export type DocumentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListItemBlock
  | TableBlock
  | CodeBlock
  | FormulaBlock;

export type DraftDocumentBlock =
  | Omit<HeadingBlock, 'id'>
  | Omit<ParagraphBlock, 'id'>
  | Omit<ListItemBlock, 'id'>
  | Omit<TableBlock, 'id'>
  | Omit<CodeBlock, 'id'>
  | Omit<FormulaBlock, 'id'>;

export interface ParsedDocumentDraft {
  title?: string;
  blocks: DraftDocumentBlock[];
  metadata?: DocumentMetadata;
  warnings?: DocumentParseWarning[];
}

export interface DocumentOutlineEntry {
  headingBlockId: string;
  title: string;
  level: number;
  startBlockIndex: number;
  endBlockIndexExclusive: number;
}

export interface DocumentReferenceSection {
  headingBlockId: string;
  startBlockIndex: number;
  endBlockIndexExclusive: number;
  detection: 'explicit-heading';
}

export interface DocumentMetadata {
  pageCount?: number;
}

export type DocumentParseWarningCode =
  | 'PDF_LAYOUT_SIMPLIFIED'
  | 'DOCX_UNSUPPORTED_CONTENT_SKIPPED'
  | 'TABLE_STRUCTURE_PARTIAL'
  | 'REFERENCE_SECTION_HEURISTIC';

export interface DocumentParseWarning {
  code: DocumentParseWarningCode;
  message: string;
  blockId?: string;
  pageNumber?: number;
}

export interface ParsedDocument {
  source: DocumentSource;
  title?: string;
  blocks: DocumentBlock[];
  outline: DocumentOutlineEntry[];
  referenceSection?: DocumentReferenceSection;
  plainText: string;
  metadata: DocumentMetadata;
  warnings: DocumentParseWarning[];
}
