import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { parseDocument } from 'htmlparser2';

import { DocumentParseError } from '../document-parser.errors';
import type { DocumentParser, ValidatedDocumentInput } from '../document-parser.interface';
import type { DocumentParseWarning, DraftDocumentBlock, ParsedDocumentDraft } from '../document-parser.types';

interface DomNode {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  data?: string;
  children?: DomNode[];
}

@Injectable()
export class DocxParser implements DocumentParser {
  readonly sourceType = 'docx' as const;

  async parse(input: ValidatedDocumentInput): Promise<ParsedDocumentDraft> {
    let result: { value: string; messages: Array<{ type?: string }> };
    try {
      result = await mammoth.convertToHtml(
        { buffer: input.buffer },
        { styleMap: ["p[style-name='Title'] => h1.document-title:fresh"] },
      );
    } catch (error) {
      throw new DocumentParseError('CORRUPT_DOCUMENT', 'The DOCX document is corrupt or unreadable.', error);
    }

    const blocks: DraftDocumentBlock[] = [];
    let title: string | undefined;
    const append = (block: DraftDocumentBlock, explicitTitle?: boolean) => {
      blocks.push(block);
      if (!title && explicitTitle && block.type === 'heading' && block.level === 1) title = block.text;
    };
    const walk = (node: DomNode) => {
      if (node.type !== 'tag') return;
      const name = node.name?.toLowerCase();
      if (!name) return;

      if (/^h[1-6]$/.test(name)) {
        const text = inlineText(node);
        if (text) append(
          { type: 'heading', level: Number(name.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6, text },
          node.attribs?.class === 'document-title',
        );
      } else if (name === 'p') {
        const text = inlineText(node);
        if (text) append({ type: 'paragraph', text });
      } else if (name === 'ul' || name === 'ol') {
        appendList(node, name === 'ol', 0);
      } else if (name === 'table') {
        const rows = descendants(node, 'tr').map((row) => ({
          cells: (row.children ?? [])
            .filter((cell) => cell.type === 'tag' && (cell.name === 'td' || cell.name === 'th'))
            .map((cell) => inlineText(cell)),
        })).filter((row) => row.cells.length > 0);
        if (rows.length) append({ type: 'table', text: '', rows });
      } else if (name === 'pre') {
        const text = textContent(node).trim();
        if (text) append({ type: 'code', text });
      } else {
        for (const child of node.children ?? []) walk(child);
      }
    };
    const appendList = (list: DomNode, ordered: boolean, depth: number) => {
      for (const item of (list.children ?? []).filter((child) => child.type === 'tag' && child.name === 'li')) {
        const text = inlineText(item, true);
        if (text) append({ type: 'list-item', ordered, depth, text });
        for (const nested of (item.children ?? []).filter((child) => child.type === 'tag' && (child.name === 'ul' || child.name === 'ol'))) {
          appendList(nested, nested.name === 'ol', depth + 1);
        }
      }
    };

    const root = parseDocument(result.value) as unknown as DomNode;
    for (const child of root.children ?? []) walk(child);

    const warnings: DocumentParseWarning[] = result.messages.length
      ? [{ code: 'DOCX_UNSUPPORTED_CONTENT_SKIPPED', message: 'Some unsupported DOCX content was skipped safely.' }]
      : [];
    return { title, blocks, warnings };
  }
}

function textContent(node: DomNode): string {
  if (node.type === 'text') return node.data ?? '';
  return (node.children ?? []).map(textContent).join('');
}

function inlineText(node: DomNode, excludeNestedLists = false): string {
  return (node.children ?? [])
    .filter((child) => !excludeNestedLists || !(child.type === 'tag' && (child.name === 'ul' || child.name === 'ol')))
    .map(textContent)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function descendants(node: DomNode, name: string): DomNode[] {
  return (node.children ?? []).flatMap((child) => {
    if (child.type !== 'tag') return [];
    return child.name === name ? [child, ...descendants(child, name)] : descendants(child, name);
  });
}
