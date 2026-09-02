# Phase D2 Polish Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Polish 生产提交路径迁移到 D1 的可信文档准备、顺序分块执行、聚合与安全计费边界，同时保持既有 API、Task 外层契约和非 Polish 工具行为不变。

**Architecture:** `/api/ai-tools/submit` 的 Polish 分支先通过 `ToolSubmissionPreparationService` 完成文本/文件准备，再以 D1 生成的 canonical prepared input 计算服务端权威费用并创建 Task。异步执行由 `PolishSubmissionService` 编排：内容块顺序调用 `PolishChunkExecutor` 和现有 `PolishGenerator`，References 仅由 D1 记录原样传递，最后由 `PolishResultAggregator` 一次性生成旧 Task 结果并持久化；其他工具继续使用现有 `AiToolsService` 路径。

**Tech Stack:** NestJS, TypeScript, Jest, Drizzle ORM, React, existing D1 `AcademicToolExecutionService`, C4 `DocumentInputService`, existing `PolishGenerator`/`LlmService` seam, npm scripts.

**Spec:** User-approved Phase D2 Polish migration design in the current task request; repository baseline and governance constraints are recorded in `PROJECT_STATE.md`, `ROADMAP.md`, `CODEX_WORKFLOW.md`, and `docs/reviews/PHASE_D1_FINAL_ACCEPTANCE_REPORT.md`.

## Global Constraints

- Accepted baseline is `main` `ad7cf2fdff3183abf24ded65e7b85256a0149770`, tagged by annotated tag `phase-d1-accepted`; do not rewrite it.
- Phase D2 is planned only; implementation requires a separate explicit `PHASE_D2` authorization and must use one new D2 branch, never direct development on `main`.
- This plan does not authorize implementation, branch creation, commit, push, merge, tag, D3 work, or changes to D1 business behavior.
- The public Polish submission endpoint remains `POST /api/ai-tools/submit`; the outer response remains the existing `Task` shape and existing top-level result fields remain readable by `TaskDetailPage`.
- Client `wordCount`, `pointsCost`, file bytes, and any client-supplied prepared text are untrusted. Client values may remain display estimates only.
- Authoritative billing input is the server-prepared D1 representation. Preserve the current Polish price formula `Math.max(10, Math.ceil(charCount / 500) * 10)` and its JavaScript UTF-16 code-unit metric (`String.length`); do not redesign prices, membership discounts, or token billing.
- The authoritative billing text is the deterministic D1 prepared source in source order, including References in the billed source so the migration does not silently stop charging for text that the existing raw-input server path charged; References still never enter the Polish LLM.
- Polish preparation always supplies a server-owned `ChunkingPolicy` with the required `{ maxSize }` shape. Text and file inputs use the same policy, and no client field can select or override it.
- `POLISH_CHUNK_MAX_SIZE = 2000 Unicode code points` — this is the formal ChatGPT Plan Review decision. It is server-owned, static, shared by text/file preparation, and not client-controlled.
- Preparation must complete before any Task row, points deduction, processing state, background execution, or LLM call. Any preparation failure has none of those side effects.
- Content execution is sequential and source ordered. The first executor/generator failure stops the run; no partial result is persisted as completed.
- `originalContent` is reconstructed from trusted prepared/D1 chunk records in source order plus untouched References. A chunk LLM response's `originalContent` is only a consistency signal and never the global source of truth.
- `PolishGenerator` remains one text to one output. It does not gain file parsing, chunking, billing, aggregation, Task persistence, or References handling.
- Preserve C1/C2/C3/C4 D1/D2 boundaries: document parsing, context building, chunking, document-input storage, database schema, shared API contracts, `LlmService`, `DeepSeekProvider`, B1 Skill Runtime/project skills, Paper Revision, other AI tools, and inherited `test/unit/platform-command.spec.ts` are frozen.
- Do not claim byte-level file-layout restoration. Acceptance claims are limited to the frozen C1/C2/C3 guarantees: exact prepared block/item content and References content, source order, deterministic boundaries, provenance, and no References LLM execution.
- Do not call real DeepSeek in automated tests. Mock the existing `PolishGenerator`/`LlmService` seam and assert call order and call count.
- Every implementation task follows RED → verify expected failure → GREEN → verify all relevant tests → REFACTOR while green. Commit each independently testable task with a focused commit.
- Before any future push, verify `origin` and repository-local `http.version`; use `HTTP/1.1`, never force-push.

## Planned File Map

Create only the following D2-owned files unless an implementation task proves that an existing file must be extended:

