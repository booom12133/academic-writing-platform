import type {
  DocumentBlock,
  DocumentOutlineEntry,
  DocumentParseWarning,
  DocumentReferenceSection,
  DocumentSource,
  DraftDocumentBlock,
  ParsedDocument,
  ParsedDocumentDraft,
} from './document-parser.types';

const REFERENCE_TITLES = new Set(['references', 'bibliography', '参考文献']);

export class DocumentNormalizer {
  normalize(source: DocumentSource, draft: ParsedDocumentDraft): ParsedDocument {
    const blocks = draft.blocks
      .map((block) => this.normalizeBlock(block))
      .filter((block): block is DraftDocumentBlock => this.hasContent(block))
      .map((block, index) => ({ ...block, id: `b${String(index + 1).padStart(6, '0')}` }));

    const outline = this.buildOutline(blocks);
    const referenceSection = this.findReferenceSection(blocks);
    const warnings: DocumentParseWarning[] = [...(draft.warnings ?? [])];

    if (referenceSection) {
      warnings.push({
        code: 'REFERENCE_SECTION_HEURISTIC',
        message: 'Reference section identified from an explicit heading.',
        blockId: referenceSection.headingBlockId,
      });
    }

    return {
      source,
      title: draft.title,
      blocks,
      outline,
      referenceSection,
      plainText: blocks.map((block) => this.renderBlock(block)).join('\n\n'),
      metadata: draft.metadata ?? {},
      warnings,
    };
  }

  private normalizeBlock(block: DraftDocumentBlock): DraftDocumentBlock {
    if (block.type === 'table') {
      return {
        ...block,
        text: block.text.trim(),
        rows: block.rows.map((row) => ({ cells: row.cells.map((cell) => this.normalizeInline(cell)) })),
      };
    }

    if (block.type === 'code' || block.type === 'formula') {
      return { ...block, text: block.text.replace(/\r\n?/g, '\n').trim() };
    }

    return { ...block, text: this.normalizeInline(block.text) };
  }

  private normalizeInline(text: string): string {
    return text.replace(/\r\n?/g, '\n').replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]+/g, ' ').trim();
  }

  private hasContent(block: DraftDocumentBlock): boolean {
    return block.type === 'table' ? block.rows.length > 0 : block.text.length > 0;
  }

  private buildOutline(blocks: DocumentBlock[]): DocumentOutlineEntry[] {
    return blocks.flatMap((block, index) => {
      if (block.type !== 'heading') return [];
      const nextBoundary = blocks.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex > index && candidate.type === 'heading' && candidate.level <= block.level,
      );
      return [{
        headingBlockId: block.id,
        title: block.text,
        level: block.level,
        startBlockIndex: index,
        endBlockIndexExclusive: nextBoundary === -1 ? blocks.length : nextBoundary,
      }];
    });
  }

  private findReferenceSection(blocks: DocumentBlock[]): DocumentReferenceSection | undefined {
    const headingIndex = blocks.findIndex(
      (block) => block.type === 'heading' && REFERENCE_TITLES.has(this.normalizeReferenceTitle(block.text)),
    );
    if (headingIndex === -1) return undefined;

    const heading = blocks[headingIndex];
    if (heading.type !== 'heading') return undefined;
    const boundary = blocks.findIndex(
      (block, index) => index > headingIndex && block.type === 'heading' && block.level <= heading.level,
    );

    return {
      headingBlockId: heading.id,
      startBlockIndex: headingIndex,
      endBlockIndexExclusive: boundary === -1 ? blocks.length : boundary,
      detection: 'explicit-heading',
    };
  }

  private normalizeReferenceTitle(text: string): string {
    return text
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[：:]\s*$/, '')
      .replace(/^\d+(?:\.\d+)*\.?\s+/, '')
      .trim();
  }

  private renderBlock(block: DocumentBlock): string {
    switch (block.type) {
      case 'list-item':
        return `${block.ordered ? '1.' : '-'} ${block.text}`;
      case 'table':
        return block.rows.map((row) => row.cells.join(' | ')).join('\n');
      default:
        return block.text;
    }
  }
}
