# Task 4 Report

Date: 2026-09-01
Phase: C2
Task: 4 - Enforce validation, evidence separation, and immutability

## Files changed

- `server/modules/context-builder/context-builder.service.ts`
- `server/modules/context-builder/context-builder.errors.ts`
- `server/modules/context-builder/context-builder.service.spec.ts`

## Commit

- Subject: `feat(c2): enforce context input and evidence boundaries`

## RED evidence

Command:

```powershell
npx jest server/modules/context-builder/context-builder.service.spec.ts --runInBand
```

Observed failure summary before implementation:

- `rejects malformed input with undefined`
  - received `TypeError: Cannot destructure property 'document' of 'input' as it is undefined.`
- `rejects malformed input with { taskType: 'outline', document: [Object] }`
  - received `function did not throw`
- `rejects malformed input with { taskType: 'polish', document: undefined }`
  - received `TypeError: Cannot read properties of undefined (reading 'source')`
- `rejects malformed input with { taskType: 'polish', document: [Object] }`
  - received `function did not throw`
- `rejects malformed blocks`
  - received `function did not throw`
- `rejects an invalid reference-section range`
  - received `function did not throw`
- `rejects a reference headingBlockId that does not match the range start`
  - received `function did not throw`

Exact Jest footer:

```text
Test Suites: 1 failed, 1 total
Tests:       8 failed, 10 passed, 18 total
Snapshots:   0 total
```

## GREEN evidence

Command:

```powershell
npx jest server/modules/context-builder/context-builder.service.spec.ts --runInBand
```

Result after implementation:

```text
PASS server/modules/context-builder/context-builder.service.spec.ts
Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
Snapshots:   0 total
```

Additional verification:

```powershell
npm run type:check:server
```

Result:

```text
> fullstack-nestjs-template@2.2.5 type:check:server
> tsc --noEmit --project tsconfig.node.json
```

## What changed

- Added explicit runtime validation for the builder input and parsed-document structure.
- Normalized invalid input handling to `ContextBuilderError` with only:
  - `INVALID_CONTEXT_INPUT`
  - `INVALID_PARSED_DOCUMENT`
- Rejected malformed task types, missing documents, empty block lists, malformed blocks, duplicate block IDs, and invalid reference-section boundaries.
- Preserved the existing deterministic mapping, heading-path behavior, and reference-section classification logic.
- Kept `userInstructions` only under `task.userInstructions`.
- Preserved source warnings, metadata, block page numbers, and instruction-like source text as ordinary evidence.
- Continued safe copying for mapped output blocks, with manual table row/cell copies and independent heading snapshots.
- Covered the deferred Task 3 minor with regression assertions for heading snapshot independence and H1 to H3 jumps without fabricating a missing parent heading.

## Self-review

- Scope stayed inside the three files named in the brief.
- No frozen files were modified.
- Validation does not repair or reconstruct C1 structure; it rejects invalid input instead.
- Output copying remains minimal and manual; no new dependency was added.
- Existing mapping IDs, source block ordering, heading-path logic, and reference behavior remained unchanged in tests.

## Concerns

- Focused Jest still emits the pre-existing `ts-jest` `TS151001` warning about `esModuleInterop`; it is non-blocking and unrelated to Task 4.

## Review-fix report: referenceSection object validation

### Finding addressed

Added runtime validation before `referenceSection` destructuring so `null` and other non-object values use the existing `INVALID_PARSED_DOCUMENT` `ContextBuilderError` contract instead of leaking a native exception. Existing mapping, heading, and reference behavior is unchanged.

### TDD RED evidence

Added the focused regression case in `server/modules/context-builder/context-builder.service.spec.ts` for `referenceSection: null` and a non-object string.

Exact command:

```powershell
& 'D:/CodexGlobal/codex_global_env.ps1'; npx jest server/modules/context-builder/context-builder.service.spec.ts --runInBand
```

Exact relevant output before the fix:

```text
FAIL server/modules/context-builder/context-builder.service.spec.ts
Tests:       1 failed, 19 passed, 20 total

● ContextBuilderService › rejects a non-object referenceSection: null

Expected asymmetric matcher: ObjectContaining {"code": "INVALID_PARSED_DOCUMENT"}
Received name:    "TypeError"
Received message: "Cannot destructure property 'startBlockIndex' of 'referenceSection' as it is null."
```

### Fix and GREEN evidence

Added a non-null object guard immediately before `validateReferenceSection` destructures the value. The guard throws `ContextBuilderError('INVALID_PARSED_DOCUMENT', 'Parsed document is invalid.')`.

Exact focused test command:

```powershell
& 'D:/CodexGlobal/codex_global_env.ps1'; npx jest server/modules/context-builder/context-builder.service.spec.ts --runInBand
```

Exact result:

```text
PASS server/modules/context-builder/context-builder.service.spec.ts
Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        0.895 s, estimated 1 s
```

Exact server type-check command and result:

```powershell
& 'D:/CodexGlobal/codex_global_env.ps1'; npm run type:check:server

> fullstack-nestjs-template@2.2.5 type:check:server
> tsc --noEmit --project tsconfig.node.json
```

### Changed files

- `server/modules/context-builder/context-builder.service.ts`
- `server/modules/context-builder/context-builder.service.spec.ts`
- `.superpowers/sdd/2026-09-01-phase-c2-context-builder-plan/task-4-report.md`

### Commit

Commit subject: `fix(c2): validate reference section object`

### Fix self-review and concerns

- The implementation is limited to the reported pre-destructuring gap and keeps the two-code C2 error model.
- The regression covers both `null` and a non-object value; both now produce `INVALID_PARSED_DOCUMENT`.
- No frozen files or dependencies were changed.
- The focused Jest run continues to emit the existing non-blocking `ts-jest` `TS151001` `esModuleInterop` warning.
