# Phase D3 Paper Revision Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Paper Revision text and prepared-file submissions onto the frozen C1 → C2 → C3 → D1 pipeline while preserving the legacy Task and result contracts.

**Architecture:** Add a Paper Revision-owned normalizer, D1 chunk executor, deterministic aggregator, and async submission service. Delegate Paper Revision before generic Task creation; use existing `TasksService.createTask()` after preparation so the server keeps the fixed 30-point price. Keep the existing generator, shared contracts, D1 services, document preparation, and all non-Paper-Revision routes unchanged.

**Tech Stack:** NestJS, TypeScript, React, Jest, existing C1/C2/C3 document pipeline, existing D1 `ToolChunkExecutor`, and the existing `Task` persistence service.

**Spec:** `docs/superpowers/specs/2026-09-03-phase-d3-paper-revision-migration-design.md`

## Global Constraints

- `PAPER_REVISION_CHUNKING_POLICY.maxSize` is exactly `2000` Unicode code points and is server-owned.
- Paper Revision billing is the existing fixed `30` points through `TasksService.createTask()`; do not add dynamic pricing or modify `TasksService`.
- `inputData.requirements` is the only global instruction and maps to `ToolPreparationInput.userInstructions`; never copy it into `options`.
- `inputMode` is optional for legacy text callers; omitted mode plus nonblank text and no file source normalizes as text.
- `revisionTypes` is an optional open `string[]`; `undefined` and `[]` are valid, and provided values preserve order without frontend whitelisting.
- The frontend keeps `revisionTypes.length > 0` as a submission gate for both text and prepared-file modes.
- References are D1 pass-through with zero executor, generator, and LLM calls.
- `PaperRevisionGenerator` remains a frozen one-text-to-one-output adapter.
- Invalid input, invalid file references, and no executable content fail before Task creation, points deduction, or LLM calls.
- D1 execution is sequential and stop-first-error; completed partial results are forbidden.
- Automated tests must make zero real DeepSeek calls.
- Frozen paths include C1/C2/C3/C4, D1, Polish, shared contracts, schema, TasksService, generator, LLM, skills, other tools, historical reports, and the inherited platform-command fixture.
- `KNOWN_GOVERNANCE_DEBT` records stale `ROADMAP.md`; D3 does not edit it.

## File map

Create:

- `server/modules/ai-tools/paper-revision/paper-revision-input.types.ts` — submission and normalized option types.
- `server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.ts` — server-owned policy and untrusted input normalization.
- `server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.spec.ts` — input, policy, optional revision type, and forged-field tests.
- `server/modules/ai-tools/paper-revision/paper-revision-source-boundary.ts` — trusted source-segment conversion and deterministic joins.
- `server/modules/ai-tools/paper-revision/paper-revision-source-boundary.spec.ts` — exact source boundary tests.
- `server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.ts` — D1-to-frozen-generator adapter.
- `server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.spec.ts` — executor mapping and rejection tests.
- `server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.ts` — legacy result reconstruction and validation mapping.
- `server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts` — exact boundary and field aggregation tests.
- `server/modules/ai-tools/paper-revision/paper-revision-submission.service.ts` — preparation, preflight, fixed-price Task creation, and async lifecycle.
- `server/modules/ai-tools/paper-revision/paper-revision-submission.service.spec.ts` — lifecycle and side-effect boundary tests.
- `test/unit/paper-revision-migration-client.spec.ts` — client payload and file-submit behavior.

Modify minimally:

- `server/modules/ai-tools/ai-tools.service.ts` — delegate `paper-revision` before generic Task creation.
- `server/modules/ai-tools/ai-tools.module.ts` — register Paper Revision-owned providers.
- `server/modules/ai-tools/ai-tools.service.spec.ts` — specialized delegation and generic-route regression.
- `client/src/api/ai-tools.ts` — add a typed Paper Revision submit helper.
- `client/src/pages/Tools/tools/PaperRevisionTool.tsx` — submit text or prepared `DocumentInputRef`, require file readiness, and display 30 points.
- `PROJECT_STATE.md` — Review-Candidate-only governance modification after implementation verification.

Do not modify:

- `server/modules/ai-tools/generators/paper-revision.generator.ts`
- `server/modules/tasks/**`
- `shared/**`
- `server/modules/document-parsing/**`
- `server/modules/context-builder/**`
- `server/modules/chunking/**`
- `server/modules/document-input/**`
- `server/modules/ai-tools/execution/**`
- `server/modules/ai-tools/polish/**`
- `server/modules/ai-tools/llm/**`
- `server/modules/ai-tools/skills/**`