- `server/modules/ai-tools/polish/polish-input.types.ts` — internal trusted request, prepared billing, and result-boundary types; no shared API change.
- `server/modules/ai-tools/polish/polish-input.normalizer.ts` — validates the two supported Polish submission modes and maps request data to D1 preparation input.
- `server/modules/ai-tools/polish/polish-input.normalizer.spec.ts` — request-mode, ownership-reference, and untrusted-client-field tests.
- `server/modules/ai-tools/polish/polish-billing.service.ts` — derives canonical prepared billing text and the unchanged UTF-16/500 formula from trusted prepared records.
- `server/modules/ai-tools/polish/polish-billing.service.spec.ts` — billing authority, formula, Unicode metric, and References billing tests.
- `server/modules/ai-tools/polish/polish-chunk.executor.ts` — adapts one eligible D1 content chunk to one existing `PolishGenerator.generate` call; it has no References pass-through branch.
- `server/modules/ai-tools/polish/polish-chunk.executor.spec.ts` — one-call content mapping, defensive rejection of non-content/non-eligible direct calls, and output sanitization tests.
- `server/modules/ai-tools/polish/polish-result.aggregator.ts` — deterministic source reconstruction and one final legacy-compatible Polish result.
- `server/modules/ai-tools/polish/polish-result.aggregator.spec.ts` — source order, forged-generator-original protection, References pass-through, boundary, warning, validation, usage, and no-partial-result tests.
- `server/modules/ai-tools/polish/polish-submission.service.ts` — prepare-before-billing, Task lifecycle, sequential execution, first-error stop, and final persistence orchestration.
- `server/modules/ai-tools/polish/polish-submission.service.spec.ts` — side-effect ordering and asynchronous lifecycle tests.
- `test/unit/polish-migration-client.spec.ts` — client request-shape regression tests using the existing Jest `test/unit/**/*.spec.ts` harness; test the extracted API request helper directly so no browser runner or component-rendering dependency is introduced.

Modify only these files for production cutover and the minimal prepared-billing seam:

- `server/modules/ai-tools/ai-tools.service.ts` — dispatch only `polish` to `PolishSubmissionService`; leave all other tool branches and their observable behavior unchanged; remove the second reachable Polish production path.
- `server/modules/ai-tools/ai-tools.module.ts` — register the new Polish services and dependencies.
- `server/modules/tasks/tasks.service.ts` — add a narrowly scoped prepared-Polish creation method that recalculates cost from trusted prepared billing text inside the existing transaction; do not alter generic legacy task creation semantics.
- `server/modules/tasks/tasks.service.spec.ts` — regression tests for the prepared-Polish method and rejection of client cost fields.
- `client/src/api/ai-tools.ts` — add only the internal typed request helper needed to send text or an uploaded `DocumentInputRef`; preserve the endpoint and Task response.
- `client/src/pages/Tools/tools/PolishTool.tsx` — enable submit after file upload, send the reference instead of raw file bytes/text, and keep the cost display explicitly estimated.

Do not modify these files in D2: `server/modules/document-parsing/**`, `server/modules/context-builder/**`, `server/modules/chunking/**`, `server/modules/document-input/**`, `server/database/schema.ts`, `shared/api.interface.ts`, `server/modules/ai-tools/llm/**`, B1 Skill Runtime/project skills, Paper Revision files, other AI-tool generators, `test/unit/platform-command.spec.ts`, `PROJECT_STATE.md`, `ROADMAP.md`, or the D1 Final Acceptance Report.

## Invariants and Interfaces Locked by This Plan

The following internal shapes are the contract between tasks. Names may be adjusted only if all consumers and tests are updated in the same task; semantics may not be weakened.

```ts
import type { DocumentInputRef } from '@shared/document-input.interface';

type PolishSubmissionRequest = {
  userId: string;
  title?: string;
  inputData: {
    inputMode: 'text' | 'file';
    text?: string;
    documentRef?: DocumentInputRef;
    fileName?: string;
    polishType?: string;
    language?: 'zh' | 'en';
    requirements?: string;
    wordCount?: number;
    pointsCost?: number;
  };
};

type PolishChunkOptions = {
  polishType?: string;
  language?: 'zh' | 'en';
};

type PolishChunkOutput = {
  originalContent: string;
  revisedContent: string;
  changes: { original: string; revised: string; reason: string }[];
  metadata: {
    provider: 'deepseek';
    model: string;
    latencyMs: number;
  };
};

type PreparedPolishBilling = {
  billingText: string;
  charCount: number; // billingText.length, UTF-16 code units
  pointsCost: number; // Math.max(10, Math.ceil(charCount / 500) * 10)
};

type PolishSubmissionService.submit = (
  request: PolishSubmissionRequest,
) => Promise<Task>;

type PolishChunkExecutor.execute = (
  input: ToolChunkExecutionInput,
) => Promise<ToolChunkExecutionResult>;

type PolishResultAggregator.aggregate = (
  execution: AcademicToolExecutionResult,
) => PolishOutput;
```

The actual D1 `PreparedToolInput` and `AcademicToolExecutionResult` types remain the source of truth for prepared context and ordered chunks. `DocumentInputRef` is imported from `@shared/document-input.interface`; no string reference alias or new document-reference contract is permitted. The plan does not introduce a new persistence snapshot or database table.

## Polish Chunking Policy Decision

The repository audit established the following constraints, and ChatGPT resolved the production value during Plan Review:

