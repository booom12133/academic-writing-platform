import { Injectable } from '@nestjs/common';
import { marked } from 'marked';

import { DocumentParseError } from '../document-parser.errors';
import type { DocumentParser, ValidatedDocumentInput } from '../document-parser.interface';
import type { DraftDocumentBlock, ParsedDocumentDraft } from '../document-parser.types';

interface MarkedToken {
  type?: string;
  depth?: number;
  text?: string;
  raw?: string;
  lang?: string;
  ordered?: boolean;
  items?: MarkedToken[];
  tokens?: MarkedToken[];
  header?: string[];
  rows?: string[][];
  alt?: string;
}

@Injectable()
export class MarkdownParser implements DocumentParser {
  readonly sourceType = 'markdown' as const;

  async parse(input: ValidatedDocumentInput): Promise<ParsedDocumentDraft> {
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(input.buffer).replace(/^\uFEFF/, '');
    } catch (error) {
      throw new DocumentParseError('INVALID_TEXT_ENCODING', 'The Markdown file is not valid UTF-8.', error);
    }
    const blocks: DraftDocumentBlock[] = [];
    let title: string | undefined;
    let cursor = 0;
    const formulaPattern = /\$\$([\s\S]*?)\$\$/g;
    let match: RegExpExecArray | null;

    const appendTokens = (tokens: MarkedToken[]) => {
      for (const token of tokens) {
        if (token.type === 'heading') {
          const text = tokenText(token);
          const level = Math.min(6, Math.max(1, token.depth ?? 1)) as 1 | 2 | 3 | 4 | 5 | 6;
          blocks.push({ type: 'heading', level, text });
          if (!title && level === 1 && text) title = text;
        } else if (token.type === 'paragraph') {
          blocks.push({ type: 'paragraph', text: tokenText(token) });
        } else if (token.type === 'list') {
          appendListItems(token.items ?? [], Boolean(token.ordered), 0);
        } else if (token.type === 'code') {
          blocks.push({ type: 'code', language: token.lang || undefined, text: token.text ?? '' });
        } else if (token.type === 'table') {
          const header = (token.header ?? []).map((cell) => inlineText(cell));
          const rows = (token.rows ?? []).map((row) => ({ cells: row.map((cell) => inlineText(cell)) }));
          blocks.push({ type: 'table', text: '', rows: header.length ? [{ cells: header }, ...rows] : rows });
        } else if (token.type === 'blockquote') {
          const text = tokenText(token);
          if (text) blocks.push({ type: 'paragraph', text });
        }
      }
    };

    const appendListItems = (items: MarkedToken[], ordered: boolean, depth: number) => {
      for (const item of items) {
        const nestedLists: MarkedToken[] = [];
        const itemTokens = (item.tokens ?? []).filter((child) => {
          if (child.type === 'list') {
            nestedLists.push(child);
            return false;
          }
          return true;
        });
        const text = itemTokens.length ? itemTokens.map(tokenText).join('') : inlineText(item.text ?? '');
        blocks.push({ type: 'list-item', ordered, depth, text });
        for (const nested of nestedLists) appendListItems(nested.items ?? [], Boolean(nested.ordered), depth + 1);
      }
    };

    while ((match = formulaPattern.exec(source))) {
      appendTokens(marked.lexer(source.slice(cursor, match.index)));
      const formula = match[1].trim();
      if (formula) blocks.push({ type: 'formula', text: formula, display: true });
      cursor = match.index + match[0].length;
    }
    appendTokens(marked.lexer(source.slice(cursor)));

    return { title, blocks };
  }
}

function tokenText(token: MarkedToken): string {
  if (token.tokens) return token.tokens.map(tokenText).join('');
  return inlineText(token.text ?? token.raw ?? token.alt ?? '');
}

function inlineText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\\([\\`*_[\]{}()#+.!\-])/g, '$1');
}