## Exact interfaces

The new types file defines:

```ts
export const PAPER_REVISION_CHUNKING_POLICY = { maxSize: 2000 } as const;

export interface PaperRevisionSubmissionInputData {
  inputMode?: 'text' | 'file';
  text?: string;
  documentRef?: DocumentInputRef;
  revisionTypes?: string[];
  requirements?: string;
  language?: 'zh' | 'en';
  fileName?: string;
  wordCount?: number;
  pointsCost?: number;
}

export interface PaperRevisionChunkOptions extends Record<string, unknown> {
  revisionTypes?: string[];
  language?: 'zh' | 'en';
}

export interface NormalizedPaperRevisionSubmission {
  preparation: ToolPreparationInput;
  options: PaperRevisionChunkOptions;
}
```

The submission service exposes:

```ts
submit(request: {
  userId: string;
  title?: string;
  inputData: PaperRevisionSubmissionInputData;
}): Promise<Task>
```

The aggregator exposes:

```ts
aggregate(execution: AcademicToolExecutionResult): PaperRevisionOutput
```

## Task 0: Start D3 Phase Branch and land the docs-only baseline

**Files:**

- Create on the D3 Phase branch: `docs/superpowers/specs/2026-09-03-phase-d3-paper-revision-migration-design.md`
- Create on the D3 Phase branch: `docs/superpowers/plans/2026-09-03-phase-d3-paper-revision-migration-plan.md`

**Interfaces:**

- Consumes: accepted `main` and accepted tag `phase-d2-accepted`.
- Produces: branch `phase/d3-paper-revision-migration` with a docs-only commit; no production implementation may start before this commit.

- [ ] **Step 1: Verify the accepted baseline**

Run:

```text
git ls-remote origin refs/heads/main
git ls-remote --tags origin "refs/tags/phase-d2-accepted*"
```

Expected:

```text
main = 31a7002babed73bc325841c5622a2f2e03f38bc4
phase-d2-accepted = 010a45058f239ad245474ce172b0e712537e248e
phase-d2-accepted^{} = 31a7002babed73bc325841c5622a2f2e03f38bc4
```

- [ ] **Step 2: Create the Phase branch from accepted main**

Run only after Step 1 passes:

```text
git checkout main
git pull --ff-only origin main
git checkout -b phase/d3-paper-revision-migration
git rev-parse HEAD
```

Expected final output:

```text
31a7002babed73bc325841c5622a2f2e03f38bc4
```

- [ ] **Step 3: Verify the docs-only working tree**

Confirm that the two uncommitted D3 documents are the only intended changes:

```text
git status --short
```

- [ ] **Step 4: Commit only the Design Spec and Plan**

```text
git add docs/superpowers/specs/2026-09-03-phase-d3-paper-revision-migration-design.md docs/superpowers/plans/2026-09-03-phase-d3-paper-revision-migration-plan.md
git commit -m "docs(d3): add paper revision migration design and plan"
```

Expected: the commit contains only those two documentation files. Task 1 may
start only after this commit exists on `phase/d3-paper-revision-migration`.

## Task 1: Lock normalized input and server-owned policy

**Files:**

- Create: `server/modules/ai-tools/paper-revision/paper-revision-input.types.ts`
- Create: `server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.ts`
- Test: `server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.spec.ts`

**Interfaces:**

- Consumes: raw `PaperRevisionSubmissionInputData` and `userId`.
- Produces: `NormalizedPaperRevisionSubmission` with `ToolPreparationInput` and options containing only `revisionTypes` and `language`.

- [ ] **Step 1: Write the failing tests**

Test these behaviors against `normalizePaperRevisionSubmission()`:

