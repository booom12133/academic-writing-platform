import { MarkdownBlockParser } from './markdown-block-parser';

describe('MarkdownBlockParser', () => {
  const parser = new MarkdownBlockParser();

  it('maps the supported list and pipe-table subset deterministically', () => {
    expect(parser.parse(`Intro with $E=mc^2$.

- first
* second

1. one
2. two

| A | B |
|---|:---:|
| x | y |
| z |`)).toEqual([
      { kind: 'paragraph', text: 'Intro with $E=mc^2$.' },
      { kind: 'unordered-list', items: ['first', 'second'] },
      { kind: 'ordered-list', items: ['one', 'two'] },
      { kind: 'table', rows: [['A', 'B'], ['x', 'y'], ['z', '']] },
    ]);
  });

  it('preserves unsupported Markdown as inert text', () => {
    expect(parser.parse('<script>alert(1)</script>\n![remote](https://example.test/x.png)')).toEqual([
      { kind: 'paragraph', text: '<script>alert(1)</script>' },
      { kind: 'paragraph', text: '![remote](https://example.test/x.png)' },
    ]);
  });
});
