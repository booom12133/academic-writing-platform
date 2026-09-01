# Phase C4 — File Integration Design

## Status

`PHASE_C4_PLAN_APPROVED_WITH_MANDATORY_AMENDMENTS`

Implementation is limited to the C4 branch and must not enter Phase D.

## Goal

Accept one DOCX, PDF, TXT, or Markdown document through a real multipart
upload, persist the original through the approved platform FileService, return
an opaque-but-validatable `DocumentInputRef`, and provide a server-side
prepare path that downloads, verifies, and invokes frozen C1 → C2 → C3.

## Frozen boundaries

C1, C2, C3, AI Tools, Tasks, the database schema, and `shared/api.interface.ts`
remain unchanged. The common exception filter also remains unchanged; C4 uses
only `server/modules/document-input/document-input.exception-filter.ts`.

C4 does not create tasks, deduct points, call generators, invoke an LLM or
DeepSeek, execute chunks, merge results, persist derived documents, or add
general document deletion/retention management. It handles one document of at
most 20 MB.

## Storage preflight gate

Before implementing the adapter, inspect the installed packages under
`node_modules/@lark-apaas/fullstack-nestjs-core/**` and
`node_modules/@lark-apaas/file-service/**`. Record the actual package versions,
import path, Nest provider/token, appId acquisition, default-bucket API,
upload/download/remove signatures and return types, Buffer support, and whether
`PlatformModule.forRoot()` registers the provider. If the approved durable
storage design cannot be satisfied by the installed runtime, report
`C4_ARCHITECTURE_ISSUE` and stop without adding another storage architecture.

## Upload boundary

The browser flow is explicitly:

```text
select File
→ retain File locally only
→ click “上传并准备文档”
→ POST /api/document-inputs (multipart)
→ receive DocumentInputDescriptor
→ retain DocumentInputRef and show document-ready
→ STOP
```

File mode never calls `/api/ai-tools/submit`, creates a task, deducts points,
enters a generator, or enters Phase D. Text mode keeps the existing
`submitTask` behavior unchanged. Selecting another file clears the current
client descriptor/ref; C4 does not delete the previously persisted object.

## Trust and preparation boundary

Every client-returned ref field is untrusted, including `bucketId`, `filePath`,
`fileName`, `sourceType`, `mimeType`, `sizeBytes`, and `sha256`. `prepare()`
validates version/provider, default/allowed bucket, generated path grammar and
user scope, derives the basename and extension from the validated path, checks
filename consistency, derives source type from extension, validates optional
MIME, downloads bytes, verifies size, recomputes SHA-256, and compares hashes.
Only then does it call frozen C1, followed by C2 and C3. Parser choice never
depends only on client-provided source type or MIME.

## Errors and lifecycle

The controller-local filter maps these stable codes:

```text
INVALID_DOCUMENT_UPLOAD
UNSUPPORTED_DOCUMENT_TYPE
DOCUMENT_TOO_LARGE
DOCUMENT_STORAGE_FAILED
DOCUMENT_NOT_FOUND
DOCUMENT_OWNERSHIP_MISMATCH
DOCUMENT_INTEGRITY_MISMATCH
DOCUMENT_PREPARATION_FAILED
```

Multer size-limit failures over 20 MB map to `DOCUMENT_TOO_LARGE`.

Successful originals are retained durably. `prepare()` never deletes an
original. C4 never automatically deletes after a successful upload. If
persistence is partial or finalization fails after upload, best-effort remove
is attempted to avoid an orphan object. General retention and user deletion
remain future-phase scope.

## Runtime gate

Review Candidate requires a real Platform runtime smoke using a synthetic,
non-sensitive small document:

```text
POST /api/document-inputs
→ real platform FileService upload
→ DocumentInputRef
→ real storage download
→ size/SHA-256 verification
→ DocumentInputService.prepare()
→ C1 → C2 → C3
→ PASS
```

Local unavailable-adapter tests do not satisfy this gate. If the smoke cannot
be executed, the status is `PHASE_C4_REVIEW_BLOCKED_PLATFORM_RUNTIME` and the
branch must not be described as a complete Review Candidate.