```ts
it('maps text requirements to preparation userInstructions and applies maxSize 2000', () => {
  const result = normalizePaperRevisionSubmission({
    userId: 'user-1',
    inputData: {
      inputMode: 'text',
      text: '  source text  ',
      requirements: '  preserve citations  ',
      revisionTypes: [],
      wordCount: 1,
      pointsCost: 1,
    },
  });

  expect(result.preparation).toEqual({
    userId: 'user-1',
    taskType: 'paper-revision',
    userInstructions: 'preserve citations',
    chunkingPolicy: { maxSize: 2000 },
    source: { mode: 'text', text: '  source text  ' },
  });
  expect(result.options).toEqual({ revisionTypes: [] });
});

it('allows undefined and empty revisionTypes', () => {
  expect(normalizePaperRevisionSubmission({
    userId: 'user-1',
    inputData: { inputMode: 'text', text: 'source' },
  }).options).toEqual({});
  expect(normalizePaperRevisionSubmission({
    userId: 'user-1',
    inputData: { inputMode: 'text', text: 'source', revisionTypes: [] },
  }).options).toEqual({ revisionTypes: [] });
});

it('preserves a legacy text caller that omits inputMode', () => {
  const result = normalizePaperRevisionSubmission({
    userId: 'user-1',
    inputData: { text: 'source', requirements: 'revise' },
  });

  expect(result.preparation.taskType).toBe('paper-revision');
  expect(result.preparation.source).toEqual({ mode: 'text', text: 'source' });
  expect(result.preparation.userInstructions).toBe('revise');
});

it('preserves open revision type strings and their order', () => {
  const result = normalizePaperRevisionSubmission({
    userId: 'user-1',
    inputData: {
      inputMode: 'text',
      text: 'source',
      revisionTypes: ['logic', 'discussion'],
    },
  });

  expect(result.options.revisionTypes).toEqual(['logic', 'discussion']);
});
```

Add individual tests for missing text, ambiguous omitted-mode sources,
malformed file references, invalid language, non-string revision type entries,
and a client `chunkingPolicy` field. Assert that the latter cannot change the
returned `{ maxSize: 2000 }` policy and that frontend enum values are not used
as a server whitelist.

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.spec.ts
```

Expected: FAIL because the normalizer and policy do not exist.

- [ ] **Step 3: Implement the minimal normalizer**

Implement optional-mode text inference, explicit file-mode validation,
one-time requirements trimming, open-string-array revisionTypes validation,
language validation, structured DocumentInputRef shape validation, and constant
`{ maxSize: 2000 }`. Ignore `wordCount`, `pointsCost`, and client policy values.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Extract only local validation helpers if duplication is present; rerun the
focused test and keep the public interfaces unchanged.

- [ ] **Step 6: Commit the focused change**

```text
git add server/modules/ai-tools/paper-revision/paper-revision-input.types.ts server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.ts server/modules/ai-tools/paper-revision/paper-revision-input.normalizer.spec.ts
git commit -m "feat(d3): lock paper revision input contract"
```

## Task 2: Add trusted source boundaries

**Files:**

- Create: `server/modules/ai-tools/paper-revision/paper-revision-source-boundary.ts`
- Test: `server/modules/ai-tools/paper-revision/paper-revision-source-boundary.spec.ts`

**Interfaces:**

- Consumes: D1 `RenderedToolChunk[]`.
- Produces: trusted text segments and deterministic joined text using source provenance.

- [ ] **Step 1: Write the failing tests**

Cover same-block concatenation, distinct content blocks, content-to-Reference,
and distinct Reference blocks. Include the required three-content-chunk case:

```ts
expect(joinTrustedSegments(segments)).toBe('A1\n\nB1B2\n\nC\n\nRef A\nRef B');
```

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision/paper-revision-source-boundary.spec.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal trusted join**

Represent each segment with `section`, `firstSourceBlockId`,
`lastSourceBlockId`, and `text`. Derive segments only from rendered item
provenance. Apply exactly `""`, `"\n\n"`, and `"\n"` rules from the Spec.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Keep the helper independent of Polish and do not change D1. Rerun the focused
test after any local cleanup.

- [ ] **Step 6: Commit the focused change**

```text
git add server/modules/ai-tools/paper-revision/paper-revision-source-boundary.ts server/modules/ai-tools/paper-revision/paper-revision-source-boundary.spec.ts
git commit -m "feat(d3): add trusted paper revision boundaries"
```

## Task 3: Adapt D1 chunks to the frozen Paper Revision generator

**Files:**

- Create: `server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.ts`
- Test: `server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.spec.ts`

**Interfaces:**

- Consumes: `ToolChunkExecutionInput` and frozen `PaperRevisionGenerator`.
- Produces: `ToolChunkExecutionResult` with legacy Paper Revision fields, warnings, validation, metadata, and usage.

- [ ] **Step 1: Write the failing tests**

Assert that an eligible content chunk calls the generator exactly once with
`text`, `requirements`, optional open-string `revisionTypes`, and optional
`language`. Use `revisionTypes: ['logic', 'discussion']` and assert the exact
array reaches `PaperRevisionGenerator.generate()` in the same order;
assert that requirements is not present in options; assert that a Reference or
ineligible chunk is rejected without calling the generator; assert generator
errors propagate.

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.spec.ts
```

