# PDF regression fixtures

`academic-textual-realworld.pdf` is a deterministic, synthetic, privacy-safe
regression fixture created after reproducing P3's production upload failure
with a privately supplied anonymized manuscript.

- Fixture SHA-256: `b4758380555f8c8e79db34cc90ed79d9a714db795c60fb155dc0b45180267c29`
- Fixture size: `634609` bytes
- Pages: `23`
- Text: selectable synthetic English text only
- License: repository test fixture; generated for this project
- Privacy: contains no manuscript prose, names, references, credentials, user
  identifiers, or source-document metadata

The private source was 648,809 bytes, 23 pages, unencrypted, and contained
selectable text. It parsed successfully in the source checkout and in the
compiled server on Node 22. The same production dependency-pruning path omitted
the dynamically loaded `pdfjs-dist` package, so an isolated release could not
resolve `pdfjs-dist/package.json`; `PdfParser` mapped that exception to
`PARSER_FAILED`, and `DocumentInputService` exposed the sanitized
`INVALID_DOCUMENT_UPLOAD` response. The synthetic fixture preserves the
relevant size/page/selectable-text characteristics without redistributing the
private manuscript.
