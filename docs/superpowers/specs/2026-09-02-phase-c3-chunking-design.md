# Phase C3 — Chunking Design

## Status

`PHASE_C3_PLAN_APPROVED_WITH_MANDATORY_AMENDMENTS`

This design is implemented only on `phase/c3-chunking`. It does not authorize
changes to the frozen C1/C2 production contracts or production integration.

## Goal

Convert one C2 `TaskContext` and an explicit `ChunkingPolicy` into a
deterministic, lossless, model-agnostic `ChunkedTaskContext`.

## Scope and boundaries

C3 owns source-order structural partitioning only. It does not own selection,
retrieval, prompt packing, model token budgets, execution windows, or result
merging.

Production scope is limited to `server/modules/chunking/**`. Governance
artifacts may include this design, the implementation plan, and the
Review-Candidate update to `PROJECT_STATE.md`.

The following remain frozen and must not change:

```text
client/**
server/modules/document-parsing/**
server/modules/context-builder/**
server/modules/ai-tools/**
server/modules/tasks/**
server/database/schema.ts
shared/api.interface.ts
server/app.module.ts
```

No filesystem, network, database, upload, shell, code execution, OCR,
retrieval, LLM, DeepSeek, tokenizer, or external service operation is allowed.

## Applied policy

The input remains deliberately small:

```ts
interface ChunkingPolicyInput {
  maxSize: number;
}
```

The output is self-describing and records the frozen semantics:

```ts
interface AppliedChunkingPolicy {
  version: 1;
  maxSize: number;
  sizeMetric: 'unicode-code-points';
  overlap: 0;
}
```

The caller cannot override `sizeMetric` or `overlap`.

## Size semantics

Size is the number of Unicode code points in `block.text`, measured without
normalization, trimming, rewriting, or synthetic rendering. The implementation
uses code-point arrays so surrogate pairs such as emoji count as one unit and
cannot be split in the middle.

Whole-unit size is the code-point length of the complete block text. Fragment
size is its code-point span length. Table rows/cells and other metadata remain
losslessly preserved in whole-unit items but are not re-rendered for sizing.

## Output model

`ChunkedTaskContext` copies the C2 task and source envelopes, stores the applied
policy, and contains ordered chunks plus C3 warnings.

`WholeUnitChunkItem` contains one defensive-copied complete `ContextUnit`.

`TextFragmentChunkItem` deliberately does **not** contain a `ContextUnit` or
the complete original block text. It contains only:

- `sourceUnitId`
- `sourceBlockId`
- `sourceBlockIndex`
- `section`
- `headingPath`
- optional `pageNumber`
- `blockType` (`paragraph` or `list-item`)
- `fragmentId`
- fragment `text`
- Unicode code-point `span`
- `size`
- list `ordered` and `depth` when the source block is a list item

The fragment provenance is independently copied. This prevents repeated full
paragraph text from inflating the bounded representation.

## Partition algorithm

Units are visited exactly once in C2 source order. A chunk contains one section
only. A section transition flushes the current chunk before the new unit.

Heading, table, code, and formula blocks are atomic. If an atomic block is too
large, it becomes the sole item of an oversized chunk and produces
`OVERSIZED_ATOMIC_UNIT`; it is never truncated or structurally split.

Paragraphs and list items remain whole when they fit. Only an oversized one is
fragmented. Fragment boundaries prefer, in order, newline, sentence terminal
punctuation, whitespace, and finally a hard code-point boundary. All boundary
characters remain in the fragment, and concatenating fragments reproduces the
original text exactly.

Packing is greedy. A normal unit is appended when it fits the current chunk;
otherwise the current chunk is flushed. A heading may use a preferred boundary
before itself when keeping it with the next small same-section unit would
otherwise leave the heading at the end of the current chunk. This is a soft
preference, not a rule that every heading starts a chunk.

Overlap is always zero. Fragments from one unit remain adjacent and cannot be
interleaved with another unit.

## Determinism and IDs

Chunk IDs are `document-1:c000001`, `document-1:c000002`, and so on.
Fragment IDs are `<sourceUnitId>:f000001`, incremented within each source unit.
No random, timestamp, UUID, environment-derived, or external value is used.

## Validation and warnings

The independent C3 error model is:

```text
INVALID_CHUNKING_INPUT
INVALID_TASK_CONTEXT
INVALID_CHUNKING_POLICY
```

Malformed input fails closed. Warnings are deterministic and use:

```text
OVERSIZED_ATOMIC_UNIT
HARD_TEXT_SPLIT
```

## Immutability and evidence boundary

The service defensively copies output envelopes, whole units, heading paths,
tables, metadata, and warnings. It never mutates the input context. Fragments
carry only their own copied provenance and text span. `userInstructions` stays
inside the copied task envelope and is never copied into evidence or fragment
text. Instruction-like source text is ordinary data.

## Verification gate

The C3 branch must pass the targeted test, full regression, lint,
server/client type-check, server build, and client build. The final changed-file
audit must allow C3 production files plus the governance artifacts listed above
and must reject every frozen production path.