Expected: FAIL because the executor does not exist.

- [ ] **Step 3: Implement the minimal adapter**

Call `PaperRevisionGenerator.generate()` with the exact mapping in the Spec.
Return `output` containing `originalContent`, `revisedContent`,
`changeSummary`, `unresolvedIssues`, `authorInputNeeded`, and `metadata`;
return generator warnings, validation, and usage at the D1 envelope level.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Keep file parsing, references, billing, persistence, and aggregation out of the
executor. Rerun the focused test.

- [ ] **Step 6: Commit the focused change**

```text
git add server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.ts server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.spec.ts
git commit -m "feat(d3): adapt paper revision chunks"
```

## Task 4: Aggregate the legacy Paper Revision result

**Files:**

- Create: `server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.ts`
- Test: `server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts`

**Interfaces:**

- Consumes: `AcademicToolExecutionResult`.
- Produces: `PaperRevisionOutput` with trusted reconstruction and legacy validation shape.

- [ ] **Step 1: Write the failing tests**

Cover:

```ts
it('reconstructs trusted original and revised content across source boundaries', () => {
  // chunk 1: block A + block B fragment 1
  // chunk 2: block B fragment 2
  // chunk 3: block C
  // then References
  expect(result.originalContent).toBe('A1\n\nB1B2\n\nC\n\nRef A\nRef B');
  expect(result.revisedContent).toBe('RA\n\nRB1RB2\n\nRC\n\nRef A\nRef B');
});
```

Also assert generator originals are ignored, summaries/issues flatten in order,
`authorInputNeeded` is OR, warnings are not duplicated, validation violations
flatten, and metadata/usage aggregate correctly.

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts
```

Expected: FAIL because the aggregator does not exist.

- [ ] **Step 3: Implement the minimal aggregator**

Use trusted rendered chunks for original and pass-through content. Use each
executed output's revised text as a segment with trusted first/last provenance.
Use exactly `execution.warnings`, flatten validation violations in order, OR
`authorInputNeeded`, concatenate summaries/issues, sum latency, and use D1
usage. Reject malformed chunk output before returning a result.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Keep aggregation side-effect free and do not add provenance to the public
legacy result. Rerun the focused test.

- [ ] **Step 6: Commit the focused change**

```text
git add server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.ts server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts
git commit -m "feat(d3): aggregate paper revision results"
```

## Task 5: Orchestrate preparation, billing, and async execution

**Files:**

- Create: `server/modules/ai-tools/paper-revision/paper-revision-submission.service.ts`
- Test: `server/modules/ai-tools/paper-revision/paper-revision-submission.service.spec.ts`

**Interfaces:**

- Consumes: normalizer, `ToolSubmissionPreparationService`, `AcademicToolExecutionService`, executor, aggregator, and existing `TasksService`.
- Produces: `Promise<Task>` that returns a processing Task before execution completes and later persists completed or failed status.

- [ ] **Step 1: Write the failing tests**

Cover these exact behaviors:

1. Preparation receives `maxSize = 2000` for text and file mode.
2. `TasksService.createTask()` is called only after preparation and executable-content preflight.
3. Task type is `paper-revision`, so existing server billing returns 30.
4. Client `wordCount` and `pointsCost` do not affect the service decision.
5. Processing Task is returned before deferred D1 execution resolves.
6. Processing update failure prevents scheduling.
7. Invalid/foreign/tampered refs and References-only contexts invoke no Task, points, executor, generator, or LLM side effect.
8. First execution error marks failed, skips later chunks and aggregator, and never writes completed partial data.

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision/paper-revision-submission.service.spec.ts
```

Expected: FAIL because the submission service does not exist.

- [ ] **Step 3: Implement the minimal orchestration**

Normalize first. Call `prepareBeforeBilling()`. Render the prepared context and
require at least one eligible content chunk. Call existing
`TasksService.createTask()` with the original task input only after the gate.
Update to `processing` with progress 10; if that returns null, throw and do not
schedule. Schedule a zero-delay async callback. In the callback, call D1
execute, aggregate, and update completed; catch errors and update failed without
`resultData`.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Keep the service Paper Revision-specific. Do not modify TasksService, D1,
DocumentInputService, or the generator. Rerun focused tests.

- [ ] **Step 6: Commit the focused change**

