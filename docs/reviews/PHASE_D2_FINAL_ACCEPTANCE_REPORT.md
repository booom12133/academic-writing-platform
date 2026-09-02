# Phase D2 Final Acceptance Report

Date: 2026-09-02  
Final status: `PHASE_D2_ACCEPTED_CLOSED`

ChatGPT issued `PHASE_D2_ACCEPTED` under Final Acceptance Review ID
`5091748366`. This report records the accepted baseline and the post-merge
governance closeout. D2 is frozen and closed; D3 remains planned only.

## 1. Governance baseline

- D1 accepted base SHA: `ad7cf2fdff3183abf24ded65e7b85256a0149770`
- D2 branch: `phase/d2-polish-migration`
- PR: [#5 Phase D2: Polish Migration](https://github.com/booom12133/academic-writing-platform/pull/5)
- Review-pass HEAD: `457cd786260f7fc4822a79d54319fd45f8aa54c2`
- ChatGPT review result at this boundary: `PHASE_D2_REVIEW_PASS`
- ChatGPT Final Acceptance: `PHASE_D2_ACCEPTED`
- Final Acceptance Review ID: `5091748366`
- Accepted implementation/final-acceptance HEAD: `56dc2ff48fdf19f3f11ab1cc8270432fda917fd7`
- D2 implementation/review-fix commits:
  - `d14eaf1` — lock Polish submission contract
  - `1a66620` — add prepared Polish billing seam
  - `e9c45c9` — adapt Polish generator to D1 chunks
  - `f2cfc88` — aggregate Polish chunks deterministically
  - `3d4f2b7` — orchestrate prepared Polish submission
  - `8626c11` — cut over Polish production route
  - `fbb603b` — enable Polish file-reference submission
  - `47e5782` — wrap Polish file submit controls
  - `5ca1ca9` — cover Polish migration safety invariants
  - `0233a04` — align Polish type contracts
  - `53ec2206fb26d1a8f56895e7d2dd1141fb02d46d` — restore trusted aggregation contracts
  - `457cd786260f7fc4822a79d54319fd45f8aa54c2` — gate submission before billing
- PR #5 merge commit: `acfa70a7cc9317946653c4249cb7f2dfad50ab6c`
- PR #5 status: MERGED into `main`
- Post-merge governance commit: this closeout commit, final `main` HEAD
- Accepted tag: `phase-d2-accepted` — annotated tag points to final `main` HEAD

No production-code change exists after the Review-pass HEAD. Changes after that
HEAD are limited to this report and the post-merge governance metadata in
`PROJECT_STATE.md`.

## 2. D2 production flow delivered

### Polish text mode

The Polish route accepts `userId: string` and text-mode `inputData`, normalizes
requirements and tool options, applies the server-owned policy
`POLISH_CHUNK_MAX_SIZE = 2000`, and enters the common preparation path. The
server parses the text, builds trusted context, chunks it, computes billing
from prepared rendered content, creates one Task, updates it to `processing`,
and returns that processing Task immediately. Full chunk execution remains
asynchronous.

### Polish file mode

The client uploads the selected document through the existing document-input
flow and submits only the server-issued structured `DocumentInputRef`. The
server treats the reference as untrusted, revalidates and prepares it through
the existing document-input path, and then uses the same billing and D1
execution path as text mode. Raw file bytes, string-only document references,
and client-supplied billing are not sent to the AI-tools submission route.

### C1 → C2 → C3 → D1 evidence

- Text preparation: document parser (C1) → context builder (C2) → chunker
  (C3).
- File preparation: validated document-input preparation delegates into the
  same C1 → C2 → C3 pipeline.
- D1 execution renders trusted items and provenance, executes eligible content
  chunks through `PolishChunkExecutor`, passes References through without an
  executor call, aggregates validation and usage, and preserves the ordered
  execution result for D2 aggregation.
- D2 does not replace or duplicate the D1 execution pipeline.

### Server-owned chunking policy

`POLISH_CHUNK_MAX_SIZE = 2000` is represented by the server-owned
`POLISH_CHUNKING_POLICY` and passed to `ToolPreparationInput` for both text and
file modes. The client cannot control this policy. The value is the approved
production policy for the current Polish prompt, `maxTokens = 4000`, existing
DeepSeek configuration, and prompt/context overhead; it is not the D1 test
fixture value `100`.

### Preparation, billing, and Task boundary

Preparation completes before billing and Task creation. Billing uses trusted
prepared rendered text and the existing UTF-16 JavaScript `String.length`
semantics:

```text
points = max(10, ceil(preparedBillingText.length / 500) * 10)
```

Client `wordCount` and `pointsCost` are not authoritative. The prepared billing
value is used by `createPreparedPolishTask`, which performs the authoritative
Task creation and points deduction.

If no rendered content chunk is both content and `eligibleForExecution === true`,
submission fails before billing, Task creation, points deduction, processing
update, or asynchronous execution. Empty prepared context and
References-only prepared context are covered by regression tests.

### File integrity and failure boundary

Invalid, foreign, or tampered `DocumentInputRef` values fail in the existing
server-owned document-input validation/preparation boundary before Task
creation or billing. Validation includes reference structure and ownership,
provider and bucket constraints, generated path rules, source metadata,
downloaded size, and recomputed SHA-256. The D2 Polish layer does not bypass
these C4 checks.

### References and execution lifecycle

References contribute their trusted prepared text to billing but are passed
through by `AcademicToolExecutionService`; they produce zero executor calls,
zero generator calls, and zero LLM calls. Eligible content chunks execute
sequentially in source order. The first execution error stops later chunks,
marks the Task failed, and does not persist a completed partial result.

The HTTP-facing submit path remains asynchronous:

```text
validate → prepare → bill → create Task/deduct points → processing → schedule
async execution → execute sequential chunks → aggregate → persist completed result
```

The request does not await the full DeepSeek/chunk execution before returning.

## 3. Result and compatibility evidence

- `originalContent` is reconstructed from trusted D1 source item text and
  provenance; generator-provided original text cannot replace it.
- `revisedContent` follows the same deterministic ordered chunk sequence.
- Same source-block fragments use no synthetic separator; different content
  blocks use `\n\n`; content-to-References uses `\n\n`; distinct Reference
  blocks use `\n`. Boundary selection uses trusted D1 first/last provenance,
  never model output.
- Changes, warnings, metadata, and D1 aggregated usage are preserved in stable
  source order. Legacy metadata retains provider/model and accumulated latency.
- D1 aggregated validation is mapped back to the legacy Polish result shape:
  `status`, flattened `violations`, and `summary`; the D1 internal `results`
  array is not exposed as the legacy top-level contract.
- The existing `/api/ai-tools/submit` endpoint and outer `Task` response remain
  compatible. Non-Polish routes retain their existing generic path.
- The frontend Polish flow supports text submission and prepared structured
  file-reference submission while keeping displayed pricing as an estimate and
  the returned Task price authoritative.
- Paper Revision production behavior and its existing file-only guards remain
  unchanged.

## 4. Acceptance-preparation verification

All checks below were run on the Review-pass candidate before this docs-only
preparation commit:

| Check | Result |
|---|---|
| Focused D2 tests | PASS — 8 suites / 27 tests |
| Full regression | PASS — 44 suites / 274 tests |
| Type-check | PASS — server and client |
| Lint | PASS — ESLint and Stylelint |
| Server build | PASS |
| Client build | PASS; existing module-type and chunk-size warnings only |
| AppModule bootstrap | PASS — `AiToolsModule` execution foundation resolved |
| Automated external DeepSeek calls | 0 |

The focused D2 command was:

```text
npm test -- --runInBand server/modules/ai-tools/polish test/unit/polish-migration-client.spec.ts server/modules/ai-tools/ai-tools.service.spec.ts server/modules/tasks/tasks.service.spec.ts
```

The full regression command was:

```text
npm test -- --runInBand
```

No real DeepSeek smoke was executed. It was not required for D2 acceptance
because the existing `test:deepseek` command bypasses the D2 Polish pipeline
and only exercises the unchanged `DeepSeekProvider`. If a separately
authorized connectivity check is needed, use only the repository's minimal
smoke:

```powershell
$env:DEEPSEEK_API_KEY = '<authorized-key>'
npm run test:deepseek
Remove-Item Env:DEEPSEEK_API_KEY
```

Expected output is one successful JSON response containing the selected model,
usage, latency, and `{"ok":true}` content. This command was not run during D2
closeout.

## 5. Frozen and inherited boundaries

The following remain unchanged and out of scope for D2:

- C1 document parsing, C2 context building, C3 chunking, and C4 document-input
  ownership/integrity implementations;
- shared API contracts, database schema, task subsystem redesign, LLM provider
  behavior, B1 skills/runtime, and other AI-tool production flows;
- Paper Revision production code and behavior;
- inherited `test/unit/platform-command.spec.ts`.

The inherited GitHub Actions issue in `test/unit/platform-command.spec.ts` is
reported separately from D2: Linux CI can expect a Unix Node executable path
while the inherited fixture returns `npx.cmd`. The local Windows full
regression passes, the fixture was not modified, and this issue is not a D2
acceptance finding.

## 6. Final Acceptance and closeout

ChatGPT explicitly issued `PHASE_D2_ACCEPTED`. PR #5 was merged normally into
`main` with merge commit `acfa70a7cc9317946653c4249cb7f2dfad50ab6c`. The
post-merge governance commit records the accepted stable state, and the
annotated tag `phase-d2-accepted` is created only after that governance commit.

The inherited `test/unit/platform-command.spec.ts` CI issue remains accepted as
out of scope and unchanged. D2 production implementation and tests were not
modified during closeout. D3 is `PLANNED / NOT_STARTED / NOT_AUTHORIZED`; no
D3 branch or implementation is created here.

Final status:

`PHASE_D2_ACCEPTED_CLOSED`