- `PolishGenerator` composes a system prompt and a user prompt containing requirements and the entire chunk source text, requests JSON mode, uses temperature `0.4`, and reserves `maxTokens: 4000` for the response.
- `DeepSeekProvider` forwards `max_tokens` and allows `DEEPSEEK_DEFAULT_MODEL` to vary; `.env.example` does not declare a context-window limit, tokenizer, input-token budget, or prompt-overhead budget.
- C3 measures `ChunkingPolicy.maxSize` in Unicode code points, preserves atomic units, and may report oversized atomic units; D2 must reuse these semantics and must not use the D1 test fixture `maxSize: 100` as a production default.
- Prompt overhead includes the composed skill system text, Polish type/language/requirements, JSON output instructions/schema, and per-chunk source text. The repository has no token estimator that can safely convert those costs to provider tokens.

`POLISH_CHUNK_MAX_SIZE = 2000 Unicode code points`

This fixed production policy leaves the implementation aligned with the current Polish prompt composition, `maxTokens: 4000`, C3 Unicode-code-point sizing, and the currently configured DeepSeek model. It is not the D1 test fixture `maxSize: 100`, is not dynamically calculated, and does not introduce a tokenizer/budget framework. The implementation must define one server-owned constant or factory in the D2 Polish layer, pass `{ maxSize: 2000 }` as `ToolPreparationInput.chunkingPolicy`, ignore any client policy field, and test that both text and file calls receive the exact same object/value. If a future production DeepSeek model has a materially smaller context window, that is a separate policy review and is outside D2.

## Polish Submission Timing Boundary

The observable API contract is intentionally two-stage:

**Synchronous submission path:** request validation → server-owned policy selection → D1 preparation → authoritative billing → Task creation and points deduction → Task update to `processing` → schedule/start the in-process asynchronous Polish processor → immediately return the processing `Task`.

**Asynchronous processing path:** `AcademicToolExecutionService.execute` → sequential eligible content execution through `PolishChunkExecutor` → D1-owned References pass-through → `PolishResultAggregator.aggregate` → persist one completed legacy-compatible result.

The HTTP `PolishSubmissionService.submit()` must not await DeepSeek calls, full chunk execution, or aggregation before returning. The minimal existing in-process `setTimeout`/deferred mechanism may be reused; do not introduce a queue, worker, BullMQ, Redis, or other execution infrastructure. After Task creation, the first error stops later chunks, marks the Task failed, and never persists a completed partial result.

## Polish Instruction, Option, and Output Mapping

`inputData.requirements` has exactly one semantic path: normalized `ToolPreparationInput.userInstructions` → C2/C3 trusted `context.task.userInstructions` → D1 `ToolChunkExecutionInput.userInstructions` → `PolishGenerator.generate({ requirements: userInstructions })`. The executor must not copy requirements into `options`.

`ToolChunkExecutionInput.options` contains only actual Polish options, for example `{ polishType, language }`. The executor maps a generator result into the internal D1 output as follows, without changing `PolishGenerator`:

```ts
{
  output: {
    originalContent,
    revisedContent,
    changes,
    metadata: { provider, model, latencyMs },
  },
  warnings,
  validation,
  usage,
}
```

The aggregator does not trust `output.originalContent` for global reconstruction; it uses trusted D1 source items/provenance for global `originalContent`, generator `revisedContent`/`changes` for revised output, `execution.usage` for aggregated usage, legacy-compatible provider/model/latency metadata from mapped chunk outputs, and D1 provenance only from the execution records.

## Aggregation Boundary Rules

The aggregator must decide boundaries from trusted D1 `itemId`, `sourceBlockId`, section, and provenance—not from model output:

- adjacent fragments belonging to the same `sourceBlockId` use no synthetic separator;
- adjacent content items from different source blocks use one deterministic normalized content boundary `\n\n`;
- the transition from content to References uses one deterministic normalized section boundary `\n\n`;
- adjacent Reference items from distinct reference source blocks use one deterministic reference boundary `\n`;
- References retain their trusted item text and source order, and never acquire model-generated revised text.

The same boundary helper must be used for trusted original reconstruction and the final revised sequence where a pass-through or chunk result is joined. Add a regression fixture with fragments split across chunks, including two fragments from one source block followed by a different content block and then two distinct Reference blocks, and assert the exact final string.

## Task 1: Lock the Polish request and prepared-input contract

**Files:**
- Create: `server/modules/ai-tools/polish/polish-input.types.ts`
- Create: `server/modules/ai-tools/polish/polish-input.normalizer.ts`
- Test: `server/modules/ai-tools/polish/polish-input.normalizer.spec.ts`

**Interfaces:**
- Consumes: existing controller `inputData`, `ToolPreparationInput`, and `ToolInputPreparationService` accepted `text`/`file` source forms.
- Produces: `PolishSubmissionRequest` with `userId: string` and `documentRef?: DocumentInputRef`, normalized D1 preparation input with `userInstructions` and the server-owned `ChunkingPolicy`, and explicit distinction between trusted prepared data and ignored client estimates.