```text
git add server/modules/ai-tools/paper-revision/paper-revision-submission.service.ts server/modules/ai-tools/paper-revision/paper-revision-submission.service.spec.ts
git commit -m "feat(d3): orchestrate paper revision submission"
```

## Task 6: Wire the Paper Revision route without changing other tools

**Files:**

- Modify: `server/modules/ai-tools/ai-tools.service.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`
- Modify: `server/modules/ai-tools/ai-tools.service.spec.ts`

**Interfaces:**

- Consumes: `PaperRevisionSubmissionService.submit()`.
- Produces: early delegation for `paper-revision`; all other task types retain generic behavior.

- [ ] **Step 1: Write the failing tests**

Add a test that submits `paper-revision` and asserts the specialized service is
called before `TasksService.createTask()`. Add a separate assertion that an
`outline` submission still uses the generic path.

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/ai-tools.service.spec.ts
```

Expected: FAIL because Paper Revision still enters the generic path.

- [ ] **Step 3: Implement minimal delegation and provider wiring**

Inject and register `PaperRevisionSubmissionService`. Add one early branch in
`submitTask()` before generic Task creation. Remove only the now-unreachable
Paper Revision case from the generic switch; leave all other cases unchanged.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Review the diff to confirm no changes to D1, Polish, TasksService, generator,
or other routes. Rerun the focused test.

- [ ] **Step 6: Commit the focused change**

```text
git add server/modules/ai-tools/ai-tools.service.ts server/modules/ai-tools/ai-tools.module.ts server/modules/ai-tools/ai-tools.service.spec.ts
git commit -m "feat(d3): cut over paper revision route"
```

## Task 7: Enable typed text/file submission in the frontend

**Files:**

- Modify: `client/src/api/ai-tools.ts`
- Modify: `client/src/pages/Tools/tools/PaperRevisionTool.tsx`
- Test: `test/unit/paper-revision-migration-client.spec.ts`

**Interfaces:**

- Consumes: text input or uploaded `DocumentInputRef`.
- Produces: `/api/ai-tools/submit` payload containing text or structured file ref, revision types, requirements, and optional word count; no client price or policy.

- [ ] **Step 1: Write the failing client tests**

Assert:

```ts
it('submits text with requirements and optional revisionTypes', async () => {
  // Mock the backend request and assert taskType, inputMode, text, requirements.
  // Assert no pointsCost or chunkingPolicy is sent as an authoritative field.
});

it('submits only a prepared DocumentInputRef in file mode', async () => {
  // Select/upload a file, then assert the submit payload has documentRef and
  // no raw File bytes or string path.
});

it('keeps the UI submit gate when no revision type is selected', async () => {
  // Assert text mode and prepared-file mode are both disabled when the
  // revisionTypes array is empty, even though the typed helper accepts it.
});
```

Also assert the UI estimate is 30 points, no file submit occurs before a
successful document upload, and the typed helper/direct server contract accepts
omitted and empty revisionTypes.

- [ ] **Step 2: Run the focused test to verify RED**

```text
npm test -- --runInBand test/unit/paper-revision-migration-client.spec.ts
```

Expected: FAIL because no typed Paper Revision helper and file submit action
exist.

- [ ] **Step 3: Implement the minimal frontend cutover**

Add a typed `submitPaperRevisionTask()` helper with text/ref validation and
optional revisionTypes. Update the component so text requires nonblank text and
`revisionTypes.length > 0`, file requires a prepared ref and
`revisionTypes.length > 0`, file submit uses the ref, and the displayed price
is 30. Keep upload behavior, reselection clearing, and existing TaskDetail
navigation intact.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Refactor only after green**

Keep the helper separate from Polish and do not change shared interfaces. Rerun
focused client tests.

- [ ] **Step 6: Commit the focused change**

```text
git add client/src/api/ai-tools.ts client/src/pages/Tools/tools/PaperRevisionTool.tsx test/unit/paper-revision-migration-client.spec.ts
git commit -m "feat(d3): submit paper revision text and files"
```

## Task 8: Add module-level safety and compatibility regression coverage

**Files:**

- Modify: `server/modules/ai-tools/ai-tools.service.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.spec.ts` only for D3 provider resolution assertions
- Test: all D3-owned Paper Revision specs from Tasks 1–7

**Interfaces:**

- Consumes: all D3-owned services through their public contracts.
- Produces: evidence that Paper Revision is isolated and non-Paper-Revision routes remain unchanged.

- [ ] **Step 1: Write failing regression assertions**

Add tests for zero Reference execution, no duplicated warnings, legacy result
fields, optional revision types, exact 30-point flow, and unchanged generic
outline dispatch. Include the read-only configuration assertion:

```ts
expect(
  TOOL_CONFIGS.find(tool => tool.type === 'paper-revision')?.basePoints
).toBe(30);
```

- [ ] **Step 2: Run the focused D3 suite to verify RED**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision server/modules/ai-tools/ai-tools.service.spec.ts server/modules/ai-tools/ai-tools.module.spec.ts test/unit/paper-revision-migration-client.spec.ts
```

