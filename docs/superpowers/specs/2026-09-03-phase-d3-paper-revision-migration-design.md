# Phase D3 — Paper Revision Migration Design

Status: `PHASE_D3_DESIGN_REVIEW_PASS`

Design review decisions are authoritative for this document. This document
starts from the accepted D2 baseline:

- `main`: `31a7002babed73bc325841c5622a2f2e03f38bc4`
- `phase-d2-accepted`: target `31a7002babed73bc325841c5622a2f2e03f38bc4`
- Stable state: `PHASE_D2_ACCEPTED_CLOSED`

## 1. Goal and scope

Phase D3 migrates the existing Paper Revision production route onto the frozen
C1 → C2 → C3 → D1 preparation and execution architecture. It supports both
text input and a server-issued `DocumentInputRef`, preserves the existing
Paper Revision generator's one-text-to-one-output contract, keeps the fixed
30-point price, and returns the existing outer `Task` contract.

D3 includes:

- server-owned Paper Revision normalization and `maxSize = 2000` chunk policy;
- preparation through C1 → C2 → C3 for text and through
  `DocumentInputService.prepare()` for files;
- executable-content preflight before Task creation and points deduction;
- a Paper Revision D1 chunk executor and deterministic result aggregator;
- asynchronous submission and failure lifecycle;
- client submission of text or a prepared structured file reference;
- regression coverage for safety, compatibility, aggregation, and bootstrap.

D3 does not include changes to document parsing, context building, chunking,
document storage, D1 execution, Polish, shared API contracts, database schema,
LLM provider behavior, skills/runtime, other AI tools, RAG, Zotero, queues,
Redis, BullMQ, multi-provider support, parallel execution, or a whole-document
planning pass.

## 2. Current legacy flow

The current text flow is:

```text
PaperRevisionTool
  → POST /api/ai-tools/submit
  → AiToolsService.submitTask
  → TasksService.createTask
  → fixed server-side 30-point deduction
  → Task = processing
  → legacy delayed generic dispatcher
  → PaperRevisionGenerator.generate(inputData)
  → LlmService → DeepSeekProvider
  → PaperRevisionOutput stored in resultData
```

The generic dispatcher creates and bills the Task before Paper Revision input
validation and generator execution. A direct file-mode payload therefore can
create a billed Task before the generator rejects its file-only input.

The current frontend file tab selects and uploads a document, stores the
returned `DocumentInputRef`, and stops. It does not submit a Paper Revision
Task. Text mode submits `inputMode`, `text`, `revisionTypes`, `requirements`,
and client `wordCount`; it does not submit a language value.

The current generator accepts `text`, optional `revisionTypes`, optional
`requirements`, optional `language`, and legacy `inputMode`/`fileName`. It
selects the revision skill stack, composes a guarded JSON prompt, calls
`LlmService.generate()` with `temperature = 0.5`, `thinking = false`,
`jsonMode = true`, and `maxTokens = 5000`, validates the response with Zod,
runs the conservative invariant validator, and returns:

```text
originalContent
revisedContent
changeSummary
unresolvedIssues
authorInputNeeded
warnings
validation
metadata { provider, model, usage, latencyMs }
```

## 3. Target architecture

```text
Text
  → ToolInputPreparationService
  → C1 → C2 → C3

DocumentInputRef
  → DocumentInputService.prepare()
  → C1 → C2 → C3

both
  → executable-content gate
  → TasksService.createTask(taskType = paper-revision)
  → existing server calculation = 30 points
  → update processing
  → return processing Task immediately

async
  → AcademicToolExecutionService
  → sequential eligible content chunks
  → PaperRevisionChunkExecutor
  → existing PaperRevisionGenerator
  → References pass-through in D1
  → PaperRevisionResultAggregator
  → completed Task
```

`AiToolsService` will delegate `paper-revision` before generic Task creation,
as D2 does for Polish. Other task types remain on their current generic path.

## 4. Input contract

The D3 submission input is an internal server contract; the outer endpoint
continues accepting `CreateTaskRequest` with a `Record<string, any>` payload.

```ts
interface PaperRevisionSubmissionInputData {
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

interface NormalizedPaperRevisionSubmission {
  preparation: ToolPreparationInput;
  options: {
    revisionTypes?: string[];
    language?: 'zh' | 'en';
  };
}
```

Normalization rules:

- `inputMode: 'file'` requires a structurally valid `DocumentInputRef`; the
  existing C4 service remains authoritative for ownership, provider, bucket,
  path, metadata, size, and SHA-256 validation.
- `inputMode: 'text'` requires a nonblank string and preserves the submitted
  text as the C1 source text.
- When `inputMode` is omitted, a nonblank `text` value with no file source is
  normalized as text mode. An omitted mode with ambiguous text and file
  sources is rejected.