- [ ] **Step 1: Write the failing tests**

  Cover one behavior per test:

  - text mode maps the submitted text and Polish options to D1 text preparation;
  - file mode accepts only a server-issued `DocumentInputRef` from `@shared/document-input.interface` and never maps a raw client file or string reference as execution input;
  - missing/blank text and missing file reference are rejected before preparation;
  - `wordCount` and `pointsCost` are not returned as trusted billing data;
  - `requirements` maps once to `ToolPreparationInput.userInstructions`, while `polishType` and `language` are retained as executor options;
  - both text and file modes receive the same server-owned `{ maxSize }` policy, and any client policy field is ignored;
  - unsupported `inputMode` and client-supplied cross-mode fields are rejected or ignored deterministically.

- [ ] **Step 2: Run the focused normalizer tests and verify RED**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish/polish-input.normalizer.spec.ts`

  Expected: failure because the internal normalizer and its contract do not yet exist; fix test setup errors until the failure is about the missing behavior.

- [ ] **Step 3: Implement the smallest normalizer and types**

  Preserve the controller's public request shape, import and validate `DocumentInputRef` structurally, trim only fields whose existing semantics allow trimming, map `requirements` exactly once to `userInstructions`, pass only `polishType`/`language` as tool options, attach the resolved server-owned `ChunkingPolicy`, and return a D1 preparation request. Do not calculate points here, accept client policy/price fields, or add shared DTO/schema changes.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run the same command. Expected: all normalizer tests pass with no real document or LLM dependency.

- [ ] **Step 5: Refactor while green and commit**

  Keep the internal types dependency-light, then commit the independently testable contract as `test(d2): lock Polish submission contract`.

## Task 2: Derive authoritative prepared billing without changing price semantics

**Files:**
- Create: `server/modules/ai-tools/polish/polish-billing.service.ts`
- Test: `server/modules/ai-tools/polish/polish-billing.service.spec.ts`
- Modify: `server/modules/tasks/tasks.service.ts`
- Test: `server/modules/tasks/tasks.service.spec.ts`

**Interfaces:**
- Consumes: trusted `PreparedToolInput`/D1 ordered rendered chunks from Task 1 and the existing TasksService transaction.
- Produces: `PreparedPolishBilling` and `TasksService.createPreparedPolishTask({ userId: string, title, inputData, preparedBillingText })` which computes the cost internally and never reads client `wordCount` or `pointsCost`.

- [ ] **Step 1: Write failing billing and task tests**

  Assert that:

  - billing uses server-prepared source text rather than a forged client `wordCount` or `pointsCost`;
  - cost is `Math.max(10, Math.ceil(preparedBillingText.length / 500) * 10)`;
  - ASCII and astral Unicode inputs prove the metric is UTF-16 code units, preserving current `String.length` charging behavior;
  - References contribute to the authoritative billed source in source order, while they are not an execution item;
  - the prepared Task transaction stores the recalculated `pointsCost` and consume record;
  - generic `createTask` behavior for existing tools is unchanged by the new seam.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish/polish-billing.service.spec.ts server/modules/tasks/tasks.service.spec.ts`

  Expected: failure on missing billing service/prepared-task method or wrong cost source, not on a broken test harness.

- [ ] **Step 3: Implement the billing seam**

  Reconstruct one deterministic billing string from trusted D1 prepared records in source order, including References, using the exact aggregation boundary rules below. Return `billingText`, `billingText.length`, and the unchanged 500-character/10-point formula. Add a dedicated `TasksService.createPreparedPolishTask` method whose `userId` is a `string`, accepts only this trusted internal value, recalculates the amount inside the existing transaction, and preserves the existing insufficient-points behavior. Do not route through client estimates, `PointsService.calculateActualCost`, or a new pricing policy.

- [ ] **Step 4: Run tests and verify GREEN**

  Run the same focused command. Expected: billing, transaction, Unicode, References, and legacy-tool regression tests pass.

- [ ] **Step 5: Refactor while green and commit**

  Keep formula calculation in one server-owned location and document why UTF-16 is intentional. Commit as `feat(d2): add prepared Polish billing seam`.

## Task 3: Add the one-content-chunk Polish executor adapter

**Files:**
- Create: `server/modules/ai-tools/polish/polish-chunk.executor.ts`
- Test: `server/modules/ai-tools/polish/polish-chunk.executor.spec.ts`

**Interfaces:**
- Consumes: D1 `ToolChunkExecutor`, `RenderedToolChunk`, `PolishGenerator.generate`, `ToolChunkExecutionInput.userInstructions`, and `PolishChunkOptions` from the normalized request.
- Produces: one sanitized `ToolChunkExecutionResult` for each eligible content chunk; it rejects direct non-content/non-eligible calls. Reference pass-through remains exclusively owned by `AcademicToolExecutionService`.

