# Phase D3 Final Acceptance Report

Date: 2026-09-03
Final Acceptance status: `PHASE_D3_ACCEPTED_CLOSED`

This report records the D3 Review-pass candidate and the evidence prepared for
final acceptance. D3 was accepted by ChatGPT, PR #6 was merged, and the
accepted tag was created during post-merge governance closeout.

## 1. Governance baseline

- D2 accepted base SHA: `31a7002babed73bc325841c5622a2f2e03f38bc4`
- D3 branch: `phase/d3-paper-revision-migration`
- Docs baseline commit: `5b0078bee45a9469345b66da1328c1e86a7ee10b`
- D3 Implementation Candidate: `6290540811fdfe06af1316a035dc7a5d1466cc02`
- Review Candidate HEAD: `2178c90e5f6721e2b9052863d950c90cbda03313`
- Pull request: [#6 Phase D3: Paper Revision Migration](https://github.com/booom12133/academic-writing-platform/pull/6)
- ChatGPT Review: `PHASE_D3_REVIEW_PASS`
- GitHub Review ID: `5097012233`
- ChatGPT Final Acceptance: `PHASE_D3_ACCEPTED`
- Final Acceptance Review ID: `5097074648`
- Final Acceptance HEAD: `8479fabaaf09ebf72bc428bbdc29f3b791a56989`
- PR #6: `MERGED`
- PR #6 merge commit: `4abae19bcd6b5fc5edbb37b544020464a6e0ac98`
- Review-pass boundary: no production-code or test changes occurred after
  `2178c90e5f6721e2b9052863d950c90cbda03313`.

## 2. Production flow delivered

The implemented Paper Revision flow is:

```text
Text
→ C1
→ C2
→ C3

File:
DocumentInputRef
→ DocumentInputService.prepare()
→ C1
→ C2
→ C3

both
→ executable-content gate
→ existing TasksService.createTask()
→ fixed server-authoritative 30 points
→ processing
→ immediate response

async
→ D1 AcademicToolExecutionService
→ PaperRevisionChunkExecutor
→ frozen PaperRevisionGenerator
→ References pass-through
→ deterministic aggregator
→ completed / failed
```

Preparation and executable-content preflight complete before Task creation or
point deduction. The processing Task is returned before asynchronous execution
completes.

## 3. Input compatibility and instructions

The compatibility contract is:

```text
inputMode omitted
+ nonblank text
→ legacy text compatibility
```

`revisionTypes` is an open string array. `undefined` and `[]` are allowed for
direct/server callers; provided values preserve exact values and order,
including `['logic', 'discussion']`. The server does not apply a frontend UI
enum whitelist.

The real frontend gate remains stricter:

```text
text:
nonblank text + revisionTypes.length > 0

file:
prepared DocumentInputRef + revisionTypes.length > 0
```

The instruction path is:

```text
inputData.requirements
→ ToolPreparationInput.userInstructions
→ C2
→ C3
→ D1
→ PaperRevisionChunkExecutor
→ PaperRevisionGenerator.requirements
```

`requirements` is not copied into executor options. Options contain only
`revisionTypes` and `language`.

## 4. Chunking, billing, and references

- `PAPER_REVISION_CHUNKING_POLICY.maxSize = 2000`.
- The unit is Unicode code points.
- The policy is server-owned and identical for text and file preparation.
- Client policy, `wordCount`, and `pointsCost` values are not authoritative.
- Billing remains fixed at 30 points through
  `TasksService.createTask(taskType='paper-revision')`.
- `TasksService` is unchanged; Polish dynamic billing is not reused.
- References use D1 pass-through with executor calls `0`, generator calls `0`,
  and LLM calls `0`.
- The References section itself is not modified by Paper Revision.

## 5. Aggregation and result compatibility

- `originalContent` comes only from trusted D1 rendered source.
- Generator `originalContent` is ignored as global source content.
- Executed content uses generator revised output.
- References use trusted pass-through content.
- Same `sourceBlockId` fragments use `""`.
- Different content blocks use `"\n\n"`.
- Content to References uses `"\n\n"`.
- Distinct References blocks use `"\n"`.
- Cross-chunk joins compare `previous.lastSourceBlockId` with
  `current.firstSourceBlockId`.
- The regression case of block A + block B fragment 1, block B fragment 2,
  block C, and then References is covered.
- `changeSummary` and `unresolvedIssues` flatten in execution order.
- `authorInputNeeded` is OR-ed across executed chunks.
- `warnings` is exactly `execution.warnings`; warnings are not concatenated a
  second time.
- D1 validation `{status, results, summary}` maps to legacy
  `{status, violations, summary}`.
- Usage is the D1 aggregate.
- Provider/model come from the first successful executed chunk and latency is
  summed.
- Model provenance is not retained in the public result.
- The existing TaskDetail legacy result contract is unchanged.

## 6. Failure boundaries

Invalid, foreign, or tampered file references fail before Task creation,
points deduction, executor execution, generator execution, or LLM calls.
Empty and References-only prepared contexts fail at the same preflight
boundary.

If processing persistence returns null, scheduling is not started. If the first
content execution fails, later execution stops, aggregation is skipped, no
completed result is written, and the Task becomes failed.

## 7. Local verification evidence

All local checks were run against Review Candidate HEAD before this report-only
commit:

| Check | Result |
|---|---|
| Focused D3 suite | PASS — 8 suites / 35 tests |
| Full regression | PASS — 50 suites / 306 tests |
| Type-check | PASS — server and client |
| Lint | PASS |
| Server build | PASS |
| Client build | PASS; existing module-type and chunk-size warnings only |
| AppModule bootstrap | PASS — AiToolsModule execution foundation resolved |
| Automated real DeepSeek calls | 0 |

Commands used:

```text
npm test -- --runInBand server/modules/ai-tools/paper-revision server/modules/ai-tools/ai-tools.service.spec.ts server/modules/ai-tools/ai-tools.module.spec.ts test/unit/paper-revision-migration-client.spec.ts
npm test -- --runInBand
npm run lint
npm run type:check
npm run build:server
npm run build:client
npm run test:app-bootstrap
```

The existing local Jest `ts-jest` warning and expected provider warning remain
non-blocking. No `npm run test:deepseek` smoke was executed because it tests
provider connectivity directly and does not exercise the D3 Paper Revision
pipeline; a real external API call is not required for this preparation.

## 8. GitHub Actions evidence

The PR push and pull-request verification runs both completed with the same
inherited failure:

- [push run 33658118318](https://github.com/booom12133/academic-writing-platform/actions/runs/33658118318): `Full tests` failed only at
  `test/unit/platform-command.spec.ts`.
- [pull_request run 33658154147](https://github.com/booom12133/academic-writing-platform/actions/runs/33658154147): `Full tests` failed only at
  `test/unit/platform-command.spec.ts`.
- [final report push run 33706655667](https://github.com/booom12133/academic-writing-platform/actions/runs/33706655667): same inherited failure only.
- [final report pull-request run 33706661575](https://github.com/booom12133/academic-writing-platform/actions/runs/33706661575): same inherited failure only.

Each GitHub run recorded:

```text
49 suites PASS
1 inherited suite FAIL
305 tests PASS
1 inherited test FAIL
```

The failing assertion is the inherited Linux/Windows executable-path fixture:
expected `/opt/hostedtoolcache/node/22.23.2/x64/bin/node`, received `npx.cmd`.
Because the workflow stops after Full tests, GitHub Actions lint,
type-check, and build steps were skipped. Local verification evidence above is
reported separately and passed.

## 9. Frozen and out-of-scope boundaries

The following were not modified:

- C1, C2, C3, C4, and D1 execution foundations;
- Polish;
- TasksService;
- PaperRevisionGenerator;
- shared contracts;
- database schema;
- LlmService and DeepSeekProvider;
- skills/runtime and other tools;
- `ROADMAP.md` during D3 implementation and review; it was updated only in
  the post-merge governance closeout;
- historical acceptance reports before this D3 report;
- `test/unit/platform-command.spec.ts`.

No RAG, Zotero, multi-provider support, Redis, BullMQ, queue, parallel
execution, whole-document planner, cross-chunk memory, or Phase E/F work was
implemented.

Known limitation:

> D3 provides deterministic chunk-local academic revision and aggregation. It
> does not guarantee whole-document global restructuring across chunk
> boundaries.

## 10. Final acceptance closeout

This report was prepared as a docs-only addition after Review Candidate HEAD
and finalized during post-merge governance closeout. The closeout modified no
production code or tests. No real DeepSeek smoke was required because it does
not exercise the D3 Paper Revision pipeline; the inherited
`test/unit/platform-command.spec.ts` fixture remains out of scope and is the
known CI limitation recorded above.

Final status:

`PHASE_D3_ACCEPTED_CLOSED`
