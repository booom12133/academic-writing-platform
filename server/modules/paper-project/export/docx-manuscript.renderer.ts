import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import type { ManuscriptBlock, ManuscriptProjectionV1 } from '@shared/manuscript.interface';
import { GENERIC_ACADEMIC_TEMPLATE, genericAcademicStyles } from './generic-academic-v1.template';
import { MarkdownBlockParser, type ParsedMarkdownBlock } from './markdown-block-parser';
import type { DocxRenderOptions, ManuscriptRenderer } from './manuscript-renderer';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;
const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6] as const;

export class DocxManuscriptRenderer implements ManuscriptRenderer<DocxRenderOptions> {
  readonly format = 'DOCX' as const;
  readonly rendererVersion = '1' as const;
  private readonly markdown = new MarkdownBlockParser();

  async render(projection: ManuscriptProjectionV1, options: DocxRenderOptions) {
    if (options.templateKey !== GENERIC_ACADEMIC_TEMPLATE.key || !Number.isFinite(Date.parse(options.createdAt))) throw new Error('DOCX render options are invalid.');
    const children: Array<Paragraph | Table> = [];
    children.push(new Paragraph({ text: projection.title ?? 'Untitled Manuscript', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
    children.push(this.heading('Abstract', 1));
    children.push(new Paragraph({ text: projection.derived.abstract.content ?? '【摘要尚未生成】' }));
    children.push(this.heading('Keywords', 1));
    children.push(new Paragraph({ text: projection.derived.keywords.content ?? '【关键词尚未生成】' }));
    if (options.mode === 'DRAFT') {
      children.push(new Paragraph({ children: [new TextRun({ text: 'DRAFT — unresolved manuscript warnings are acknowledged for this export.', bold: true })] }));
      for (const warning of projection.warnings) children.push(new Paragraph({ text: `[${warning.code}] ${warning.message}` }));
    }
    children.push(this.heading('Table of Contents', 1));
    for (const item of projection.outline) children.push(new Paragraph({ text: item.title, indent: { left: item.depth * 360 } }));
    children.push(new Paragraph({ text: 'References' }));

    let firstTopLevel = true;
    for (const block of projection.blocks) {
      if (block.kind === 'heading') {
        const pageBreakBefore = block.level === 1 && !firstTopLevel;
        if (block.level === 1) firstTopLevel = false;
        children.push(this.heading(block.title, block.level, pageBreakBefore));
      } else if (block.kind === 'paragraph') {
        for (const parsed of this.markdown.parse(block.text)) children.push(...this.renderParsed(parsed));
      } else if (block.kind === 'missing-section') {
        children.push(new Paragraph({ children: [new TextRun({ text: block.text, italics: true })] }));
      } else {
        children.push(...this.references(block));
      }
    }

    const document = new Document({
      creator: 'Academic Writing Platform', title: projection.title ?? undefined, subject: 'Academic manuscript export',
      styles: genericAcademicStyles(projection.language),
      numbering: { config: [{ reference: 'manuscript-numbering', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{ children }],
    });
    this.setCoreTimestamps(document, options.createdAt);
    return { buffer: await Packer.toBuffer(document), mimeType: DOCX_MIME, extension: 'docx' as const };
  }

  private heading(text: string, level: number, pageBreakBefore = false): Paragraph {
    const normalized = Math.max(1, Math.min(9, level));
    return new Paragraph({
      text,
      ...(normalized <= 6 ? { heading: headingLevels[normalized - 1] } : { style: `ManuscriptHeading${normalized}` }),
      ...(pageBreakBefore ? { pageBreakBefore: true } : {}),
    });
  }

  private renderParsed(block: ParsedMarkdownBlock): Array<Paragraph | Table> {
    if (block.kind === 'paragraph') return [new Paragraph({ text: block.text })];
    if (block.kind === 'unordered-list') return block.items.map((text) => new Paragraph({ text, bullet: { level: 0 } }));
    if (block.kind === 'ordered-list') return block.items.map((text) => new Paragraph({ text, numbering: { reference: 'manuscript-numbering', level: 0 } }));
    return [new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: block.rows.map((row) => new TableRow({ children: row.map((text) => new TableCell({ children: [new Paragraph({ text })] })) })),
    })];
  }

  private references(block: Extract<ManuscriptBlock, { kind: 'references' }>): Paragraph[] {
    return [this.heading('References', 1), ...block.entries.map((entry) => new Paragraph({ text: `[${entry.number}] ${Object.values(entry.fields).flat().map(String).join('. ')}` }))];
  }

  private setCoreTimestamps(document: Document, createdAt: string): void {
    type XmlNode = { rootKey?: string; root?: unknown[] };
    const core = document.CoreProperties as unknown as XmlNode;
    for (const child of core.root ?? []) {
      const node = child as XmlNode;
      if ((node.rootKey === 'dcterms:created' || node.rootKey === 'dcterms:modified') && node.root?.length) node.root[node.root.length - 1] = createdAt;
    }
  }
}
