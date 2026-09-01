import type { DocumentSource, ParsedDocumentDraft } from './document-parser.types';
import { DocumentNormalizer } from './document-normalizer';

const source: DocumentSource = {
  type: 'markdown',
  fileName: 'paper.md',
  extension: '.md',
  mimeType: 'text/markdown',
  sizeBytes: 10,
};

describe('DocumentNormalizer', () => {
  it('assigns deterministic ids and derives plain text from normalized blocks', () => {
    const draft: ParsedDocumentDraft = {
      blocks: [
        { type: 'heading', level: 1, text: 'Introduction' },
        { type: 'paragraph', text: 'A paragraph.' },
        { type: 'list-item', ordered: false, depth: 0, text: 'Item' },
        { type: 'table', rows: [{ cells: ['Method', 'Score'] }, { cells: ['A', '92.4'] }], text: '' },
        { type: 'code', language: 'ts', text: 'const answer = 42;' },
        { type: 'formula', display: true, text: 'E = mc^2' },
      ],
    };

    const first = new DocumentNormalizer().normalize(source, draft);
    const second = new DocumentNormalizer().normalize(source, draft);

    expect(first).toEqual(second);
    expect(first.blocks.map((block) => block.id)).toEqual([
      'b000001',
      'b000002',
      'b000003',
      'b000004',
      'b000005',
      'b000006',
    ]);
    expect(first.plainText).toBe(
      'Introduction\n\nA paragraph.\n\n- Item\n\nMethod | Score\nA | 92.4\n\nconst answer = 42;\n\nE = mc^2',
    );
  });

  it('computes heading ranges and recognizes explicit reference headings', () => {
    const draft: ParsedDocumentDraft = {
      blocks: [
        { type: 'heading', level: 1, text: 'Introduction' },
        { type: 'heading', level: 2, text: 'Background' },
        { type: 'paragraph', text: 'Context.' },
        { type: 'heading', level: 2, text: 'Motivation' },
        { type: 'heading', level: 1, text: '6. References:' },
        { type: 'paragraph', text: '[1] Example.' },
      ],
    };

    const result = new DocumentNormalizer().normalize(source, draft);

    expect(result.outline).toEqual([
      { headingBlockId: 'b000001', title: 'Introduction', level: 1, startBlockIndex: 0, endBlockIndexExclusive: 4 },
      { headingBlockId: 'b000002', title: 'Background', level: 2, startBlockIndex: 1, endBlockIndexExclusive: 3 },
      { headingBlockId: 'b000004', title: 'Motivation', level: 2, startBlockIndex: 3, endBlockIndexExclusive: 4 },
      { headingBlockId: 'b000005', title: '6. References:', level: 1, startBlockIndex: 4, endBlockIndexExclusive: 6 },
    ]);
    expect(result.referenceSection).toEqual({
      headingBlockId: 'b000005',
      startBlockIndex: 4,
      endBlockIndexExclusive: 6,
      detection: 'explicit-heading',
    });
  });

  it.each(['References', 'Bibliography', '参考文献', '6 References', '6. References'])(
    'recognizes %s as an explicit reference heading',
    (headingText) => {
      const result = new DocumentNormalizer().normalize(source, {
        blocks: [
          { type: 'heading', level: 1, text: headingText },
          { type: 'paragraph', text: '[1] Example.' },
        ],
      });

      expect(result.referenceSection).toMatchObject({
        headingBlockId: 'b000001',
        startBlockIndex: 0,
        endBlockIndexExclusive: 2,
        detection: 'explicit-heading',
      });
    },
  );
});
