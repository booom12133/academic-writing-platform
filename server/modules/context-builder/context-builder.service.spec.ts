import { ContextBuilderService } from './context-builder.service';
import {
  DocumentSource,
  ParsedDocument,
} from '../document-parsing/document-parser.types';

describe('ContextBuilderService', () => {
  it('builds task context from a parsed document', () => {
    const source: DocumentSource = {
      type: 'markdown', fileName: 'paper.md', extension: '.md',
      mimeType: 'text/markdown', sizeBytes: 20,
    };
    const document: ParsedDocument = {
      source,
      title: 'Paper',
      blocks: [
        { id: 'b000001', type: 'heading', level: 1, text: 'Introduction' },
        { id: 'b000002', type: 'paragraph', text: 'Evidence.' },
      ],
      outline: [], plainText: 'Introduction\n\nEvidence.', metadata: {}, warnings: [],
    };

    const context = new ContextBuilderService().build({
      taskType: 'polish',
      document,
      userInstructions: 'Only polish language.',
    });

    expect(context.version).toBe(1);
    expect(context.task).toEqual({
      type: 'polish',
      userInstructions: 'Only polish language.',
    });
    expect(context.source).toEqual({
      id: 'document-1',
      kind: 'parsed-document',
      fileName: source.fileName,
      sourceType: source.type,
      extension: source.extension,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      title: 'Paper',
      metadata: {},
      warnings: [],
    });
    expect(context.units).toHaveLength(2);
  });
});
