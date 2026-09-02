# Phase C4 Final Acceptance Report

## 1. Phase and current review status

```text
Phase C4 — File Integration
PHASE_C4_REVIEW_PASS
```

The C4 implementation and mandatory real self-hosted Linux filesystem smoke
passed ChatGPT's final GitHub/runtime review. This report records the evidence
for final acceptance review; it does not claim `PHASE_C4_ACCEPTED`. The branch
remains open in PR #3, with no merge and no accepted tag.

## 2. Goal

Accept one explicit user-triggered DOCX, PDF, TXT, or Markdown multipart upload,
retain the original through durable storage, return a validatable
`DocumentInputRef`, and provide a server-side preparation path through frozen
C1 → C2 → C3. File mode must stop after upload/preparation and must not create
an AI task or deduct points.

## 3. Accepted C4 scope and boundaries

- One document per upload, maximum 20 MiB.
- C4 self-hosted acceptance uses the filesystem adapter at the configured
  absolute non-public root.
- File mode is `select File → explicit 上传并准备文档 → multipart upload →
  descriptor/ref ready state → STOP`.
- File mode does not call `/api/ai-tools/submit`, create a task, deduct points,
  invoke a generator, call an LLM/DeepSeek, execute chunks, or enter Phase D.
- Text mode retains the existing `submitTask` behavior.
- The original file is durably retained; `prepare()` never deletes it. C4
  performs best-effort compensation only for failed or partial persistence.
  General retention and user deletion remain future-phase scope.
- ParsedDocument, TaskContext, and ChunkedTaskContext are not persisted.

The following remained frozen and were not changed by C4:

```text
server/modules/document-parsing/**
server/modules/context-builder/**
server/modules/chunking/**
server/modules/ai-tools/**
server/modules/tasks/**
server/database/schema.ts
shared/api.interface.ts
server/common/filters/exception.filter.ts
```

## 4. Runtime and storage smoke evidence

### Environment

- Runtime: user's real Linux server, CentOS 8.
- Node: `v22.23.2`.
- npm: `10.9.8`.
- Storage root: `/var/lib/academic-writing-platform/documents`.
- Storage root was outside the public web root.
- Auth mode: repository local-development test harness.
- Database mode: repository `LocalDevelopmentDatabaseModule` test harness.
- Storage mode: real self-hosted Linux filesystem.
- `FORCE_AUTHN_INNERAPI_DOMAIN`: unset.
- DeepSeek API key: absent; no LLM call occurred.

This smoke does not prove production self-hosted authentication, production
PostgreSQL deployment, or full self-hosted production readiness.

### Real multipart upload

```text
POST /api/document-inputs → HTTP 201
```

Fixture: synthetic non-sensitive `c4-smoke-test.md`.

Returned metadata:

```text
provider:  self-hosted-filesystem
bucketId:  self-hosted-filesystem
fileName:  c4-smoke-test.md
sourceType: markdown
sizeBytes: 138
sha256:    54226ccee52283fc2b751ef107a9e1de7936241c4ab575e2d1113fbe7ba5e2d3
```

Upload-time C1 evidence:

```text
title:        C4 Smoke Test
blockCount:   6
warningCount: 1
```

### Real filesystem verification

- The object physically existed beneath
  `/var/lib/academic-writing-platform/documents`.
- Stored size was `138` bytes.
- Stored SHA-256 exactly matched the source SHA-256.
- Byte-for-byte `cmp` exit code was `0`.
- Object count changed from `0` to `1`.
- No public URL was created.

### Real `prepare()` evidence

```text
C4_PREPARE_SMOKE_PASS
```

Document verification:

```text
provider:  self-hosted-filesystem
bucketId:  self-hosted-filesystem
fileName:  c4-smoke-test.md
sourceType: markdown
sizeBytes: 138
sha256:    matched source SHA-256
```

Preparation summary:

```text
blockCount:          6
chunkCount:          3
contentCodePoints:   88
referenceCodePoints: 31
```

Task envelope and policy:

```text
task.type:            polish
userInstructions:     C4 synthetic smoke only.
policy.version:       1
policy.maxSize:       80
policy.sizeMetric:    unicode-code-points
policy.overlap:       0
```