- [ ] **Step 1: Write failing executor tests**

  Use a mocked existing `PolishGenerator` seam and assert:

  - one eligible content chunk becomes exactly one generator call with that chunk's text, `requirements: input.userInstructions`, and only `polishType`/`language` options;
  - a direct References/non-eligible executor call rejects with a defensive invariant error and makes no generator call;
  - generator output is mapped to allowed D1 output fields, including legacy metadata, and does not add runtime provenance to the generator result;
  - generator errors propagate unchanged so the orchestrator can stop at the first failure;
  - the adapter does not call `DocumentInputService`, TasksService, points, or the provider directly.

- [ ] **Step 2: Run the focused executor tests and verify RED**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish/polish-chunk.executor.spec.ts`

  Expected: failure because the adapter is absent or does not yet implement the D1 executor contract.

- [ ] **Step 3: Implement the minimal adapter**

  For an eligible content chunk, call the existing generator once with `{ text: chunk.text, requirements: input.userInstructions, polishType: input.options.polishType, language: input.options.language }`. Reject any direct call whose chunk section is not `content` or whose `eligibleForExecution` is false. Map the result into `{ output: { originalContent, revisedContent, changes, metadata: { provider, model, latencyMs } }, warnings, validation, usage }`. Do not implement References pass-through here and do not modify `PolishGenerator`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run the same command. Expected: all executor tests pass and the mock generator call count is exact.

- [ ] **Step 5: Refactor while green and commit**

  Remove duplicated mapping code without changing the call contract. Commit as `feat(d2): adapt Polish generator to D1 chunks`.

## Task 4: Aggregate trusted source and chunk outputs into the legacy Polish result

**Files:**
- Create: `server/modules/ai-tools/polish/polish-result.aggregator.ts`
- Test: `server/modules/ai-tools/polish/polish-result.aggregator.spec.ts`

**Interfaces:**
- Consumes: ordered `AcademicToolExecutionResult` records and sanitized chunk outputs from Task 3.
- Produces: one `PolishOutput` compatible with the existing `TaskDetailPage` fields: `originalContent`, `revisedContent`, `changes`, `warnings`, `validation`, and metadata/usage.

- [ ] **Step 1: Write failing aggregation tests**

  Assert that:

  - content chunks are reconstructed in source order with the exact trusted provenance boundary rules: same `sourceBlockId` fragments have no synthetic separator and different content blocks use `\n\n`;
  - the content-to-References transition uses `\n\n`, distinct Reference source blocks use `\n`, and all boundaries are selected from trusted D1 item/provenance rather than model output;
  - References retain exact prepared item/block content and source order and contribute no revised LLM output;
  - a forged/mismatched per-chunk generator `originalContent` cannot replace the reconstructed global `originalContent`;
  - revised content follows the same ordered chunk sequence and does not silently reorder chunks;
  - changes are flattened in chunk/source order, warnings are combined deterministically, validation preserves D1 aggregated status, D1 `execution.usage` is used as the final usage, and legacy metadata preserves provider/model while summing mapped `latencyMs`;
  - a cross-chunk fixture covers same-block fragments, different content blocks, the content-to-References boundary, and distinct Reference blocks with exact expected separators;
  - the aggregator makes no Task or LLM calls and does not claim byte-level original file layout.

- [ ] **Step 2: Run focused aggregation tests and verify RED**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish/polish-result.aggregator.spec.ts`

  Expected: failure because the aggregator and final mapping are absent.

- [ ] **Step 3: Implement the deterministic aggregator**

  Use only trusted ordered D1 item text and provenance for `originalContent`; treat generator originals as an optional consistency warning/input check. Use content execution outputs for revised content and the D1-owned References pass-through records for the unchanged Reference segment. Apply the exact boundary rules: same source-block fragments join with no separator, different content blocks join with `\n\n`, content-to-References joins with `\n\n`, and distinct Reference blocks join with `\n`. Flatten changes/warnings in source order, use D1 aggregated usage, and preserve legacy metadata with provider/model from the mapped content outputs and total `latencyMs`. Do not alter the generator schema to recover raw file bytes.

- [ ] **Step 4: Run focused tests and verify GREEN**

  Run the same command. Expected: all order, forgery, References, metadata, and boundary tests pass.

- [ ] **Step 5: Refactor while green and commit**

  Keep aggregation pure and deterministic. Commit as `feat(d2): aggregate Polish chunks deterministically`.

## Task 5: Orchestrate preparation-before-billing and sequential Polish execution

**Files:**
- Create: `server/modules/ai-tools/polish/polish-submission.service.ts`
- Test: `server/modules/ai-tools/polish/polish-submission.service.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`

**Interfaces:**
- Consumes: normalizer, server-owned policy factory, `ToolSubmissionPreparationService`, `ToolInputPreparationService`, billing service, prepared Task seam, D1 `AcademicToolExecutionService`, content-only executor, aggregator, and existing Task update methods.
- Produces: `PolishSubmissionService.submit(request: PolishSubmissionRequest): Promise<Task>` that returns the processing Task immediately after scheduling, plus one asynchronous lifecycle with no second Polish pipeline.

