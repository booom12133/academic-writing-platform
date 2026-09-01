import {
  DocumentBlock,
  DocumentMetadata,
  DocumentParseWarning,
  DocumentSource,
  DocumentSourceType,
  HeadingBlock,
  ParsedDocument,
} from '../document-parsing/document-parser.types';

export type ContextTaskType = 'polish' | 'paper-revision';

export interface BuildTaskContextInput {
  taskType: ContextTaskType;
  document: ParsedDocument;
  userInstructions?: string;
}

export interface TaskContext {
  version: 1;
  task: { type: ContextTaskType; userInstructions?: string };
  source: ContextDocumentSource;
  units: ContextUnit[];
}

export interface ContextDocumentSource {
  id: 'document-1';
  kind: 'parsed-document';
  fileName: string;
  sourceType: DocumentSourceType;
  extension: DocumentSource['extension'];
  mimeType?: string;
  sizeBytes: number;
  title?: string;
  metadata: DocumentMetadata;
  warnings: DocumentParseWarning[];
}

export interface ContextHeadingRef {
  sourceBlockId: string;
  title: string;
  level: HeadingBlock['level'];
}

export interface ContextUnit {
  id: string;
  sourceId: 'document-1';
  sourceBlockId: string;
  sourceBlockIndex: number;
  section: 'content' | 'references';
  headingPath: ContextHeadingRef[];
  block: DocumentBlock;
}
