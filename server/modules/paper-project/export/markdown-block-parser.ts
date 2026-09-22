export type ParsedMarkdownBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'unordered-list'; items: string[] }
  | { kind: 'ordered-list'; items: string[] }
  | { kind: 'table'; rows: string[][] };

export class MarkdownBlockParser {
  parse(value: string): ParsedMarkdownBlock[] {
    const lines = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
    const result: ParsedMarkdownBlock[] = [];
    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/u);
      if (unordered) {
        const items: string[] = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*[-*+]\s+(.+)$/u);
          if (!match) break;
          items.push(match[1].trim()); index += 1;
        }
        result.push({ kind: 'unordered-list', items }); continue;
      }
      const ordered = line.match(/^\s*\d+\.\s+(.+)$/u);
      if (ordered) {
        const items: string[] = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*\d+\.\s+(.+)$/u);
          if (!match) break;
          items.push(match[1].trim()); index += 1;
        }
        result.push({ kind: 'ordered-list', items }); continue;
      }
      const tableRow = this.tableRow(line);
      if (tableRow) {
        const rows: string[][] = [];
        while (index < lines.length) {
          const row = this.tableRow(lines[index]);
          if (!row) break;
          rows.push(row); index += 1;
        }
        const withoutSeparator = rows.filter((row, rowIndex) => rowIndex !== 1 || !row.every((cell) => /^:?-{3,}:?$/u.test(cell)));
        const width = Math.max(...withoutSeparator.map((row) => row.length));
        result.push({ kind: 'table', rows: withoutSeparator.map((row) => [...row, ...Array<string>(width - row.length).fill('')]) });
        continue;
      }
      result.push({ kind: 'paragraph', text: line }); index += 1;
    }
    return result;
  }

  private tableRow(line: string): string[] | null {
    if (!line.includes('|')) return null;
    const source = line.trim();
    const trimmed = source.replace(/^\|/u, '').replace(/\|$/u, '');
    const cells = trimmed.split('|').map((cell) => cell.trim());
    return cells.length >= 2 || /^\|.*\|$/u.test(source) ? cells : null;
  }
}