- [ ] **Step 1: Write failing orchestration tests**

  Assert the observable sequence:

  - preparation resolves before billing, Task creation, processing state, or executor/generator invocation;
  - invalid text, invalid/foreign file reference, parser failure, context/chunking failure, and preparation rejection leave Task count, points balance, and LLM call count unchanged;
  - successful submission prepares first, creates one pending Task using trusted prepared billing, transitions to processing, schedules deferred work, and resolves the HTTP-facing `submit()` before a deferred generator promise completes;
  - the deferred worker calls `AcademicToolExecutionService.execute`, which passes References through; the executor call count and generator call count for Reference chunks are both zero;
  - the first content failure stops later chunks and persists failed status without a completed partial result;
  - only successful aggregation is persisted as completed result data;
  - other tool submission behavior is not invoked through this service.

- [ ] **Step 2: Run focused orchestration tests and verify RED**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish/polish-submission.service.spec.ts`

  Expected: failure because the service and lifecycle seam are not implemented.

- [ ] **Step 3: Implement the minimal orchestration**

  Implement the two explicit phases. In the synchronous phase, normalize the request, select the server-owned policy, call `prepareBeforeBilling`, derive trusted billing, create the Task/deduct points, update it to `processing`, schedule the in-process asynchronous processor, and return that processing Task without awaiting the processor. In the asynchronous phase, call `AcademicToolExecutionService.execute` with the prepared context and content-only executor; rely on that D1 service as the sole References pass-through owner, aggregate once, and update the Task to completed. Catch preparation errors before Task creation so they have no Task/points/LLM side effects; catch post-creation execution errors to stop later chunks, mark the existing Task failed, and omit any completed partial result. Reuse the current minimal deferred `setTimeout` mechanism only; do not introduce a queue, worker, BullMQ, Redis, or new execution infrastructure.

- [ ] **Step 4: Run focused tests and verify GREEN**

  Run the same command. Expected: all side-effect ordering, sequentiality, failure, and persistence tests pass.

- [ ] **Step 5: Refactor while green and commit**

  Register dependencies in `AiToolsModule`, keep the service as the sole Polish orchestration path, and commit as `feat(d2): orchestrate prepared Polish submission`.

## Task 6: Cut over only the Polish branch in AiToolsService

**Files:**
- Modify: `server/modules/ai-tools/ai-tools.service.ts`
- Test: `server/modules/ai-tools/ai-tools.service.spec.ts` (create if absent; otherwise extend the existing suite)

**Interfaces:**
- Consumes: existing `submitTask` input and `PolishSubmissionService.submit`.
- Produces: unchanged public `submitTask` behavior for non-Polish tools and a single delegated path for `taskType === 'polish'`.

- [ ] **Step 1: Write failing cutover tests**

  Assert that Polish delegates before the generic immediate `createTask` path, receives the authenticated `userId: string`, title, and input data including structured `DocumentInputRef`, and cannot fall through to the old raw-text generator path. Use a deferred generator promise to prove the delegated `submitTask` resolves with a `processing` Task before full execution completes. Assert that outline, paper-revision, and all other existing tool branches retain their prior service call behavior.

- [ ] **Step 2: Run the focused service tests and verify RED**

  Run: `npm test -- --runInBand server/modules/ai-tools/ai-tools.service.spec.ts`

  Expected: failure because Polish still uses the old generic path or the old raw `PolishGenerator.generate(inputData)` branch remains reachable.

- [ ] **Step 3: Implement the narrow route cutover**

  Add an early Polish delegation to `PolishSubmissionService`; leave generic creation and processing for other tools intact. Remove the old reachable Polish case from generic processing or make the new service the only caller so raw unprepared input cannot execute. Do not refactor unrelated switches or change the controller/shared API.

- [ ] **Step 4: Run focused and regression tests and verify GREEN**

  Run: `npm test -- --runInBand server/modules/ai-tools/ai-tools.service.spec.ts server/modules/ai-tools/polish server/modules/tasks/tasks.service.spec.ts`

  Expected: Polish cutover and existing tool regressions pass.

- [ ] **Step 5: Refactor while green and commit**

  Keep the diff limited to the Polish branch and commit as `feat(d2): cut over Polish production route`.

## Task 7: Add the minimal file-submit client path

**Files:**
- Modify: `client/src/api/ai-tools.ts`
- Modify: `client/src/pages/Tools/tools/PolishTool.tsx`
- Test: `test/unit/polish-migration-client.spec.ts`

**Interfaces:**
- Consumes: existing `DocumentInputDescriptor.document: DocumentInputRef`, existing `/api/ai-tools/submit`, authenticated `userId: string` supplied by the server context, and `Task` response.
- Produces: text submit or structured-file-reference submit using one request shape; no raw file re-upload, no string document-reference contract, and no client-authoritative billing.

- [ ] **Step 1: Write failing client tests**

  Assert that text mode sends text and Polish options, file mode sends only the server-issued `DocumentInputRef` object plus options, a file cannot submit before upload/reference readiness, raw file bytes and string-only references are not sent to the AI-tools endpoint, and displayed points remain labeled as an estimate while the returned Task `pointsCost` is authoritative.

- [ ] **Step 2: Run the focused client test and verify RED**

  Run: `npm test -- --runInBand test/unit/polish-migration-client.spec.ts`

  Expected: failure because file submit is currently disabled and/or the request helper does not support a reference-only input.

- [ ] **Step 3: Implement the minimal UI/API change**

  Extend the existing typed helper without changing the endpoint or shared API, importing `DocumentInputRef` from `@shared/document-input.interface`. Set `canSubmit` for text with nonblank text or file mode with a ready structured `documentRef`; send no raw file, string reference, client policy, or trusted price. Retain the existing upload UI and `TaskDetailPage`; do not redesign the tool page.

- [ ] **Step 4: Run focused client test and client build**

  Run: `npm test -- --runInBand test/unit/polish-migration-client.spec.ts` and `npm run build:client`.

  Expected: request-shape tests pass and the client production build succeeds.

- [ ] **Step 5: Refactor while green and commit**

  Keep request construction in one helper and commit as `feat(d2): enable Polish file-reference submission`.

## Task 8: Add security, order, and failure regression coverage

**Files:**
- Test: `server/modules/ai-tools/polish/polish-input.normalizer.spec.ts`
- Test: `server/modules/ai-tools/polish/polish-billing.service.spec.ts`
- Test: `server/modules/ai-tools/polish/polish-chunk.executor.spec.ts`
- Test: `server/modules/ai-tools/polish/polish-result.aggregator.spec.ts`
- Test: `server/modules/ai-tools/polish/polish-submission.service.spec.ts`
- Test: `server/modules/ai-tools/ai-tools.service.spec.ts`
- Test: `server/modules/tasks/tasks.service.spec.ts`

**Interfaces:**
- Consumes: completed D2 seams from Tasks 1–7.
- Produces: one focused regression gate covering all D2 acceptance invariants without touching inherited `test/unit/platform-command.spec.ts`.

- [ ] **Step 1: Write any missing failing regression cases**

  Add concrete cases for foreign/invalid structured `DocumentInputRef`, client price forgery, astral Unicode pricing, server-owned policy parity, References zero executor calls and zero generator calls, ordered calls under delayed mocked generators, first-error stop, no completed partial result, cross-chunk fragment aggregation boundaries, old Task field compatibility, and unchanged non-Polish routing.

- [ ] **Step 2: Run the complete focused D2 gate and verify RED for each new case**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish test/unit/polish-migration-client.spec.ts server/modules/ai-tools/ai-tools.service.spec.ts server/modules/tasks/tasks.service.spec.ts`

  Expected: each newly added case fails before its corresponding behavior is implemented; no inherited platform-command failure is treated as a D2 failure.