Chunks:

```text
document-1:c000001 / content     / size 46 / itemCount 2
document-1:c000002 / content     / size 42 / itemCount 2
document-1:c000003 / references / size 31 / itemCount 2
```

Chunk warnings: none.

The complete verified chain was:

```text
real multipart HTTP
→ real Linux filesystem write
→ DocumentInputRef
→ real Linux filesystem read
→ size verification
→ SHA-256 verification
→ DocumentInputService.prepare()
→ C1 parse PASS
→ C2 context PASS
→ C3 chunk PASS
```

No AI task was created, no points were deducted, no generator was invoked, and
no DeepSeek/LLM call occurred. Phase D was not started.

## 5. Platform/runtime preflight record

The approved storage preflight was completed before implementation against the
installed package versions:

```text
@lark-apaas/fullstack-nestjs-core@1.1.60
@lark-apaas/file-service@0.1.2
Multer@2.0.2
```

The verified optional platform storage contract used the import
`@lark-apaas/fullstack-nestjs-core`; `PlatformModule.forRoot()` registers the
global `FileService` provider. The verified calls were
`getDefaultBucket(): Promise<string>`, `from(bucket).upload(Buffer, options)`,
`from(bucket).download(path)` returning a PromiseLike result with `Blob`
content, and `from(bucket).remove(string[])`. Buffer upload is supported.
App identity is acquired internally by the platform FileService from request
context. The C4 acceptance smoke intentionally used the self-hosted filesystem
adapter and therefore did not require platform credentials or
`FORCE_AUTHN_INNERAPI_DOMAIN`.

## 6. Trust, integrity, and lifecycle guarantees

All client-returned `DocumentInputRef` fields are untrusted. Preparation
validates schema/version/provider, bucket, canonical generated path, user scope,
path-derived basename/extension, filename consistency, derived source type,
MIME, downloaded size, and recomputed SHA-256 before invoking frozen C1.
Parser selection does not rely only on client-provided metadata.

Successful originals are retained durably. A successful upload has no
automatic deletion in C4. If persistence is partial or finalization fails
after upload, best-effort compensation removes the exact object to prevent an
orphan. General retention/deletion management is out of scope.

## 7. Verification before review pass

- C4 targeted server tests: `8 suites / 45 tests` passed.
- C4 targeted client multipart API test: `1 test` passed.
- Full local regression: `31 suites / 235 tests` passed.
- `npm run lint`: passed.
- `npm run type:check`: passed.
- `npm run build:server`: passed.
- `npm run build:client`: passed with existing non-blocking module-type and
  chunk-size warnings.
- npm 10 dependency dry-run: passed.
- Frozen-file audit against `origin/main...HEAD`: clean.
- DeepSeek/external AI calls during C4 verification: `0`.

## 8. Inherited/out-of-scope runtime issue

Full self-hosted `AppModule` bootstrap currently fails because the existing
frozen `SkillLoader` constructor parameter is interpreted by Nest DI as
`Object`. This defect is present unchanged on the accepted main baseline and
was not introduced or repaired by C4. It was only documented.

Therefore:

```text
C4 DocumentInput runtime contract: PASS
Full self-hosted production readiness: NOT ESTABLISHED
```

The inherited issue is not a C4 production-code change and must not be fixed in
this phase.

## 9. GitHub/PR state

- Branch: `phase/c4-file-integration`.
- Reviewed implementation HEAD: `7295a34095a16c2248c45da1826468327a5c6aa6`.
- PR: [#3 Phase C4: File Integration](https://github.com/booom12133/academic-writing-platform/pull/3).
- PR state: OPEN.
- Required PR guard remains: `Do not merge before acceptance`.
- No merge was performed.
- No `phase-c4-accepted` tag was created.
- `PHASE_C4_ACCEPTED` was not declared.
- Phase D was not started.

## 10. Final acceptance handoff

This governance record is ready for ChatGPT Final Acceptance Review. The
current repository state remains `PHASE_C4_REVIEW_PASS`; formal acceptance,
merge to `main`, and creation of an accepted tag remain outside this task and
require an explicit `PHASE_C4_ACCEPTED` decision.
