import { ContextBuilderService } from './context-builder.service';
import {
  DocumentSource,
  ParsedDocument,
} from '../document-parsing/document-parser.types';

describe('ContextBuilderService', () => {
  const source: DocumentSource = {
    type: 'markdown', fileName: 'paper.md', extension: '.md',
    mimeType: 'text/markdown', sizeBytes: 20,
  };
  const document: ParsedDocument = {
    source,
    title: 'Paper',
    blocks: [
      { id: 'b000001', type: 'heading', level: 1, text: 'Introduction' },
      { id: 'b000002', type: 'paragraph', text: 'Evidence.', pageNumber: 2 },
      { id: 'b000003', type: 'list-item', ordered: true, depth: 1, text: 'Finding' },
      {
        id: 'b000004', type: 'table', text: '',
        rows: [{ cells: ['Method', 'Score'] }, { cells: ['A', '92.4'] }],
      },
      { id: 'b000005', type: 'code', language: 'ts', text: 'const answer = 42;' },
      { id: 'b000006', type: 'formula', display: true, text: 'E = mc^2' },
    ],
    outline: [], plainText: 'Introduction\n\nEvidence.',
    metadata: { pageCount: 2 },
    warnings: [{ code: 'PDF_LAYOUT_SIMPLIFIED', message: 'Layout simplified.' }],
  };

  it('builds task context from a parsed document', () => {
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
      metadata: document.metadata,
      warnings: document.warnings,
    });
    expect(context.units).toHaveLength(6);
  });

  it('maps every source block once in the original order with deterministic IDs', () => {
    const result = new ContextBuilderService().build({ taskType: 'paper-revision', document });

    expect(result.units).toHaveLength(document.blocks.length);
    expect(result.units.map((unit) => unit.id)).toEqual([
      'document-1:b000001', 'document-1:b000002', 'document-1:b000003',
      'document-1:b000004', 'document-1:b000005', 'document-1:b000006',
    ]);
    result.units.forEach((unit, index) => {
      expect(unit.sourceId).toBe('document-1');
      expect(unit.sourceBlockId).toBe(document.blocks[index].id);
      expect(unit.sourceBlockIndex).toBe(index);
      expect(unit.block).toEqual(document.blocks[index]);
    });
  });

  it('returns the same context for repeated calls with the same input', () => {
    const service = new ContextBuilderService();
    expect(service.build({ taskType: 'polish', document })).toEqual(
      service.build({ taskType: 'polish', document }),
    );
  });

  it('copies table rows and cell arrays for each mapped unit', () => {
    const result = new ContextBuilderService().build({ taskType: 'polish', document });
    const tableBlock = result.units[3].block;
    const sourceTableBlock = document.blocks[3];

    if (tableBlock.type !== 'table') throw new Error('Expected table block.');
    if (sourceTableBlock.type !== 'table') throw new Error('Expected source table block.');
    expect(tableBlock.rows).not.toBe(sourceTableBlock.rows);
    expect(tableBlock.rows[0].cells).not.toBe(sourceTableBlock.rows[0].cells);
    tableBlock.rows[0].cells[0] = 'Changed';
    expect(sourceTableBlock.rows[0].cells[0]).toBe('Method');
  });

  it('preserves deterministic heading paths and reference sections from C1 metadata', () => {
    const contextDocument: ParsedDocument = {
      source,
      title: 'Paper',
      blocks: [
        { id: 'b000001', type: 'heading', level: 1, text: 'Introduction' },
        { id: 'b000002', type: 'paragraph', text: 'Intro paragraph.' },
        { id: 'b000003', type: 'heading', level: 2, text: 'Background' },
        { id: 'b000004', type: 'paragraph', text: 'Background paragraph.' },
        { id: 'b000005', type: 'heading', level: 3, text: 'Design' },
        { id: 'b000006', type: 'paragraph', text: 'Design paragraph.' },
        { id: 'b000007', type: 'heading', level: 2, text: 'Results' },
        { id: 'b000008', type: 'paragraph', text: 'Results paragraph.' },
        { id: 'b000009', type: 'heading', level: 1, text: 'References' },
        { id: 'b000010', type: 'paragraph', text: 'Reference entry.' },
      ],
      outline: [],
      referenceSection: {
        headingBlockId: 'b000009',
        startBlockIndex: 8,
        endBlockIndexExclusive: 10,
        detection: 'explicit-heading',
      },
      plainText: '',
      metadata: {},
      warnings: [],
    };

    const result = new ContextBuilderService().build({ taskType: 'polish', document: contextDocument });

    expect(result.units.map((unit) => unit.headingPath.map((heading) => heading.title))).toEqual([
      ['Introduction'], ['Introduction'],
      ['Introduction', 'Background'], ['Introduction', 'Background'],
      ['Introduction', 'Background', 'Design'], ['Introduction', 'Background', 'Design'],
      ['Introduction', 'Results'], ['Introduction', 'Results'],
      ['References'], ['References'],
    ]);
    expect(result.units.slice(8).map((unit) => unit.section)).toEqual(['references', 'references']);
    expect(result.units.slice(0, 8).every((unit) => unit.section === 'content')).toBe(true);
  });

  it('keeps every unit in content when C1 provides no reference section', () => {
    const contextDocument: ParsedDocument = {
      source,
      title: 'Paper',
      blocks: [
        { id: 'b000001', type: 'heading', level: 1, text: 'References' },
        { id: 'b000002', type: 'paragraph', text: 'Still content.' },
      ],
      outline: [],
      plainText: '',
      metadata: {},
      warnings: [],
    };

    const result = new ContextBuilderService().build({ taskType: 'polish', document: contextDocument });

    expect(result.units.every((unit) => unit.section === 'content')).toBe(true);
  });
});