Expected: FAIL until all integration contracts are wired and covered.

- [ ] **Step 3: Implement only missing test-facing wiring**

Complete the smallest in-scope production or test-fixture changes required by
the approved contracts. Do not weaken assertions and do not add real provider
calls.

- [ ] **Step 4: Run the focused D3 suite to verify GREEN**

Run the same command. Expected: PASS with zero external DeepSeek calls.

- [ ] **Step 5: Commit the focused regression coverage**

```text
git add server/modules/ai-tools/ai-tools.service.spec.ts server/modules/ai-tools/ai-tools.module.spec.ts server/modules/ai-tools/paper-revision test/unit/paper-revision-migration-client.spec.ts
git commit -m "test(d3): cover paper revision migration invariants"
```

## Task 9: Run required verification and prepare Review Candidate evidence

**Files:**

- Modify: `PROJECT_STATE.md` only after all implementation verification passes,
  as a Review-Candidate-only governance modification; production files are not
  modified by this step unless an in-scope verification defect is found.

**Interfaces:**

- Consumes: complete D3 implementation on the authorized Phase branch.
- Produces: reproducible verification evidence; no merge or acceptance decision.

- [ ] **Step 1: Run focused D3 tests**

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision server/modules/ai-tools/ai-tools.service.spec.ts server/modules/ai-tools/ai-tools.module.spec.ts test/unit/paper-revision-migration-client.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full regression**

```text
npm test -- --runInBand
```

Expected: PASS. The inherited `test/unit/platform-command.spec.ts` Linux
fixture issue remains unchanged and is recorded as inherited/out of scope.

- [ ] **Step 3: Run lint, type-check, and builds**

```text
npm run lint
npm run type:check
npm run build:server
npm run build:client
```

Expected: PASS with only the already accepted non-blocking warnings.

- [ ] **Step 4: Run AppModule bootstrap**

```text
npm run test:app-bootstrap
```

Expected: PASS; no DeepSeek call is made.

- [ ] **Step 5: Verify scope and external boundary**

```text
git status --short
git diff --name-only 31a7002babed73bc325841c5622a2f2e03f38bc4...HEAD
git grep -n "DEEPSEEK_API_KEY\|api.deepseek.com" -- server/modules/ai-tools/paper-revision test/unit/paper-revision-migration-client.spec.ts
```

Expected: only authorized D3 files are changed, and automated tests contain no
real provider invocation.

- [ ] **Step 6: Record Review Candidate evidence**

On the D3 Phase branch only, perform the following after all checks pass:

1. Record `git rev-parse HEAD` as the **D3 Implementation Candidate SHA**.
   This is the SHA of the last D3 implementation/test commit, before the
   project-state update.
2. Update `PROJECT_STATE.md` with the stable D2 baseline and Review Candidate
   state, preserving the exact accepted-main SHA:

   ```text
   Stable Phase:
   Phase D2 — ACCEPTED / FROZEN / CLOSED
   Stable main:
   31a7002babed73bc325841c5622a2f2e03f38bc4
   Current Development:
   Phase D3 — REVIEW_CANDIDATE
   D3 Implementation Candidate SHA: [the SHA recorded in step 1]
   D3 accepted:
   NO
   D3 merged:
   NO
   ```

3. The bracketed notation above is an execution instruction, not a value to
   commit; replace that field with the actual recorded SHA before saving the
   state file. Review `git diff -- PROJECT_STATE.md`, then commit only the
   state change with `chore(d3): mark paper revision review candidate`.
4. Record the resulting `git rev-parse HEAD` as the **Review Candidate HEAD**.
   It is distinct from the D3 Implementation Candidate SHA and is the final
   Review Candidate commit.

Return both SHAs and the complete verification results to the ChatGPT
reviewer. Do not update `ROADMAP.md`, merge `main`, create an accepted tag, or
declare `PHASE_D3_ACCEPTED`.
