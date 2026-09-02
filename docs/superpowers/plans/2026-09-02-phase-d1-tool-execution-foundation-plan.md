# Phase D1 — Tool Execution Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested preparation and deterministic execution foundation between C4/C1–C3 and the existing academic tool generator boundary without migrating Polish or Paper Revision production flows.

**Architecture:** Keep C1, C2, and C3 unchanged. Add an execution package that delegates file preparation to `DocumentInputService.prepare()`, prepares pasted text through the existing parser/context/chunker modules, renders chunks deterministically with content/reference separation and C2/C3 provenance, and exposes a sequential executor contract that future tool adapters can implement. Add a preparation-before-billing service contract that performs no task creation, point deduction, or LLM call.

**Tech Stack:** NestJS 10, TypeScript 5.9, Jest 29, Drizzle-backed existing modules, C1/C2/C3 services, existing B1 Skill Runtime.

**Spec:** User-authorized Phase D1 requirements in the current task; governance constraints in `AGENTS.md`, `CODEX_WORKFLOW.md`, and the accepted C4 report.

## Global Constraints

- Work only on branch `phase/d1-tool-execution-foundation` from accepted main `1a48d768c03de0c1ccedcb42e7774ae6c92fdf0b`.
- Do not migrate Polish or Paper Revision production flows.
- Do not modify C1, C2, C3 contracts, database schema, shared API contracts, LlmService, DeepSeekProvider, or the existing `setTimeout` task architecture.
- Do not add parallel chunk execution, queues, RAG, Zotero, search, OCR, multi-document support, or a new model provider.
- File preparation must delegate to `DocumentInputService.prepare()`.
- Reference chunks are exact pass-through and must never reach the executor.
- Provenance is copied from C2/C3 metadata; executor output cannot supply or override it.
- `userInstructions` must remain in `ChunkedTaskContext.task.userInstructions` and be forwarded from that trusted context.
- All new behavior is implemented test-first with a failing test observed before production code.

---

### Task 1: Establish the D1 execution package contracts

**Files:**
- Create: `server/modules/ai-tools/execution/tool-execution.types.ts`
- Test: `server/modules/ai-tools/execution/tool-execution.types.spec.ts`

**Interfaces:**
- Produces `ToolPreparationInput`, `PreparedToolInput`, `ToolChunkProvenance`, `RenderedToolChunk`, `ToolChunkExecutor`, `ToolChunkExecutionResult`, and `AcademicToolExecutionResult` for later tasks.

- [ ] **Step 1: Write the failing type/runtime contract test**

Add tests that construct a minimal valid C3 context and assert the required result shapes can represent content and reference chunks, provenance, warnings, validation, and aggregated usage without accepting executor-supplied provenance.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/tool-execution.types.spec.ts`

Expected: FAIL because the D1 execution types do not exist.

- [ ] **Step 3: Add the minimal type contracts**

Define the contracts as TypeScript interfaces and discriminated unions. `RenderedToolChunk` must include `chunkId`, `section`, `eligibleForExecution`, deterministic `text`, ordered rendered items, and C2/C3 provenance. `ToolChunkExecutionResult` may contain output, warnings, validation, and usage, but no provenance field. `AcademicToolExecutionResult` must contain ordered chunk records, exact pass-through reference records, aggregated warnings, aggregated validation, and summed usage.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/tool-execution.types.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract-only change**

Run:

```text
git add server/modules/ai-tools/execution/tool-execution.types.ts server/modules/ai-tools/execution/tool-execution.types.spec.ts
git commit -m "feat(d1): define tool execution contracts"
```

### Task 2: Fix Nest DI construction for SkillLoader and InvariantValidator

**Files:**
- Modify: `server/modules/ai-tools/skills/skill.loader.ts`
- Modify: `server/modules/ai-tools/skills/skill.composer.spec.ts`
- Modify: `server/modules/ai-tools/skills/skill.loader.spec.ts`
- Modify: `server/modules/ai-tools/skills/validators/invariant.validator.ts`
- Create: `server/modules/ai-tools/skills/skills-root.token.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`
- Test: `server/modules/ai-tools/ai-tools.module.spec.ts`

**Interfaces:**
- `SKILLS_ROOT` is an explicit Nest injection token.
- `SkillLoader` continues to support `new SkillLoader(customRoot)` in unit tests while Nest receives the default root through the token.
- `InvariantValidator` continues to support `new InvariantValidator()` while Nest receives `InvariantExtractor` explicitly.

- [ ] **Step 1: Write the failing bootstrap test**

Add a Nest testing module that imports `AiToolsModule` with a mocked `TasksService` dependency boundary and asserts the module compiles without an `Object` dependency. Add an assertion that `Reflect.getMetadata('design:paramtypes', SkillLoader)` is no longer the source of the injected root dependency. Add an `InvariantValidator` construction assertion through the module provider.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npm test -- --runInBand server/modules/ai-tools/ai-tools.module.spec.ts`

Expected: FAIL with the inherited Nest dependency-resolution error involving `Object`.

- [ ] **Step 3: Implement the minimal explicit injection repair**

