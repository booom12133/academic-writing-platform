import { Injectable } from '@nestjs/common';

import type { InvariantToken, InvariantType } from './invariant.types';

interface MatchSpan extends InvariantToken {
  start: number;
  end: number;
}

@Injectable()
export class InvariantExtractor {
  extract(text: string): InvariantToken[] {
    const spans: MatchSpan[] = [];
    const addMatches = (pattern: RegExp, type: InvariantType, normalize = normalizeValue) => {
      for (const match of text.matchAll(pattern)) {
        const value = normalize(match[0]);
        spans.push({ type, value, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
      }
    };

    addMatches(/\bp\s*(?:=|<|>|≤|≥)\s*\d+(?:\.\d+)?/gi, 'p-value');
    addMatches(/[-+]?\d+(?:\.\d+)?\s*%/g, 'percentage');
    addMatches(/\[(?:\d+(?:\s*[,;\-]\s*\d+)*)\]/g, 'citation');
    addMatches(/\b10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/gi, 'doi', (value) => normalizeValue(value).replace(/[.,;:!?]+$/, ''));
    addMatches(/\b(?:Figure|Fig\.?|Table)\s+\d+(?:\.\d+)?/gi, 'figure/table');
    addMatches(/(?<![A-Za-z])[-+]?\d+(?:\.\d+)?\s*(?:mg|g|kg|mL|L|cm|mm|μm|nm|s|min|h|Hz|kHz|MB|GB|°C|dB)\b/gi, 'unit');
    addMatches(/\$[^$\n]+\$|\\[A-Za-z]+(?:\{[^\n{}]*\})+/g, 'formula');

    for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9_-]*\b/g)) {
      const value = match[0];
      if (!isTechnicalIdentifier(value)) continue;
      const start = match.index ?? 0;
      if (spans.some((span) => start < span.end && start + value.length > span.start)) continue;
      spans.push({ type: 'technical-identifier', value, start, end: start + value.length });
    }

    for (const match of text.matchAll(/[-+]?\d+(?:\.\d+)?/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (spans.some((span) => start >= span.start && end <= span.end)) continue;
      spans.push({ type: 'number', value: normalizeValue(match[0]), start, end });
    }

    return spans
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map(({ type, value }) => ({ type, value }));
  }
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isTechnicalIdentifier(value: string): boolean {
  if (/^(?:DOI|Fig|Figure|Table)$/i.test(value)) return false;
  if (value.includes('-')) {
    return value.split('-').some((segment) =>
      /^[A-Z]{2,}$/.test(segment) || /\d/.test(segment) || /[a-z][A-Z]/.test(segment),
    );
  }
  return value.includes('_') || /\d/.test(value) || /[a-z][A-Z]/.test(value) || /^[A-Z]{2,}$/.test(value) || /^[A-Z]{2,}[a-z]+$/.test(value);
}
