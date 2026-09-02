# Phase C4 — File Integration Implementation Plan

> Use TDD. Do not merge before explicit `PHASE_C4_ACCEPTED`.

## Scope

Implement only the approved C4 file-input boundary. C1/C2/C3, AI Tools,
Tasks, schema, shared API, and the global exception filter are frozen.
Storage is selectable between the existing platform adapter and the minimal
self-hosted filesystem adapter. Filesystem mode is the C4 self-hosted
acceptance path and does not require PlatformModule/FileService credentials.

## Mandatory preflight

1. Fetch `origin`, verify `origin/main` is the accepted C3 baseline, and create
   `phase/c4-file-integration` from that main.
2. Inspect the locally installed `fullstack-nestjs-core` and `file-service`
   packages. Record the actual import/provider/token, appId/default bucket,
   upload/download/remove signatures and data types, Buffer support, and
   `PlatformModule.forRoot()` registration behavior for optional platform mode.
3. Validate the filesystem configuration contract: `filesystem` requires an
   absolute non-public `DOCUMENT_STORAGE_ROOT`; invalid driver/configuration
   fails clearly and never silently falls back to another backend.

## TDD implementation sequence

### 1. Contracts and service

Create the C4 ref/descriptor types, independent C4 errors, storage port, and
`DocumentInputService` tests first. Cover upload validation before persistence,
best-effort compensation, ref validation, ownership, size/hash integrity, and
the ordered C1 → C2 → C3 calls. Implement the service only after the RED tests.

### 2. Storage adapters and configuration

Add tests for the exact preflight-confirmed FileService calls and retain the
platform adapter. Add the minimal self-hosted filesystem adapter under the
same `DocumentStoragePort`: one absolute configured root, canonical generated
keys only, root containment, durable Buffer writes, Buffer reads, exact-object
compensation removal, and no public URL operation. In filesystem mode, wire
the filesystem adapter without loading/instantiating PlatformModule or
injecting FileService. Do not add a generalized storage subsystem.

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

After implementation/push, do not deploy. The user's Linux self-hosted server
will execute the mandatory smoke with:

```text
DOCUMENT_STORAGE_DRIVER=filesystem
DOCUMENT_STORAGE_ROOT=/var/lib/academic-writing-platform/documents
```

The smoke must prove real multipart upload → durable filesystem write →
durable filesystem read → size/SHA-256 → `prepare()` → C1 → C2 → C3, with no
AI task, points deduction, or LLM call. Local adapter tests are not a
substitute for that server evidence.

## Handoff

Run `git diff --name-only origin/main...HEAD` and audit every frozen path. Update
`PROJECT_STATE.md` only with the actual C4 branch, evidence, and blocked/Review
Candidate status. Before push, verify origin and local Git HTTP/1.1. Push the
same branch and create one PR targeting `main` with the exact line
`Do not merge before acceptance`. Do not merge, tag, declare acceptance, or
start Phase D.