- [ ] **Step 3: Implement only the minimal missing behavior**

  Correct implementation seams rather than weakening assertions or adding retry/partial-result behavior. Keep all C4 ownership/hash/parser protections delegated to existing services.

- [ ] **Step 4: Run the focused D2 gate and verify GREEN**

  Run the same command. Expected: all D2 tests pass, with zero real DeepSeek/provider calls.

- [ ] **Step 5: Refactor tests for readable invariant coverage and commit**

  Consolidate only duplicated fixtures/helpers that do not hide assertions. Commit as `test(d2): cover Polish migration safety invariants`.

## Task 9: Run the full verification matrix

**Files:**
- Modify only if required by verification-generated metadata: none planned.
- Test: all D2 tests from Tasks 1–8.
- Review artifact to be created only after separate ChatGPT D2 review authorization: `docs/reviews/PHASE_D2_FINAL_ACCEPTANCE_REPORT.md` is out of scope for this implementation plan.

**Interfaces:**
- Consumes: all implementation and regression commits from Tasks 1–8.
- Produces: verified D2 Review Candidate evidence; no acceptance claim and no merge/tag.

- [ ] **Step 1: Run focused D2 tests**

  Run: `npm test -- --runInBand server/modules/ai-tools/polish test/unit/polish-migration-client.spec.ts server/modules/ai-tools/ai-tools.service.spec.ts server/modules/tasks/tasks.service.spec.ts`.

  Expected: PASS; record test count, duration, and zero external DeepSeek calls.

- [ ] **Step 2: Run full regression**

  Run: `npm test -- --runInBand`.

  Expected: all in-scope tests pass. Report inherited `test/unit/platform-command.spec.ts` separately if it remains the known inherited issue; do not modify it or mislabel it as D2-fixed.

- [ ] **Step 3: Run static checks and builds**

  Run each independently: `npm run type:check`, `npm run lint`, `npm run build:server`, and `npm run build:client`.

  Expected: all four commands succeed without changing frozen contracts.

- [ ] **Step 4: Verify AppModule bootstrap**

  Run: `npm run test:app-bootstrap`.

  Expected: Nest `AppModule` initializes and shuts down through the existing bootstrap smoke test; no provider cycle or missing registration is reported.