- `requirements` is trimmed once and becomes the only global user instruction.
- `revisionTypes` is optional. `undefined` and `[]` are valid for legacy direct
  callers. When provided, it must be an array of strings; order and values are
  preserved, and values are not whitelisted against frontend choices. The
  server must not add a nonempty-array requirement.
- `language`, when present, is limited to `zh` or `en`; omission preserves
  generator language detection.
- `wordCount`, `pointsCost`, client policy fields, `inputMode` after source
  selection, and `fileName` are not trusted execution or billing inputs.

There is deliberately no new `reviewerComments` field. Existing
`inputData.requirements` is the single global field for revision instructions,
reviewer comments, and citation-related constraints.

## 5. Requirements and options mapping

The exact instruction path is:

```text
inputData.requirements
  → Paper Revision normalizer
  → ToolPreparationInput.userInstructions
  → C2 task.userInstructions
  → C3 task.userInstructions
  → D1 ToolChunkExecutionInput.userInstructions
  → PaperRevisionChunkExecutor
  → PaperRevisionGenerator.requirements
```

`requirements` must not also be copied into executor `options`.

Executor options contain only:

- `revisionTypes`;
- `language`.

The executor calls the frozen generator with the chunk text and these mapped
values. The generator remains responsible for formatting its existing
`Revision types: ...` prompt line and the supplied requirements.

## 6. Chunking policy

The server-owned production policy is:

```ts
const PAPER_REVISION_CHUNKING_POLICY = {
  maxSize: 2000,
} as const;
```

The unit is Unicode code points. The policy is used identically for text and
file mode, cannot be overridden by the client, has no dynamic tokenizer or
model-context calculation, and retains C3's zero-overlap, deterministic,
lossless, source-order, structure-aware semantics.

If the default provider/model later changes to a model with a materially
smaller context window, this policy requires a new architecture review.

## 7. Billing and Task boundary

Paper Revision retains the current fixed-price behavior:

```text
prepare
→ executable-content preflight
→ TasksService.createTask({ taskType: 'paper-revision' })
→ existing TOOL_CONFIGS basePoints = 30
```

No new content-length pricing service is introduced. No Polish `/500 * 10`
formula is copied. The existing `TasksService` should not be modified.

Preparation must complete before `createTask`; therefore invalid files,
References-only documents, and empty executable content cannot create a Task or
deduct points. The server-calculated `Task.pointsCost` is authoritative.
Client `wordCount` and `pointsCost` are ignored. The client display estimate is
corrected from 20 to 30.

## 8. Reference policy

References are never sent to `PaperRevisionChunkExecutor`,
`PaperRevisionGenerator`, or the LLM. D1 records them as pass-through chunks
with their trusted original text and provenance.

Citation-related `requirements` may constrain content-chunk revision, but D3
does not modify the Reference section and does not create references, DOIs,
authors, funding claims, or other unsupported evidence. Reference search,
Zotero, and citation enrichment remain Phase E work.

## 9. Async and failure lifecycle

The HTTP contract remains immediate and asynchronous:

```text
normalize
→ prepare
→ executable-content gate
→ create and bill Task
→ processing / progress 10
→ schedule async work
→ return processing Task
```

The async path executes content chunks sequentially in source order. On the
first executor/generator error it stops later content chunks, does not invoke
the aggregator, does not write a completed partial result, and updates the
Task to `failed`. If the processing-state update fails, async execution is not
scheduled.

Invalid, foreign, or tampered file references and empty or References-only
prepared contexts fail before Task creation, billing, points deduction, or any
LLM call.

## 10. Executor contract

`PaperRevisionChunkExecutor` implements `ToolChunkExecutor` and accepts only
eligible content chunks. It calls the frozen generator with:

```ts
{
  text: input.chunk.text,
  ...(input.userInstructions === undefined
    ? {}
    : { requirements: input.userInstructions }),
  ...(Array.isArray(input.options.revisionTypes)
    ? { revisionTypes: input.options.revisionTypes }
    : {}),
  ...(input.options.language === 'zh' || input.options.language === 'en'
    ? { language: input.options.language }
    : {}),
}
```

It returns the legacy output fields inside D1's trusted result envelope,
including `changeSummary`, `unresolvedIssues`, `authorInputNeeded`, warnings,
validation, metadata, and usage. It never passes file references or Reference
chunks to the generator.

## 11. Aggregation contract

`PaperRevisionResultAggregator` consumes only `AcademicToolExecutionResult`.

- `originalContent` is reconstructed from trusted rendered D1 source items;
  generator-provided originals are ignored.
- Executed content uses each generator `revisedContent`.
- Reference chunks use trusted original text.
- Same source-block fragments join with `""`.
- Different content source blocks join with `"\n\n"`.
- Content to References joins with `"\n\n"`.
- Distinct Reference source blocks join with `"\n"`.
- An executed chunk spanning multiple source blocks stores its trusted first
  and last source block IDs; cross-chunk separators compare those IDs.