Use `SKILLS_ROOT` with a provider whose factory resolves `server/modules/ai-tools/skills` from `process.cwd()`. Keep the loader path validation, cache, and file format behavior unchanged. Inject `InvariantExtractor` explicitly and retain a direct-construction fallback only for existing unit-test construction.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --runInBand server/modules/ai-tools/ai-tools.module.spec.ts server/modules/ai-tools/skills/skill.loader.spec.ts server/modules/ai-tools/skills/validators/invariant.validator.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit the DI repair**

Run:

```text
git add server/modules/ai-tools/skills/skill.loader.ts server/modules/ai-tools/skills/skill.composer.spec.ts server/modules/ai-tools/skills/skill.loader.spec.ts server/modules/ai-tools/skills/validators/invariant.validator.ts server/modules/ai-tools/skills/skills-root.token.ts server/modules/ai-tools/ai-tools.module.ts server/modules/ai-tools/ai-tools.module.spec.ts
git commit -m "fix(d1): make skill runtime Nest injectable"
```

### Task 3: Add text and file preparation foundation

**Files:**
- Create: `server/modules/ai-tools/execution/tool-input-preparation.service.ts`
- Test: `server/modules/ai-tools/execution/tool-input-preparation.service.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`

**Interfaces:**
- `ToolInputPreparationService.prepare(input: ToolPreparationInput): Promise<PreparedToolInput>`.
- Text mode creates a synthetic validated `.txt` buffer and executes `DocumentParserService.parse()` → `ContextBuilderService.build()` → `ChunkingService.chunk()`.
- File mode delegates exactly to `DocumentInputService.prepare()` and returns its `context` without reimplementing storage, ownership, hash, or parsing checks.

- [ ] **Step 1: Write failing preparation tests**

Cover: text input produces a valid version-1 `ChunkedTaskContext`; text `userInstructions` survives in `context.task.userInstructions`; file input calls `DocumentInputService.prepare()` with the trusted request fields; and a rejected file preparation error propagates before any task/points/executor dependency is touched.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/tool-input-preparation.service.spec.ts`

Expected: FAIL because the preparation service does not exist.

- [ ] **Step 3: Implement minimal preparation delegation**

Inject the existing parser, context builder, chunker, and `DocumentInputService`. For text, use `Buffer.from(text, 'utf8')`, the fixed safe filename `pasted-text.txt`, MIME `text/plain`, the requested task type, user instructions, and chunking policy. For file, call `documentInputService.prepare()` unchanged.

- [ ] **Step 4: Wire only the foundation providers/modules**

Import `DocumentInputModule`, `DocumentParsingModule`, `ContextBuilderModule`, and `ChunkingModule` into `AiToolsModule`; register and export the preparation service. Do not alter any existing controller or production tool submit behavior.

- [ ] **Step 5: Run focused tests and verify green**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/tool-input-preparation.service.spec.ts server/modules/document-input/document-input.service.spec.ts server/modules/document-parsing/document-parser.service.spec.ts server/modules/context-builder/context-builder.service.spec.ts server/modules/chunking/chunking.service.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit the preparation foundation**

Run:

```text
git add server/modules/ai-tools/execution/tool-input-preparation.service.ts server/modules/ai-tools/execution/tool-input-preparation.service.spec.ts server/modules/ai-tools/ai-tools.module.ts
git commit -m "feat(d1): add unified text and file preparation"
```

### Task 4: Implement deterministic chunk rendering and sequential execution aggregation

**Files:**
- Create: `server/modules/ai-tools/execution/academic-tool-execution.service.ts`
- Test: `server/modules/ai-tools/execution/academic-tool-execution.service.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`

**Interfaces:**
- `AcademicToolExecutionService.render(context: ChunkedTaskContext): RenderedToolChunk[]`.
- `AcademicToolExecutionService.execute(input: { context: ChunkedTaskContext; executor: ToolChunkExecutor; options?: Record<string, unknown> }): Promise<AcademicToolExecutionResult>`.
- Execution is sequential in C3 chunk order. Reference chunks are returned as pass-through records and never passed to the executor.

- [ ] **Step 1: Write failing rendering tests**

Cover deterministic output across repeated calls, preservation of content/reference order, exact handling of whole-unit and text-fragment items, and complete provenance copied from the source item including optional heading path and page number.

- [ ] **Step 2: Run rendering tests and verify failure**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/academic-tool-execution.service.spec.ts -t rendering`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement deterministic rendering**

Render ordered item text into a stable line-delimited string. Derive provenance only from each `WholeUnitChunkItem.unit` or `TextFragmentChunkItem`; do not copy provenance from any later executor output. Mark `content` eligible and `references` ineligible.

- [ ] **Step 4: Write failing execution and aggregation tests**

Cover sequential executor calls for content chunks only, zero executor calls for references, forwarding `context.task.userInstructions`, preservation of options, ordered result records, warning aggregation, validation aggregation, usage summation, and rejection when an executor fails.

