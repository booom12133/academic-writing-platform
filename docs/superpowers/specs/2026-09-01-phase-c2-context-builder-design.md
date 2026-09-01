# Phase C2 — Context Builder Design

## Status

Approved for implementation after review in the working conversation.

## Goal

Convert one validated C1 `ParsedDocument`, a narrow academic task type, and optional user instructions into a deterministic, provenance-aware `TaskContext` without selecting, rewriting, truncating, rendering, or sending document content to an external service.

## Scope and boundaries

Phase C2 owns the complete semantic representation of one parsed document. It does not decide how much context a later consumer uses. Chunking, token budgets, relevance filtering, retrieval, prompt rendering, file upload, task submission, production AI integration, OCR, storage, external APIs, and multi-document orchestration remain out of scope for C2.

The module is independent and must not be imported by `AppModule`, `AiToolsModule`, or `TasksModule`. It may import C1 document-parser types, but it must not modify the C1 parser or any frozen production module.

The implementation must introduce zero new dependencies and must not make LLM, DeepSeek, network, upload, database, or filesystem calls.

## Module structure

Create only the focused files required by the module:

```text
server/modules/context-builder/
├─ context-builder.types.ts
├─ context-builder.errors.ts
├─ context-builder.service.ts
├─ context-builder.service.spec.ts
└─ context-builder.module.ts
```

`ContextBuilderService` is the exported provider. `ContextBuilderModule` provides and exports that service while remaining unregistered from the application module graph.

## Input contract

The module owns a narrow task type rather than depending on the full production `TaskType` union:

```ts
export type ContextTaskType = 'polish' | 'paper-revision';

export interface BuildTaskContextInput {
  taskType: ContextTaskType;
  document: ParsedDocument;
  userInstructions?: string;
}
```

Runtime validation is required even though TypeScript declares the task type. Invalid task values, a missing document, an empty block array, invalid reference bounds, and malformed block/index relationships must fail explicitly with a C2 error.

## Output contract

```ts
export interface TaskContext {
  version: 1;
  task: {
    type: ContextTaskType;
    userInstructions?: string;
  };
  source: ContextDocumentSource;
  units: ContextUnit[];
}

export interface ContextDocumentSource {
  id: 'document-1';
  kind: 'parsed-document';
  fileName: string;
  sourceType: DocumentSourceType;
  extension: DocumentSource['extension'];
  mimeType?: string;
  sizeBytes: number;
  title?: string;
  metadata: DocumentMetadata;
  warnings: DocumentParseWarning[];
}

export interface ContextUnit {
  id: string;
  sourceId: 'document-1';
  sourceBlockId: string;
  sourceBlockIndex: number;
  section: 'content' | 'references';
  headingPath: ContextHeadingRef[];
  block: DocumentBlock;
}

export interface ContextHeadingRef {
  sourceBlockId: string;
  title: string;
  level: HeadingBlock['level'];
}
```

The exact implementation may use compatible aliases, but the observable fields and their semantics must remain as specified. Source metadata and warnings are preserved, and a page number already present on a C1 block remains present on the unit's `block`.

## Deterministic transformation

`ContextBuilderService.build(input)` performs a pure transformation in this order:

1. Validate the runtime input and the C1 document invariants needed by C2.
2. Build a new `ContextDocumentSource` with the fixed source ID `document-1`, copying C1 source information, title, metadata, and warnings.
3. Iterate over `document.blocks` exactly once in source order.
4. For block index `i`, create exactly one unit with ID `document-1:b${String(i + 1).padStart(6, '0')}` and set `sourceBlockId` to the block's C1 ID and `sourceBlockIndex` to `i`.
5. Preserve the original block type and fields in the unit. Do not flatten, merge, split, rewrite, summarize, filter, or reorder it.
6. Derive `section` solely from the optional C1 `referenceSection` range. An index in `[startBlockIndex, endBlockIndexExclusive)` is `references`; every other valid index is `content`. C2 must not re-detect reference headings by keywords.
7. Derive `headingPath` solely from preceding C1 heading blocks and their levels. A heading at level `L` replaces the current heading at level `L` and all deeper levels; lower-level headings remain as ancestors. The heading block itself receives the path including itself. Non-heading blocks receive the current path. No text is promoted to a heading.
8. Store `userInstructions` only under `task.userInstructions`. It must never be concatenated with `plainText` or copied into a unit block.

The service must not mutate the input document or its nested blocks. It must not use random IDs, timestamps, process state, environment values, or external calls.

## Error model

Define a small C2-specific error class and error codes, at minimum:

```text
INVALID_CONTEXT_INPUT
INVALID_PARSED_DOCUMENT
```

The error should identify malformed C2 input without duplicating C1 file-parser errors. C2 must fail explicitly rather than silently repair, ignore, fall back to `plainText`, or fabricate structure.

## Security and evidence boundary

Document text is evidence data. A source block containing instruction-like text such as “Ignore previous instructions” must be preserved as ordinary block data and cannot alter task type, user instructions, heading logic, reference mapping, or control flow. The builder has no execution or LLM path, so such text must trigger no additional behavior.

The task instruction domain and source evidence domain are separate fields in the returned object. This separation is a contract for later revision validation and must be tested directly.

## Verification requirements

The test suite must use small in-memory `ParsedDocument` fixtures rather than invoking C1 parsers. It must cover:

- basic `ParsedDocument` to `TaskContext` construction;
- repeat-call deep equality;
- one-to-one block count, IDs, indexes, order, and original block shapes;
- deterministic unit IDs;
- heading stack push, replace, and pop behavior across H1/H2/H3 sequences;
- C1 reference-section mapping and the no-reference-section case;
- paragraph, list, table, code, formula, and page-provenance preservation;
- metadata and warning propagation;
- independent user instructions and source content;
- instruction-like source content treated only as data;
- input immutability;
- invalid task, missing/empty document, invalid reference bounds, and malformed block relationships;
- preservation of all blocks without chunking or truncation.

After implementation, run the C2 targeted test, `npm test -- --runInBand`, `npm run lint`, `npm run type:check`, `npm run build:server`, and `npm run build:client`. Do not run DeepSeek smoke tests. Before commit, audit the diff against `origin/main` and confirm frozen files remain unchanged.

## Git and review boundary

Work belongs on `phase/c2-context-builder`, based on the latest available `origin/main`. The implementation must be committed and pushed as a review candidate, with a PR created but not merged. The branch must not receive a C2 accepted tag and the phase must not be marked accepted by the implementer.