- `changeSummary` is flattened in source/chunk order.
- `unresolvedIssues` is flattened in source/chunk order.
- `authorInputNeeded` is the logical OR across executed chunk outputs.
- `warnings` is exactly `execution.warnings`; generator/executor warnings are
  not concatenated a second time.
- D1 validation is mapped from `{ status, results, summary }` to the legacy
  `{ status, violations, summary }`, flattening violations in result order.
- Provider/model come from the first successful executed chunk, latency is the
  sum of executed chunk latencies, and usage is `execution.usage`.
- No model-supplied provenance is retained.

Required reconstruction regression:

```text
chunk 1: block A + block B fragment 1
chunk 2: block B fragment 2
chunk 3: block C
then References
```

The test must assert exact `originalContent` and `revisedContent` strings.

## 12. Frontend contract

`PaperRevisionTool` keeps the existing text/file tabs, upload component, and
revision-type selection gate. The UI requires both a nonblank text or prepared
file reference and `revisionTypes.length > 0` before submission. This UI rule
is intentionally stricter than the server compatibility contract.
Text mode submits text through a typed Paper Revision helper. File mode must
require a successful upload and submit only the returned `DocumentInputRef`.
Raw bytes and string-only paths never enter `/api/ai-tools/submit`.

The client may send an estimated `wordCount`, but it must not send an
authoritative price or policy. The displayed price is 30. The existing
TaskDetail Paper Revision renderer remains compatible with the resulting
fields and requires no result schema change.

## 13. Frozen paths and implementation boundary

The following remain frozen:

- `server/modules/document-parsing/**`
- `server/modules/context-builder/**`
- `server/modules/chunking/**`
- `server/modules/document-input/**`
- `server/modules/ai-tools/execution/**`
- `server/modules/ai-tools/polish/**`
- `shared/api.interface.ts`
- `shared/document-input.interface.ts`
- `server/database/schema.ts`
- `server/modules/tasks/**`
- `server/modules/ai-tools/generators/paper-revision.generator.ts`
- `server/modules/ai-tools/llm/**`
- `server/modules/ai-tools/skills/**`
- other AI-tool production flows
- historical acceptance reports
- `test/unit/platform-command.spec.ts`

D3 may minimally modify `AiToolsService`, `AiToolsModule`, the Paper Revision
frontend/API, and add the owned Paper Revision adapter/submission files listed
in the implementation plan. No TasksService or generator change is required.

## 14. Known limitation

D3 provides deterministic chunk-local academic revision and aggregation. It
does not guarantee whole-document global restructuring across chunk
boundaries.

Resolving that limitation is a future architecture candidate. D3 does not add
a multi-pass document planner, global summary pass, cross-chunk memory, RAG,
Zotero, agents, queue, Redis/BullMQ, or parallel execution.

## 15. Governance debt

`ROADMAP.md` is a C4-era stale governance document. It still presents the
umbrella Phase D as not authorized even though D1 and D2 are accepted and D2
is closed.

This is recorded as:

```text
KNOWN_GOVERNANCE_DEBT
```

D3 does not modify `ROADMAP.md`. During the eventual D3 final closeout, the
roadmap must record D1 and D2 as `ACCEPTED / FROZEN / CLOSED`, record D3's
actual final state, and leave E/F `PLANNED / NOT AUTHORIZED`. Historical
acceptance reports must remain unchanged.

## 16. Acceptance matrix

The implementation is accepted only when targeted tests cover:

| Area | Required evidence |
|---|---|
| Text preparation | C1 → C2 → C3 with `maxSize = 2000` |
| File preparation | `DocumentInputRef` through existing C4 preparation |
| File safety | invalid, foreign, and tampered refs fail before side effects |
| Policy | client cannot override server policy; text/file parity |
| Input mapping | requirements exact path; open-string revisionTypes; omitted inputMode compatibility; language mapping |
| Billing | fixed 30; forged count/price ignored; no TasksService change |
| Frontend | prepared file ref can submit; estimate displays 30 |
| UI gate | text/file submission remains disabled when `revisionTypes.length === 0` |
| Execution | sequential content execution; first error stops later chunks |
| References | executor/generator/LLM calls equal zero |
| Aggregation | exact source boundaries and trusted original/revised reconstruction |
| Result fields | summaries, issues, author-input OR, warnings, validation, metadata, usage |
| Failure | no completed partial result; processing update fail-fast |
| Compatibility | legacy Task and TaskDetail fields preserved |
| Regression | non-Paper-Revision tools unchanged |
| External boundary | automated real DeepSeek calls equal zero |
| Bootstrap | AppModule bootstrap passes |
| Inherited issue | `platform-command.spec.ts` unchanged and out of scope |

## 17. Explicit out-of-scope

This design authorizes no implementation, branch creation, PR, merge, tag,
Phase D4, Phase E, or Phase F activity. It changes no production behavior by
itself.