- [ ] **Step 5: Run the execution tests and verify failure**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/academic-tool-execution.service.spec.ts -t execution`

Expected: FAIL because execution and aggregation are not implemented.

- [ ] **Step 6: Implement the minimal sequential executor loop**

Iterate over rendered chunks in input order. Skip the executor for references and emit exact pass-through records. Call the executor for eligible content chunks with the trusted context task type, `context.task.userInstructions`, rendered chunk, and options. Aggregate warnings and numeric usage in order. Attach source-derived provenance to each record and ignore any executor-provided provenance field.

- [ ] **Step 7: Register the service without changing production flow**

Register `AcademicToolExecutionService` in `AiToolsModule`, but do not inject it into `AiToolsService`, controllers, generators, or existing task processing.

- [ ] **Step 8: Run focused tests and verify green**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/academic-tool-execution.service.spec.ts`

Expected: PASS.

- [ ] **Step 9: Commit the execution foundation**

Run:

```text
git add server/modules/ai-tools/execution/academic-tool-execution.service.ts server/modules/ai-tools/execution/academic-tool-execution.service.spec.ts server/modules/ai-tools/ai-tools.module.ts
git commit -m "feat(d1): add deterministic academic tool execution foundation"
```

### Task 5: Add preparation-before-billing safety contract

**Files:**
- Create: `server/modules/ai-tools/execution/tool-submission-preparation.service.ts`
- Test: `server/modules/ai-tools/execution/tool-submission-preparation.service.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`

**Interfaces:**
- `ToolSubmissionPreparationService.prepareBeforeBilling(input): Promise<PreparedToolInput>`.
- The service has only preparation dependencies and does not inject `TasksService`, `PointsService`, `LlmService`, or `DeepSeekProvider`.

- [ ] **Step 1: Write failing safety tests**

Cover invalid, tampered, and foreign file references: preparation rejects; task creation, point deduction, and executor spies are not called. Cover valid text/file preparation returning a prepared input that can be handed to a later submit flow.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --runInBand server/modules/ai-tools/execution/tool-submission-preparation.service.spec.ts`

Expected: FAIL because the safety service does not exist.

- [ ] **Step 3: Implement preparation-only orchestration**

Delegate to `ToolInputPreparationService`, validate that the task type is one of the C2/C3-supported academic tools, and return the prepared context plus source descriptor when applicable. Do not create or update a Task, calculate points, call an executor, or call an LLM.

- [ ] **Step 4: Register and test the service**

Register it in `AiToolsModule` and run the focused test. Expected: PASS.

- [ ] **Step 5: Commit the safety contract**

Run:

```text
git add server/modules/ai-tools/execution/tool-submission-preparation.service.ts server/modules/ai-tools/execution/tool-submission-preparation.service.spec.ts server/modules/ai-tools/ai-tools.module.ts
git commit -m "feat(d1): enforce preparation before billing boundary"
```

### Task 6: Prove full module bootstrap and finalize D1 verification state

**Files:**
- Create: `server/app.module.spec.ts`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- The AppModule test boots the local-development configuration without external platform or DeepSeek calls.

- [ ] **Step 1: Write the failing full bootstrap test**

Set local-development environment before importing `AppModule`, compile the real `AppModule`, and assert that `AiToolsModule` and its execution providers resolve. Use the repository local-development database/storage configuration and no external network.

- [ ] **Step 2: Run the bootstrap test and verify failure or inherited blocker**

Run: `npm test -- --runInBand server/app.module.spec.ts`

Expected before the DI repair: FAIL with the inherited `Object` dependency; after Task 2 it must PASS.

- [ ] **Step 3: Run all required verification commands**

Run:

```text
npm test -- --runInBand
npm run lint
npm run type:check
npm run build:server
npm run build:client
```

Expected: all commands exit 0. Existing non-blocking ts-jest, module-type, chunk-size, and inherited CI fixture warnings remain documented and unchanged.

- [ ] **Step 4: Audit scope and frozen paths**

Run:

```text
git diff --name-only 1a48d768c03de0c1ccedcb42e7774ae6c92fdf0b..HEAD
git status --short
```

Confirm no C1/C2/C3, database schema, shared API, LlmService, DeepSeekProvider, generator, frontend tool, or task-flow migration files changed.

- [ ] **Step 5: Update project state for review candidate**

Record Phase D1 as implementation in progress/review candidate, the candidate commit, changed files, fresh test/build evidence, the resolved DI status, and inherited out-of-scope issues. Do not mark D1 accepted.

- [ ] **Step 6: Commit state and final D1 evidence**

Run:

```text
git add server/app.module.spec.ts PROJECT_STATE.md
git commit -m "docs(d1): record tool execution foundation review candidate"
```

- [ ] **Step 7: Push the Phase branch and create the PR**

Before pushing, verify `git status --short`, current branch, `git remote -v`, and local `http.version=HTTP/1.1`. Push only `phase/d1-tool-execution-foundation` and create a PR targeting `main` whose body includes `Do not merge before acceptance`.

- [ ] **Step 8: Stop for ChatGPT review**

Report branch, final commit SHA, PR number/link, changed files, verification evidence, D1 criterion mapping, and inherited issues. Explicitly state `READY_FOR_CHATGPT_D1_REVIEW`; do not merge, tag, or enter D2.
