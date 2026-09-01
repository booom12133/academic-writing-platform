# Phase C3 — Chunking Implementation Plan

> **For agentic workers:** Use TDD. Every production change requires a failing test first. Do not merge the PR before explicit Phase acceptance.

**Goal:** Build an isolated C3 service that partitions C2 `TaskContext` into bounded, lossless, deterministic chunks.

**Architecture:** Add only `server/modules/chunking/**`. The service validates a C2 context, applies fixed code-point/zero-overlap semantics, greedily packs source units, and returns a self-describing applied policy. It remains unregistered in the application graph.

**Tech Stack:** TypeScript, NestJS `@nestjs/common`, Jest/ts-jest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-02-phase-c3-chunking-design.md`

## Global constraints

- Production changes are limited to `server/modules/chunking/**`.
- Governance changes may include this plan, the C3 design, and `PROJECT_STATE.md` at Review Candidate.
- `TextFragmentChunkItem` must not contain a complete `ContextUnit` or original block text.
- Output policy is `{ version: 1, maxSize, sizeMetric: 'unicode-code-points', overlap: 0 }`.
- Input policy contains only `{ maxSize }`.
- Atomic blocks are heading/table/code/formula; only paragraph/list-item may fragment.
- References are inherited from C2 `unit.section`; no keyword re-detection.
- No tokenizer, LLM, DeepSeek, filesystem, network, database, upload, retrieval, or production integration.

## Files

Create:

```text
server/modules/chunking/chunking.types.ts
server/modules/chunking/chunking.errors.ts
server/modules/chunking/chunking.service.ts
server/modules/chunking/chunking.module.ts
server/modules/chunking/chunking.service.spec.ts
```

Do not modify C1/C2, application, frontend, shared, task, AI, or database files.

## Public contracts

```ts
interface ChunkTaskContextInput {
  context: TaskContext;
  policy: { maxSize: number };
}

interface AppliedChunkingPolicy {
  version: 1;
  maxSize: number;
  sizeMetric: 'unicode-code-points';
  overlap: 0;
}

interface WholeUnitChunkItem {
  kind: 'whole-unit';
  unit: ContextUnit;
  size: number;
}

interface TextFragmentChunkItem {
  kind: 'text-fragment';
  sourceUnitId: string;
  sourceBlockId: string;
  sourceBlockIndex: number;
  section: 'content' | 'references';
  headingPath: ContextHeadingRef[];
  pageNumber?: number;
  blockType: 'paragraph' | 'list-item';
  fragmentId: string;
  text: string;
  span: { start: number; endExclusive: number };
  size: number;
  ordered?: boolean;
  depth?: number;
}

interface Chunk {
  id: string;
  sourceId: 'document-1';
  section: 'content' | 'references';
  items: ChunkItem[];
  size: number;
}

interface ChunkedTaskContext {
  version: 1;
  task: TaskContext['task'];
  source: TaskContext['source'];
  policy: AppliedChunkingPolicy;
  chunks: Chunk[];
  warnings: ChunkingWarning[];
}
```

`ChunkingService.chunk(input)` is the only public service operation.

## Task 1: Contracts, errors, module shell, and RED test

**Files:** create the five C3 files listed above.

- Add the type and error contracts first.
- Add `chunking.service.spec.ts` with the first behavior tests: malformed wrapper, malformed context, malformed policy, and one valid one-unit context.
- Run `npx jest server/modules/chunking/chunking.service.spec.ts --runInBand`; confirm failure is caused by the missing service behavior, not a fixture typo.
- Add the minimal `ChunkingService` and independent `ChunkingModule` shell.
- Run the same targeted test and keep the shell green before adding behavior.
- Commit as `test(c3): define chunking contract` and `feat(c3): add isolated chunking module`.

## Task 2: Validation and defensive copying

**Files:** modify `chunking.service.ts` and `chunking.service.spec.ts`.

Write failing tests for:

- non-object wrapper → `INVALID_CHUNKING_INPUT`;
- malformed C2 version/task/source/unit/block → `INVALID_TASK_CONTEXT`;
- zero, negative, fractional, `NaN`, `Infinity`, or unsafe `maxSize` → `INVALID_CHUNKING_POLICY`;
- copied task/source/metadata/warnings and unchanged input after a call;
- invalid table rows/cells and invalid list metadata.

Implement only the validators and clone helpers needed by these tests. Validate C2 shapes locally without changing `context-builder`. Clone table rows/cells, heading paths, source metadata, warnings, task, and source envelopes. Run targeted tests after each RED/GREEN cycle.

Commit as `feat(c3): validate contexts and preserve immutability`.

## Task 3: Whole-unit packing and applied policy

**Files:** modify `chunking.service.ts` and `chunking.service.spec.ts`.

Write failing tests for:

- one normal unit → one whole-unit item;
- several small units packed in exact source order;
- chunk size equals item sizes;
- emoji and other surrogate-pair characters count as one code point;
- output policy exactly includes `version`, `maxSize`, `sizeMetric`, and `overlap`;
- repeated identical calls produce deeply equal chunks, IDs, sizes, and warnings.

Implement code-point measurement with `Array.from(text).length`, greedy append/flush, deterministic six-digit chunk IDs, and the applied policy copy. Do not add overlap or caller-selectable metric fields.

Commit as `feat(c3): add deterministic whole-unit packing`.

## Task 4: Atomic blocks and reference boundaries

**Files:** modify `chunking.service.ts` and `chunking.service.spec.ts`.

Write failing tests for:

- heading/table/code/formula remain whole-unit items;
- oversized atomic blocks become standalone chunks without truncation or splitting;
- every oversized atomic block emits `OVERSIZED_ATOMIC_UNIT`;
- content/references transitions flush the current chunk;
- no chunk mixes sections;
- whole-unit provenance preserves page number, heading path, table rows/cells, list metadata, code language, and formula display.

Implement atomic classification, standalone oversized handling, section flush, and warning generation. Use the existing C2 section field only; do not re-detect references.

Commit as `feat(c3): preserve atomic units and section boundaries`.

## Task 5: Fragment item shape and lossless text fragmentation

**Files:** modify `chunking.service.ts` and `chunking.service.spec.ts`.

Write failing tests for:

- oversized paragraph produces fragments without a `unit` property and without complete original `block.text`;
- fragments contain required source IDs, section, heading path, page number, block type, text, span, size, and list metadata;
- paragraph splitting prefers newline, sentence punctuation, whitespace, then hard code-point boundaries;
- fragment spans are contiguous and concatenate exactly to the original text;
- emoji/CJK/surrogate pairs are never split;
- oversized list-item preserves `ordered` and `depth`;
- hard boundaries emit `HARD_TEXT_SPLIT`, natural boundaries do not;
- fragments from one source unit remain adjacent.

Implement a code-point-array splitter. Each selected span is `[start, endExclusive)`, preserves every character, and creates a fragment ID based on the source unit ID plus a six-digit per-unit ordinal. Copy only fragment provenance; never attach a full `ContextUnit` to a fragment. Pack fragments greedily into available capacity while preserving their order.

Commit as `feat(c3): add lossless bounded text fragments`.

## Task 6: Heading soft boundary and final security tests

**Files:** modify `chunking.service.ts` and `chunking.service.spec.ts`.

Write failing tests for:

- a heading can share a chunk with preceding content when it fits;
- when heading plus the next small same-section unit fits an empty chunk but not the current chunk, the heading moves to the next chunk;
- headings do not always force a new chunk;
- oversized headings still use atomic handling;
- instruction-like source text remains data;
- `userInstructions` appears only in the task envelope;
- mutating returned whole units, fragments, heading paths, tables, or warnings never mutates input or another item.

Implement the one-unit lookahead soft preference only when it preserves the stated fit conditions. Do not recalculate heading paths. Finish defensive-copy and evidence-boundary tests.

Commit as `test(c3): lock down heading and security boundaries`.

## Task 7: Full verification and Review Candidate preparation

Run:

```text
npx jest server/modules/chunking/chunking.service.spec.ts --runInBand
npm test -- --runInBand
npm run lint
npm run type:check
npm run build:server
npm run build:client
```

Record the actual results and any inherited Linux/Windows `platform-command`
failure. Do not repair that issue.

Update `PROJECT_STATE.md` only after implementation and verification, recording:

- current development phase `Phase C3 — Chunking`;
- branch `phase/c3-chunking`;
- Review Candidate commit;
- targeted/full test results;
- lint/type-check/build results;
- known inherited issue;
- next state as awaiting ChatGPT GitHub Review, not accepted.

Run the frozen-file audit:

```text
git diff --name-only origin/main...HEAD
```

Allowed paths are the five C3 files, the C3 design, the C3 plan, and the
Review-Candidate `PROJECT_STATE.md` update. Any frozen production path is a
blocking scope violation.

Commit governance closeout as `docs(c3): record review candidate state`.

## Git and PR handoff

Before push, verify:

```text
git status --short
git branch --show-current
git remote -v
git config --local --get http.version
```

Confirm branch `phase/c3-chunking`, origin is the project repository, and HTTP
version is `HTTP/1.1`. Push without force:

```text
git push -u origin phase/c3-chunking
```

Create a PR targeting `main` titled `Phase C3: Chunking`. The description must
include scope, tests, warnings, frozen-file audit, known inherited issue, and
the exact line `Do not merge before acceptance`.

Do not merge, tag, or claim `PHASE_C3_ACCEPTED`. Stop after PR creation and
report the branch, commits, PR number/URL, changed files, all verification
results, CI status, frozen-file audit, and known issues.
