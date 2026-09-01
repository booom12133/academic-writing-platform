# Phase C4 — File Integration Implementation Plan

> Use TDD. Do not merge before explicit `PHASE_C4_ACCEPTED`.

## Scope

Implement only the approved C4 file-input boundary. C1/C2/C3, AI Tools,
Tasks, schema, shared API, and the global exception filter are frozen.

## Mandatory preflight

1. Fetch `origin`, verify `origin/main` is the accepted C3 baseline, and create
   `phase/c4-file-integration` from that main.
2. Inspect the locally installed `fullstack-nestjs-core` and `file-service`
   packages. Record the actual import/provider/token, appId/default bucket,
   upload/download/remove signatures and data types, Buffer support, and
   `PlatformModule.forRoot()` registration behavior.
3. If the approved platform adapter cannot work in the installed runtime,
   report `C4_ARCHITECTURE_ISSUE` and stop. Do not invent a second storage
   architecture.

## TDD implementation sequence

### 1. Contracts and service

Create the C4 ref/descriptor types, independent C4 errors, storage port, and
`DocumentInputService` tests first. Cover upload validation before persistence,
best-effort compensation, ref validation, ownership, size/hash integrity, and
the ordered C1 → C2 → C3 calls. Implement the service only after the RED tests.

### 2. Platform adapter

Add tests for the exact preflight-confirmed FileService calls. Implement the
adapter against the real provider and default bucket. Use an unavailable local
adapter only to make local behavior explicit; it is not platform smoke
evidence.

### 3. Controller and exception boundary

Add the multipart controller with a 20 MB Multer limit and the C4-local filter.
Map all eight C4 codes and Multer `LIMIT_FILE_SIZE` without modifying the
global filter or other module semantics. Bind the filter only to the C4
controller endpoint.

### 4. Explicit frontend action

Add `client/src/api/document-input.ts` and export it from the API index. Update
Polish and Paper Revision file mode so selection stores only a local `File`;
only the explicit “上传并准备文档” action calls the multipart API. Store the
returned descriptor and `DocumentInputRef`, show ready state, clear both when
another file is selected, and stop. File mode must contain no `submitTask`
path. Text mode must retain its existing submit behavior.

### 5. Lifecycle and trust tests

Verify that successful originals are retained, prepare never removes them, and
partial persistence invokes best-effort remove. Verify that every ref field is
treated as untrusted: path grammar and user scope are checked, filename and
source type come from the validated path, MIME is validated, bytes are
downloaded, size and SHA-256 are recomputed, and C1 performs parser/signature/
UTF-8 validation.

## Verification gate

Run:

```text
npx jest server/modules/document-input --runInBand
npm test -- --runInBand
npm run lint
npm run type:check
npm run build:server
npm run build:client
npx --yes npm@10.9.2 ci --ignore-scripts --dry-run --loglevel=error
```

Then execute the real Platform runtime smoke with a synthetic small document:
multipart upload → real FileService persistence → download → size/SHA-256 →
`prepare()` → C1 → C2 → C3. Local unavailable-adapter tests cannot replace
this gate. If the runtime is unavailable, report
`PHASE_C4_REVIEW_BLOCKED_PLATFORM_RUNTIME` and do not claim complete Review
Candidate readiness.

## Handoff

Run `git diff --name-only origin/main...HEAD` and audit every frozen path. Update
`PROJECT_STATE.md` only with the actual C4 branch, evidence, and blocked/Review
Candidate status. Before push, verify origin and local Git HTTP/1.1. Push the
same branch and create one PR targeting `main` with the exact line
`Do not merge before acceptance`. Do not merge, tag, declare acceptance, or
start Phase D.