- [ ] **Step 5: Preserve the verification record**

  Keep the command outputs, test count, build results, bootstrap result, and zero-provider-call evidence available for the later D2 review package. Do not alter source files to make a check appear green.

## Task 10: Confirm Review Candidate scope and handoff boundary

**Files:**
- Modify: none planned.
- Inspect: `PROJECT_STATE.md`, `ROADMAP.md`, `CODEX_WORKFLOW.md`, `docs/reviews/PHASE_D1_FINAL_ACCEPTANCE_REPORT.md`, and the D2 implementation diff.

**Interfaces:**
- Consumes: completed implementation, regression, and verification evidence from Tasks 1–9.
- Produces: a D2 Review Candidate handoff with no acceptance claim, no merge/tag action, and no D3 transition.

- [ ] **Step 1: Verify the changed-file boundary**

  Run: `git diff --name-only phase-d1-accepted...HEAD` and compare every path with the Planned File Map. Expected: no parser/context/chunking/document-input/schema/shared-contract/LLM/B1/Paper Revision/other-tool/platform-command changes.

- [ ] **Step 2: Verify branch and governance state**

  Run: `git branch --show-current`, `git status --short`, and `git log --oneline --decorate -n 12`. Expected: work is on one D2 branch created from the accepted D1 main, the worktree is clean after commits, `main` is not merged during D2, no D2 acceptance marker exists, no D2 tag exists, and no D2 branch is used for D3.

- [ ] **Step 3: Verify external-call and inherited-issue boundaries**

  Review the focused test/provider-call evidence. Expected: external DeepSeek calls equal zero; any inherited `test/unit/platform-command.spec.ts` failure is recorded as inherited and the file is unchanged.

- [ ] **Step 4: Create the Review Candidate handoff**

  Present the implementation commit range, focused/full verification results, changed-file list, frozen-file confirmation, known inherited risks, and the explicit statement that ChatGPT review is required. Do not create a Final Acceptance Report, update `PROJECT_STATE.md`, merge, tag, or declare `PHASE_D2_ACCEPTED` in this implementation phase.

- [ ] **Step 5: Stop at the review boundary**

  After handoff, wait for explicit ChatGPT D2 review instructions. No implementation follow-up, D2 acceptance, or D3 work is implied by a green verification matrix.

## Acceptance Matrix for the Future D2 Review

| Criterion | Required evidence | Plan coverage |
|---|---|---|
| Preparation precedes billing | failure tests show zero Task/points/LLM side effects before D1 preparation succeeds | Tasks 1, 5, 8 |
| Server-authoritative billing | forged client values ignored; prepared UTF-16 `String.length` formula matches current server semantics | Task 2, Task 8 |
| Text and file parity | both routes enter the same D1 preparation/execution pipeline; file sends only `documentRef` | Tasks 1, 5, 7 |
| Sequential chunk execution | ordered delayed mocks and exact call order | Tasks 3, 5, 8 |
| References safety | References preserved in source order and billed as prepared source, but zero executor/generator/LLM calls | Tasks 2–4, 8 |
| Trusted original reconstruction | forged generator originals cannot affect final `originalContent` | Task 4 |
| First failure stops | later chunks are not called and no completed partial result is persisted | Task 5, Task 8 |
| Legacy compatibility | endpoint, outer Task, old result fields, and TaskDetail rendering remain compatible | Tasks 4, 6, 7, 8 |
| Generator boundary | existing generator remains one text to one output with no new file/chunk/billing responsibilities | Task 3 |
| Non-Polish stability | all other AI tools retain existing route behavior; schema/shared API remain unchanged | Task 6, full regression |
| Runtime readiness | type-check, lint, server/client build, and AppModule bootstrap pass | Task 9 |

## Explicit Out-of-Scope and Risk Record

- Generic authenticated `POST /api/tasks` remains a legacy alternate path and is not the D2 UI path. D2 does not redesign that endpoint or silently convert all generic task creation. Its continued legacy behavior must be noted in the eventual review report as an inherited/out-of-scope risk.
- Existing `TasksService` has no refund flow on post-creation execution failure; D2 does not add refunds. The failure contract is “failed Task, no completed partial result.”
- Existing Task updates and generic task access-control behavior are not broadened in D2.
- No database snapshot table, schema migration, provider change, shared API change, chunking implementation redesign, byte-preserving document serializer, retry policy, or cross-tool abstraction is authorized.
- Important design deviation: resolved in this plan. The earlier draft direction of Unicode code-point billing is replaced by the current server’s UTF-16 code-unit metric, because changing actual charges would violate billing semantic preservation. This is not a blocker and is covered by explicit Unicode regression tests.

## Handoff Boundary

This document is the implementation plan only. It does not constitute D2 authorization, Review approval, Final Acceptance, merge permission, or permission to modify `main`. A later implementation run must first receive explicit authorization, create a D2 branch from the accepted `phase-d1-accepted` main, execute each task with TDD evidence, and stop for ChatGPT review before any acceptance or merge action.
