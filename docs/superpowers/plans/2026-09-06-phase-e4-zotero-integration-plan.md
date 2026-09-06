# PHASE_E4_IMPLEMENTATION_PLAN

> **For agentic workers:** This plan is an implementation specification for the future E4 implementation session. The implementation session must use `superpowers:subagent-driven-development` or `superpowers:executing-plans` only after this plan receives explicit plan-review approval.

**Goal:** 在不改写现有架构的前提下，为个人 Zotero library 增加服务端连接、bibliographic SourceRecord 同步、stored PDF attachment 导入与独立 attachment version sync，并复用 C4 → C1 → C2 → C3 → E1 的既有边界。

**Architecture:** Zotero Web API v3；personal library v1；API key 通过带 `Zotero-API-Key` header 的 `GET /keys/current` 返回 authoritative user identity，并决定 library identity；Zotero item 映射为 bibliographic SourceRecord，支持的 PDF attachment 映射为 KnowledgeDocument；attachment external sync state 由 KnowledgeDocument 保存；KnowledgeDocumentVersion、chunks、provenance 保持 immutable；E2 indexing 仍是独立后续能力，E3 不变。

**Tech Stack:** 当前 `main` 的 NestJS/TypeScript、Drizzle、PostgreSQL/pgvector、现有 C4 storage、C1 parser、C2/C3 pipeline、E1 knowledge repository/service、Jest 和既有 CI 命令。

**Spec:** 本计划唯一依据是 ChatGPT 已通过的 `PHASE_E4_DESIGN_REVIEW_PASS` 及当前 GitHub `main` 审计结果。当前 `main` 没有已提交的 E4 architecture design 文件；不得从旧草案推断接口。

## Global Constraints

- 当前任务只产出计划；不创建 branch，不写 implementation code，不创建 `0004` migration 文件，不执行 migration，不 commit/push，不创建或更新 PR。
- GitHub `main` 的 accepted baseline 是 `90ce381ab766150d4c90cb821e4235efca9da164`；当前仓库状态为 clean，`origin` 为 `https://github.com/booom12133/academic-writing-platform.git`，repository-local `http.version` 为 `HTTP/1.1`。
- E4 只支持 Zotero Web API v3 的 personal library；不支持 group library、Zotero Desktop Local API、notes、annotations、highlights、linked attachments、linked URLs、snapshots 或任意 URL 抓取。
- 客户端 connection input 只有 API key。客户端不得提交或决定 platform userId、authoritative Zotero libraryId、SourceRecord owner 或其他 owner 字段。
- credential introspection 只经 `ZoteroCredentialIntrospectionClient` 调用 `GET /keys/current`，并使用 `Zotero-API-Key` header 与 `Zotero-API-Version: 3`；普通 Zotero API 请求使用同样的 headers，绝不把 key 放入 query string。
- E1 provenance/lifecycle semantics frozen；E4 仅允许最小 additive citation metadata extension。不得创建 `ZoteroReference` knowledge model，也不得把任意 provider JSON 接入现有 canonical validator。
- parent item version 与 attachment version 必须独立发现和比较。parent unchanged 绝不能跳过 attachment discovery；attachment version unchanged 才能跳过 download。
- attachment externalVersion 或 upstream md5 改变后，即使下载 bytes 的 SHA-256 未改变，也必须只更新 external sync state，不创建新的 KnowledgeDocumentVersion。bytes SHA-256 改变时，必须在同一个 KnowledgeDocument 下创建新的 immutable KnowledgeDocumentVersion，保留旧版本/chunks/provenance。
- import success 不等于 indexing success；E4 不拥有 E2 lifecycle。不得引入 Redis、BullMQ、queue、reranker、新 vector DB、HNSW/IVFFlat、E5、E6 或 production rollout。

## 1. Current GitHub Audit

### 1.1 Baseline and workflow

已审计 `PROJECT_STATE.md`、`ROADMAP.md`、`CODEX_WORKFLOW.md`、E3 Final Acceptance Report 及 `AGENTS.md`。E3 是当前 stable accepted phase；E4 进入实施必须另建 E4 branch，但本计划阶段不创建 branch。`main` 只能代表最新 accepted stable 版本，E4 未获 implementation authorization 前不能触碰实现。

已核对：

- `main` HEAD 与 `origin/main` 均为 `90ce381ab766150d4c90cb821e4235efca9da164`。
- `origin` 和 repository-local Git network setting 符合项目规则；未来 push 前仍必须重新核对 `HTTP/1.1`，且禁止 force push。
- 当前 migration journal 只有 `0001`、`0002`、`0003`；E4 应追加 `0004`，不得改写既有 migration。

### 1.2 Database and migration seam

重点文件：

- `server/database/schema.ts`
- `server/database/local-development.database.ts`
- `server/database/local-development.database.spec.ts`
- `server/database/standard-postgres.module.ts`
- `drizzle/migrations/0001_standard_postgres_baseline.sql`
- `drizzle/migrations/0002_e1_knowledge_provenance.sql`
- `drizzle/migrations/0003_e2_embedding_indexes.sql`
- `drizzle/migrations/meta/_journal.json`
- `drizzle/migrations/meta/0001_snapshot.json` 至 `0003_snapshot.json`

当前 schema 已有：

- `knowledge_source_records`：`userId`、`kind`、`canonicalMetadata`、lifecycle/status 字段。
- `knowledge_metadata_assertions`：`field`、JSONB `value`、provider/external identity、verification 与 assertion hash；已有 `(sourceRecordId,userId,assertionHash)` 唯一约束。
- `knowledge_source_external_links`：`provider`、`externalRecordId`、`externalVersion` 等；已有 user-scoped provider/external identity 唯一约束。
- `knowledge_documents`：`sourceRecordId`、`originKind`、`activeVersionId`、lifecycle status，但没有 attachment external sync state。
- `knowledge_document_versions`、`knowledge_chunks`、`knowledge_imports`：已承载 E1 immutable version、derived chunks 和 import marker。

`0004` 的 migration audit gate 必须在实施开始时重新核对 migration numbering、实际 SQL、Drizzle snapshot、唯一约束名称及 repository mapping。若实现分支前的 GitHub `main` 与本审计出现 schema/API 差异，必须停止并报告差异，不得自行改写 E4 架构。

### 1.3 E1 contract and repository

重点文件：

- `server/modules/knowledge/knowledge.types.ts`
- `server/modules/knowledge/knowledge.repository.ts`
- `server/modules/knowledge/knowledge.service.ts`
- `server/modules/knowledge/knowledge.errors.ts`
- `server/modules/knowledge/knowledge.repository.spec.ts`
- `server/modules/knowledge/knowledge.service.spec.ts`

当前 `MetadataField` 只有 `title`、`authors`、`year`、`venue`、`abstract`、`doi`、`citationKey`；`MetadataAssertionInput.value` 不是任意 JSON，而是受限 primitive/Author 类型。当前 `createSourceRecord` 会校验 canonical metadata、assertion references 和 resolution semantics；`createExternalLinks` 主要是 insert-only。

当前 repository 没有按 external identity owner-safe resolve SourceRecord/KnowledgeDocument 的接口，也没有 attachment external state update、restore、trash-state 或 failure-state 专用接口。E4 必须 additive 扩展这些 repository capabilities，不能绕过 E1 validation 直接写 JSONB。

### 1.4 C4/C1/C2/C3 seam

重点文件：

- `server/modules/document-input/document-input.storage.ts`
- `server/modules/document-input/document-input.service.ts`
- `server/modules/document-input/document-input.module.ts`
- `server/modules/document-parsing/*`
- `server/modules/chunking/*`
- `server/modules/context-builder/*`

现有 C4 已提供 server-side `DocumentStoragePort.upload({bucketId,filePath,fileName,buffer,mimeType})`，且 `DocumentInputService.upload(userId, UploadedDocument)` 已接受 buffer-shaped 输入；controller 的 multipart 只是外层 transport。因此实施前的 seam audit 结论是：优先让 Zotero 使用这个 provider-neutral buffer path，不复制 storage 逻辑。若 module wiring 或契约测试证明该 seam 不能安全复用，才设计一个最小 provider-neutral buffered ingestion seam；该 seam 不得成为 Zotero 专用 storage 实现。

C4 限制为 20 MB；现有 C1 parser 接受 PDF 等既有 source type。E4 不实现 Zotero parser/chunker。

### 1.5 Module and test layout

`server/app.module.ts` 当前挂载 `DocumentInputModule`、`KnowledgeModule`，不直接挂载 E2/E3 indexing/retrieval modules。E4 module 应仅依赖 C4、C1、C2、C3、E1，不能依赖 E2/E3。

现有测试分为 module/unit specs、`server/database/*` local DB specs、`test/unit/postgres-*.spec.ts` PostgreSQL integration specs；migration order、schema、E2 embedding、E3 retrieval 已有专门测试。E4 测试应按相同布局增加，不依赖真实 Zotero API、DeepSeek、Redis 或生产服务。

## 2. Planned Files — create / modify

### 2.1 Create in the future E4 implementation branch

Zotero bounded module：

- `server/modules/zotero/zotero.module.ts`
- `server/modules/zotero/zotero.module.spec.ts`
- `server/modules/zotero/zotero.controller.ts`
- `server/modules/zotero/zotero.controller.spec.ts`
- `server/modules/zotero/zotero.config.ts`
- `server/modules/zotero/zotero.types.ts`
- `server/modules/zotero/zotero.errors.ts`
- `server/modules/zotero/zotero.identity.ts`
- `server/modules/zotero/zotero.identity.spec.ts`
- `server/modules/zotero/zotero-crypto.ts`
- `server/modules/zotero/zotero-crypto.spec.ts`
- `server/modules/zotero/zotero-credential-introspection.client.ts`
- `server/modules/zotero/zotero-credential-introspection.client.spec.ts`
- `server/modules/zotero/zotero-credential-resolver.ts`
- `server/modules/zotero/zotero-credential-resolver.spec.ts`
- `server/modules/zotero/zotero-connection.repository.ts`
- `server/modules/zotero/zotero-connection.repository.spec.ts`
- `server/modules/zotero/zotero.client.ts`
- `server/modules/zotero/zotero.client.spec.ts`
- `server/modules/zotero/zotero.metadata.ts`
- `server/modules/zotero/zotero.metadata.spec.ts`
- `server/modules/zotero/zotero-source.service.ts`
- `server/modules/zotero/zotero-source.service.spec.ts`
- `server/modules/zotero/zotero-attachment.service.ts`
- `server/modules/zotero/zotero-attachment.service.spec.ts`
- `server/modules/zotero/zotero-import.service.ts`
- `server/modules/zotero/zotero-import.service.spec.ts`
- `server/modules/zotero/zotero-http.test-fixtures.ts`

Database/integration tests and migration artifacts，只有在 implementation authorization 后创建：

- `test/unit/postgres-e4-migration-order.spec.ts`
- `test/unit/postgres-e4-zotero.integration.spec.ts`
- `test/unit/zotero-pipeline.integration.spec.ts`
- `drizzle/migrations/0004_e4_zotero_connections.sql`
- `drizzle/migrations/meta/0004_snapshot.json`

### 2.2 Modify in the future E4 implementation branch

- `server/database/schema.ts`：增加 `zotero_connections` 和 KnowledgeDocument external state columns/constraints/indexes。
- `server/database/local-development.database.ts`：使本地 development schema 与 E4 additive columns/table 对齐。
- `server/database/local-development.database.spec.ts`：验证本地 schema、nullable external docs、owner uniqueness。
- `server/modules/knowledge/knowledge.types.ts`：只增加 additive citation fields、generic `KnowledgeDocumentExternalSyncState` 和 generic KnowledgeDocument external fields；不增加任何 Zotero connection/credential/privilege/API DTO 或 provider JSON canonical field。
- `server/modules/knowledge/knowledge.repository.ts`：增加 owner-safe external identity resolve、external state update、transaction/row-lock capable methods、必要的 restore/failure marker methods。
- `server/modules/knowledge/knowledge.repository.spec.ts`：验证新 repository contract 及冲突重读行为。
- `server/modules/knowledge/knowledge.service.ts`：增加在同一 KnowledgeDocument 下创建 next immutable version、state-only update、tombstone/restore 所需的 additive service entry points；保留现有 E1 semantics。
- `server/modules/knowledge/knowledge.service.spec.ts`：增加 unchanged/changed/failed/retry/restore lifecycle tests。
- `server/modules/document-input/document-input.service.ts`、必要时 `document-input.module.ts`：仅在 seam audit 证明必须时，补充 provider-neutral buffered ingestion 与 `removeOwned(userId, documentRef)` compensation seam；优先复用现有 `UploadedDocument` buffer path 和 `DocumentStoragePort.remove`。
- `server/modules/document-input/document-input.service.spec.ts`：验证 external bytes 仍使用现有 20 MB、MIME、storage、verified-read 约束。
- `server/app.module.ts`：注册 `ZoteroModule`，不注册 E2/E3 lifecycle module。
- `package.json`：将 E4 PostgreSQL integration spec 纳入既有 integration command；只有确有需要才增加最小 targeted test script。
- `.github/workflows/*`：仅在现有 workflow 没有通过现有 package script 执行新增 E4 tests 时修改；不改变 runner、部署或 production rollout。
- `drizzle/migrations/meta/_journal.json`：仅在实际创建 `0004` migration 时追加 journal entry，不改既有 entries。

当前计划阶段不创建上述实现文件；本文件是唯一新增 artifact。

## 3. Migration 0004 Plan

### 3.1 Migration audit gate

在写 `0004` 前，重新读取 GitHub `main` 的当前 `schema.ts`、`0001`–`0003` SQL、Drizzle snapshots/journal、KnowledgeDocument repository mapping、local-development schema 与 PostgreSQL migration tests。确认没有另一份未在本审计中发现的 migration 或 external-link contract。若 numbering、字段名、主键类型、现有唯一约束或 E1 repository API 不一致，停止 migration 设计并报告，不生成替代架构。

### 3.2 `zotero_connections`

表必须至少包括：

- `id`
- `user_id`
- `library_type`
- `library_id`
- `ciphertext`
- `nonce`
- `auth_tag`
- `encryption_algorithm`
- `encryption_key_version`
- `key_fingerprint`
- `status`
- `last_checked_at`
- `last_seen_library_version`
- `created_at`
- `updated_at`

字段约束：

- `library_type` 在 E4 v1 只允许 `user`；`library_id` 是由 key introspection authoritative `userID` 派生的稳定字符串，不能使用客户端值。
- `UNIQUE(user_id, library_type, library_id)` 是 connection identity constraint；repository 仍需 owner-safe 查询并检查 authenticated platform user。
- credential plaintext 不落库；ciphertext、nonce、authTag、algorithm 和 encryption key version 分开保存。
- `key_fingerprint` 只用于 rotation/revoke/audit correlation，不是可逆 credential。
- `status` 至少区分 active、disabled、invalid、revoked；具体 transition 由 connection service 集中管理。
- 不建立明文 API key 列，不把 key 放 JSONB、SourceRecord、provenance、errors 或 logs。

### 3.3 `knowledge_documents` additive external state

增加 nullable：

- `external_identity`
- `external_version`
- `external_checksum_algorithm`
- `external_checksum`

并增加 user-scoped unique constraint：`UNIQUE(user_id, external_identity)`。

其语义是 mutable external artifact sync state，不是 KnowledgeDocumentVersion 内容：

- `external_identity`：`zotero:user:<libraryId>:attachment:<attachmentKey>`。
- `external_version`：当前已成功验证并接受的 Zotero attachment object version。
- `external_checksum_algorithm`：E4 v1 为 `md5`。
- `external_checksum`：Zotero upstream md5。

PostgreSQL 的普通 unique constraint 允许多个 `NULL` 值，因此所有既有非 Zotero documents 的 `external_identity = NULL` 可以共存，不会因新增 unique constraint 相互冲突；一旦 external identity 非空，则同一 platform user 下只能有一个对应 KnowledgeDocument。owner-safe lookup 仍必须同时带 `user_id`，不能只按 external identity 查询。

实现时应保持字段整体一致性：无 external identity 的 document 不应带 attachment external version/checksum；external document 只有在成功 validation 后才更新完整 state。数据库 check 可以限制空态/完整态组合，但不得把 immutable version data 放入此 mutable state。

### 3.4 Migration ordering and rollback audit

`0004` 紧跟 `0003_e2_embedding_indexes.sql`，只追加 E4 schema。必须更新 Drizzle snapshot 和 journal，使 migration-order test 能证明 `0001 → 0002 → 0003 → 0004`。down/rollback 方案必须先移除 E4-owned indexes/table/columns，不能删除已有 E1/E2 数据；具体执行前仍须由 migration test 验证。

## 4. Contract Changes

### 4.1 Platform canonical metadata

E1 provenance/lifecycle semantics remain frozen；E4 authorizes a minimal additive metadata-contract extension。

正式 canonical citation field 仍包含：`title`、`authors`、`year`、`venue`、`abstract`、`doi`、`citationKey`；只允许最小增加：`publisher`、`volume`、`issue`、`pages`、`url`、`isbn`、`issn`、`language`。

这些字段必须继续走：`CanonicalField` → assertion references → 既有 resolution/verification semantics。每个新增字段需要明确 value type、空值规则、normalization 和 assertion hash 输入；不得用 arbitrary JSON 扩宽 `MetadataField`。

### 4.2 Zotero-specific metadata

`itemType`、`tags`、`collections`、full creator roles、raw fields、provider-specific relations/dates 在 E4 v1 不进入 canonical validation，也不要求持久化 raw Zotero snapshot。Zotero listing/import 可以在 service 边界内使用受限 upstream DTO；import 后只持久化 canonical citation fields 和 external provenance。

不得定义 `canonicalMetadata.providerMetadata.zotero`，不得添加假定现有 validator 能接受的 namespaced arbitrary JSON assertion。tags、collections、itemType 等 future seam 留待另一个明确批准的 phase。

### 4.3 Bounded-context domain contracts

必须定义以下受限 contract：

- `ZoteroConfig`：固定 API base URL、API version `3`、timeout、最大 response bytes、最大 retries、最大并发 `4`、backoff 上限；不得让调用方改变认证方式。
- `ZoteroConnection`、`ZoteroConnectionStatus`、`ZoteroKeyIntrospectionResult`：只存在于 `server/modules/zotero/zotero.types.ts` 或 Zotero bounded services；包含平台 user owner、`libraryType=user`、authoritative `libraryId`、key fingerprint、encryption key version、status、health timestamps 以及经 adapter 解释的 privileges；不暴露 credential ciphertext 给 controller。
- `ZoteroItemDto`、`ZoteroAttachmentDto`、`ZoteroFileResponse`：只存在于 Zotero bounded context，包含 E4 实际需要的 upstream fields；provider-only fields 可以存在于 ephemeral DTO，但不能自动映射到 canonical metadata。
- `KnowledgeDocumentExternalSyncState`：只存在于 knowledge domain，保持 provider-neutral，仅表示 external identity、external version、checksum algorithm `md5`、upstream checksum 等 mutable artifact sync state；不得出现 ZoteroConnection、Zotero credential、privilege、Zotero status 或 Zotero API DTO。

`knowledge.types.ts` 与 `zotero.types.ts` 的依赖方向保持为：Zotero application service 将受限 Zotero DTO/connection contract 转换为 generic knowledge input；E1 knowledge storage 不反向承载 Zotero connection identity 或 credential domain。

## 5. Work Packages E4.1–E4.10

### E4.1 — Schema and migration contract

**Files:** 先覆盖 `server/database/schema.ts`、`server/database/local-development.database.ts`、对应 specs；在 migration audit gate 通过后才新增 `drizzle/migrations/0004_e4_zotero_connections.sql`、`meta/0004_snapshot.json`、`_journal.json` entry；增加 `test/unit/postgres-e4-migration-order.spec.ts` 和 `test/unit/postgres-e4-zotero.integration.spec.ts`。

**Contract:** 实现本计划第 3 节的 `zotero_connections`、KnowledgeDocument four external fields、两项 user-scoped uniqueness、nullable unique semantics、encrypted credential record 和 E4 status。`zotero_connections` 的所有 connection/credential/status domain types 归属 Zotero bounded context；knowledge schema 只接收 generic KnowledgeDocument external state。KnowledgeDocumentVersion 表结构和 immutable constraints 不得改变其历史含义。

**Tests first:**

- 先写 migration-order test，断言 `0004` 紧跟 `0003`，且 journal/snapshot 一致。
- 先写 PostgreSQL schema test，断言 table/columns/types/nullability/index/unique constraints 存在。
- 先写既有 document compatibility test，插入多个 `external_identity=NULL` document 并确认成功。
- 先写 owner uniqueness test，确认同一 user 同一 attachment identity 冲突、不同 user 可有相同 provider identity。
- 先写 encrypted-record shape test，确认不会落明文 key。

**Implementation:** 通过 Drizzle schema 和 migration additive 更新；同步 local-development schema；补 repository row mapping 所需的 nullable fields。不得修改 `0001`–`0003`，不得引入无关索引或向量结构。

**Completion gate:** migration audit、fresh database migration、existing E1/E2 tests、local DB schema tests 全部通过；`KnowledgeDocumentVersion` immutable tests 未被改变；实际 migration 文件在本阶段之前不得出现。

### E4.2 — Additive E1 metadata contract

**Files:** `server/modules/knowledge/knowledge.types.ts`、`knowledge.repository.ts`、`knowledge.service.ts` 及相邻 specs；必要时更新 canonical metadata fixture。

**Contract:** 仅加入 publisher/volume/issue/pages/url/isbn/issn/language；扩展 `MetadataField`、`CanonicalSourceMetadata`、`CanonicalSourceMetadataInput`、`MetadataAssertionInput` 时保持现有 assertion references、resolutionStatus、verification semantics。provider DTO 不作为 E1 canonical field。

**Tests first:**

- 为每个新增字段先写 accepted value、empty/missing、normalization 和 assertion-reference tests。
- 先写 rejection tests，确认 tags、collections、itemType、raw object、creator-role snapshot、arbitrary JSON 不能通过 canonical validator。
- 先写 regression tests，确认旧七个字段的 equality、conflict、unresolved/resolved 行为不变。
- 先写 assertion hash/revision test，确认新增字段改变时按 E1 语义产生新的 metadata assertion 状态，而不改变 immutable document version。

**Implementation:** 使用与现有 field resolver 相同的 typed union 和 canonical field map；Zotero metadata normalizer 只输出允许的 citation fields，所有 provider-only fields 丢弃或只在请求生命周期内使用，不创建 snapshot 表。

**Completion gate:** E1 既有 tests 与新增 tests 通过；类型检查确认没有 `Record<string, unknown>` 绕过 canonical contract；没有 `ZoteroReference` 类型或 providerMetadata JSONB。

### E4.3 — Credential introspection, authority, encryption

**Files:** `zotero.config.ts`、`zotero.types.ts`、`zotero.identity.ts`、`zotero-credential-introspection.client.ts`、`zotero-credential-resolver.ts`、`zotero-connection.repository.ts`、`zotero-crypto.ts` 及其 specs。

**Contract:** `POST /api/zotero/connection` 只接收 apiKey。流程固定为：apiKey → `ZoteroCredentialIntrospectionClient` → `GET /keys/current`，使用 `Zotero-API-Key` 与 `Zotero-API-Version: 3` → authoritative `userID` + `access.user.library`/`access.user.files` 经 adapter 校验 → `libraryType=user`、`libraryId=authoritative userID` → header-authenticated `/users/<derivedUserId>/items` capability check → encrypted persistence。`ZoteroConnection`、`ZoteroConnectionStatus`、`ZoteroKeyIntrospectionResult` 和所有 Zotero API DTO 只由 `zotero.types.ts` 及 Zotero bounded services 承载；不得加入 `knowledge.types.ts` 或 E1 provenance。`access.user.notes`、`access.user.write` 和 group access 可由窄 DTO 接收但不改变 E4 v1 的 read-only personal-library scope；introspection client 是唯一 credential introspection 边界。

**Tests first:**

- 先写 introspection fixture test，使用官方 v3 `/keys/current` response contract 的 fixture，验证 authoritative userID extraction。
- 先写 privilege adapter test，验证 `access.user.library === true` 与 `access.user.files === true` 的 interpretation 集中在 adapter；业务代码不能读取未经 adapter 解释的 raw privilege property。`notes`、`write` 和 group access 不得被误用为 E4 v1 的准入条件。
- 先写 API-key-only input test，拒绝 client userId/libraryId/owner override。
- 先写 secret-handling tests，覆盖 `Zotero-API-Key` header redaction、exception message、tracing/APM span、proxy/debug output、metrics labels；所有输出都不得含 API key。`/keys/current` 本身不携带 key，不增加针对 secret-bearing path 的特殊处理。
- 先写 encryption round-trip、wrong key version、auth-tag failure、key rotation/revoke 和 fingerprint non-reversibility tests。
- 先写 connection uniqueness/status/health persistence tests。

**Implementation:** 通过 encryption abstraction 保存 ciphertext、nonce、authTag、algorithm、key version、fingerprint；CredentialResolver 只返回短生命周期的 in-memory credential；connection repository 只返回安全 domain record。introspection 与普通请求统一注入 `Zotero-API-Key` 和 `Zotero-API-Version: 3` headers；transport 层统一执行 auth-header redaction。

**Completion gate:** 任何 returned error、metric、trace 或 logger 事件均通过 secret/header redaction test；authoritative identity 不能被客户端控制；无 query-string key；`/keys/current` 使用正确 headers；active/disabled/invalid/revoked 状态 transition 有明确测试。

### E4.4 — Zotero Web API v3 client

**Files:** `zotero.client.ts`、`zotero.types.ts`、`zotero.config.ts`、client specs 和 HTTP fixtures。

**Contract:** 支持 personal library items、单 item、children、attachment item、attachment version discovery、`/file` bytes；支持在需要判断 trash 状态时使用 `includeTrashed=1`；`/deleted?since=<libraryVersion>` 仅作为 future seam，不在 E4 v1 实现完整 deletion engine。每个请求带 `Zotero-API-Version: 3`；认证带 `Zotero-API-Key`；分页使用 upstream pagination headers/metadata；不把 key 放 query string。

**Tests first:**

- 先写 header/query assertion，确认 `/keys/current` 与普通 API 请求都带 API version/auth headers，且 URL query 没有 key。
- 先写 pagination tests，覆盖 empty、multi-page、malformed pagination 和 bounded page size。
- 先写 timeout、429、503、Retry-After、bounded exponential backoff 和 retry exhaustion tests。
- 先写 response size/content-type/status validation tests，确认 file endpoint 不被当成普通 JSON item。
- 先写 bounded concurrency test，确认 attachment/version discovery 并发不超过 `4`，且不创建 queue/Redis。

**Implementation:** 封装单一 HTTP transport、timeout、retry policy、backoff、Retry-After 解析、DTO validation 和 provider error translation。不得让业务 service 直接拼接 secret-bearing path；introspection client 与普通 client 的 URL/logging policy 分离。

**Completion gate:** client unit tests 全通过；所有 retry 都有上限；429/503 不会无限重试；`includeTrashed=1` 只能按显式 status-discovery contract 使用；`/deleted?since=` 不被当作已实现的 full-library deletion sync；无真实 Zotero endpoint 调用；类型层不暴露任意 raw response 给 E1。

### E4.5 — Metadata normalization and SourceRecord resolution

**Files:** `zotero.metadata.ts`、`zotero-source.service.ts`、knowledge repository/service additive methods 及相邻 specs。

**Contract:** 一个 bibliographic Zotero item 对应一个 SourceRecord；stable parent identity 为 `user:<libraryId>:item:<itemKey>`，存为 bibliographic external provenance/link，不把 attachment identity 混入 SourceRecord。item status discovery 在需要判断 trash 时使用能返回 trash 状态的 contract（例如 `includeTrashed=1`）。普通 `404 / item not found` 只表示本次请求无法观察到 item，绝不等同于 tombstone 或 permanent deletion。只有 upstream 明确标示 item 已进入 Zotero trash 时，才允许 tombstone affected KnowledgeDocument；SourceRecord 默认保留。canonical metadata 只输出第 4.1 节允许字段；provider-only metadata 不持久化。

**Tests first:**

- 先写 normalization fixture tests，覆盖 creators、date/year、DOI、citationKey、venue 和新增 citation fields。
- 先写 invalid metadata tests，确认 malformed upstream value 映射为 `ZOTERO_METADATA_INVALID`，不写半成品 SourceRecord。
- 先写 first import、same parent version、changed parent version、ordinary 404/no-tombstone 和 explicitly trashed parent tests。
- 先写 concurrent same-parent import test，模拟 unique arbitration；一个请求成功插入，另一个 loser reread 同一 SourceRecord 并将 collision 正常化为成功。
- 先写 owner isolation test，确认不同 platform user 不能通过相同 itemKey 或 external identity 读取/更新 SourceRecord。

**Implementation:** 在 repository 增加 owner-safe external identity resolve/upsert；通过 DB unique constraint 仲裁并发，捕获预期 unique conflict 后 reread 并验证 owner/kind。metadata refresh 仅由 parent item version 决定；attachment discovery 不得依赖 parent refresh 是否发生。普通 not-found 不触发 tombstone；显式 trashed parent 默认保留 SourceRecord，分别处理其 affected attachments；`/deleted?since=<libraryVersion>` 仅记录为 future seam，不能在 E4 v1 猜测永久删除。

**Completion gate:** SourceRecord 不重复、不跨 owner；metadata assertions 按 E1 semantics 更新；provider snapshot 不落库；ordinary 404 不 tombstone；explicit trash 状态只影响对应 attachment document；parent metadata refresh 与 attachment sync 的调用路径已经分离。

### E4.6 — Independent attachment discovery and external sync state

**Files:** `zotero-attachment.service.ts`、knowledge repository/service additive methods、KnowledgeDocument types/specs、E4 PostgreSQL integration spec。

**Contract:** stable attachment identity 为 `zotero:user:<libraryId>:attachment:<attachmentKey>`。attachment discovery 每次都执行，即使 parent item version unchanged。比较维度为 `libraryType`、`libraryId`、`attachmentKey`、observed attachment externalVersion 和 persisted upstream md5。attachment status discovery 在需要判断 trash 时使用 `includeTrashed=1` 或等价能明确返回 trash 状态的 API contract；ordinary 404 不触发 tombstone；只有 upstream 明确为 trashed 才能 tombstone 对应 KnowledgeDocument。

**Tests first:**

- 先写 parent unchanged but attachment discovery test。
- 先写 attachment external version unchanged → no download test。
- 先写 version changed → fetch/check test。
- 先写 changed upstream version/md5 but downloaded SHA-256 unchanged → only update KnowledgeDocument external state、no new KnowledgeDocumentVersion test。
- 先写 changed SHA-256 → same KnowledgeDocument、new immutable version、old version/chunks/provenance retained test。
- 先写 failed download/validation test，确认 externalVersion/md5 仍保持上一次 accepted state。
- 先写 concurrent attachment create/update test，确认 unique collision loser reread existing document；state update 使用 row lock/transaction，不覆盖较新的 accepted state。
- 先写 ordinary 404 → no tombstone test。
- 先写 explicitly trashed attachment → only affected KnowledgeDocument tombstone test。
- 先写 one attachment trashed → sibling attachment documents and SourceRecord retained test。
- 先写 restored active attachment → restore same KnowledgeDocument test。
- 先写 tombstone/restore identity and history test，确认 external identity 仍 owner-scoped、不创建第二份 document，且 versions/chunks/provenance intact。

**Implementation:** 将 external state 作为 `knowledge_documents` 的唯一 authoritative persistence。下载和 checksum verification 在 DB transaction 外完成；只有 C4/C1/C2/C3/E1 validation 成功后，才在同一 transaction 中更新 external state，并按 SHA-256 是否改变决定 state-only 或 new immutable version。explicit trash 只更新对应 KnowledgeDocument lifecycle；SourceRecord 默认保留，siblings 独立处理。后续 active 观察到相同 identity 时 restore 原 document；不得创建第二个 document。永久 remote deletion detection deferred，不根据 404 推断。

**Completion gate:** 不存在 parent-version shortcut；重复 sync 在 state 相同后不下载；upstream version 已前进且 SHA 未变时不会反复下载；旧 immutable data 不被覆盖；ordinary 404 不 tombstone；explicit trash/restore 与 sibling isolation 通过；失败不会 advanced state。

### E4.7 — Stored PDF ingestion through C4

**Files:** `zotero-import.service.ts`、`document-input.service.ts`、必要时 `document-input.module.ts`、对应 specs、pipeline fixture 和 integration spec。`removeOwned(userId, documentRef)` 必须放在 C4 provider-neutral service 中，不得放在 Zotero module 或创建 Zotero-specific filesystem writer。

**Contract:** 只允许 Zotero `imported_file` 和 `imported_url` 中已被 E4 policy 明确接受为 stored PDF 的 attachment。拒绝 linked_file、linked_url、snapshot、notes、annotations 和任意 URL fetch。流程为：download → integrity validation → C4 durable upload → receive `DocumentInputRef` → C4 verified read → C1 → C2 → C3 → E1 transaction。若 C4 upload 已成功而后续 readVerified、C1/C2/C3 或 E1 transaction 失败，则执行 `removeOwned(userId, documentRef)` 的 best-effort compensation，保留原始 E4/E1 error 和 previous accepted KnowledgeDocument state；若 E1 commit 成功，则保留 artifact，`sourceArtifactRef` 指向 accepted artifact。`removeOwned` 必须复用现有 DocumentInputRef owner validation，验证 provider、bucket、canonical user-scoped path 和当前 user ownership，最终调用既有 `DocumentStoragePort.remove()`；caller 不能提交任意 filesystem path 或 bucket。user-upload 等既有 C4 semantics 不改变。

**Tests first:**

- 先写 C4 seam test，确认 Zotero 可以调用现有 server-side buffer `DocumentInputService.upload`/`DocumentStoragePort.upload`，不模拟 multipart controller，不复制 storage implementation。
- 先写 upload-success/downstream-failure test，确认 C1/C2/C3/E1 任一步失败都会调用 `removeOwned` best-effort，并保留 previous state。
- 先写 cleanup-failure test，确认 remove 本身失败时原始 import error 仍是 authoritative error，external state/activeVersion 不变。
- 先写 successful-import retention test，确认 E1 commit 成功后 artifact 保留，`sourceArtifactRef` 指向该 artifact。
- 先写 retry compensation test，确认失败重试不会无限积累 orphan artifacts。
- 先写 ownership and path-safety tests：另一用户的 DocumentInputRef 被拒绝；arbitrary/noncanonical ref 被拒绝且不调用 storage deletion。
- 先写 20 MB boundary、oversize、MIME mismatch、non-PDF、filename normalization 和 empty bytes tests。
- 先写 imported_file/imported_url accepted 与 linked/snapshot/notes/annotations rejected tests。
- 先写 upstream md5/ETag mismatch → `ZOTERO_ATTACHMENT_INTEGRITY_FAILED`，且不激活新 version tests。
- 先写 verified storage read-back hash test。

**Implementation:** 复用 C4 的 bucket/path、durable storage、size/type validation、verified read 和 C1 parser；必要的 provider-neutral seam 只补 C4，不在 Zotero module 中实现 storage。`removeOwned` 先复用 DocumentInputRef owner/path validation，再调用既有 `DocumentStoragePort.remove`；cleanup 为 best-effort，cleanup failure 只记录安全诊断并不覆盖原始错误。禁止 caller 自带 path/bucket，禁止 Zotero-specific filesystem writer、parser/chunker 和任意远程 URL downloader。network/storage 不进入 DB transaction。

**Completion gate:** 现有 C4 tests 全通过；stored PDF 才能继续进入 E1；C4 upload 后 downstream failure 会 best-effort remove artifact；cleanup failure 不掩盖原始错误；成功 E1 commit 保留 artifact；retry 不产生无界 orphan accumulation；ownership/arbitrary-ref safety tests 通过；任何下载失败、超过 20 MB、类型不符或完整性失败都不修改 accepted external state 或 activeVersion。

### E4.8 — E1 lifecycle and version persistence

**Files:** `knowledge.service.ts`、`knowledge.repository.ts`、knowledge types/specs、pipeline integration spec。

**Contract:** 复用 KnowledgeDocument、`createNextVersion`/等价 E1 API、immutable KnowledgeDocumentVersion、chunks、activeVersion、knowledge_imports 和 readiness lifecycle。定义：首次导入、unchanged state-only、changed bytes new version、partial import、parser failure、retry、ordinary not-found、explicit trash tombstone、restore，以及 C4 artifact compensation。ordinary `404 / item not found` 不是 tombstone；只有 upstream 明确 trash 状态才 tombstone affected KnowledgeDocument。SourceRecord 默认保留；一个 attachment trash 不影响 sibling documents 或 bibliographic SourceRecord；active identity 后续恢复时 restore 原 KnowledgeDocument。永久删除依赖可靠 library-version cursor 与 `/deleted?since=<libraryVersion>`，因此 deferred，不在 E4 v1 实现。新 active version 只能在 C4 durable storage、verified read、C1、C2、C3 和 E1 persistence 全部成功后激活；E1 commit 成功后不得 cleanup，E1 commit 之前任何 downstream failure 都必须 best-effort cleanup 已上传 artifact。

**Tests first:**

- 先写 first import → one document/one version/ready-for-indexing test。
- 先写 same SHA → no new version but state advanced test。
- 先写 changed SHA → version number/fingerprint/chunks/provenance immutable retention test。
- 先写 C1/C2/C3/E1 partial failure test，确认 activeVersion 不提前切换，old accepted version retained。
- 先写 C4 artifact compensation test，确认 upload 成功后 downstream failure 调用 provider-neutral `removeOwned`；cleanup failure 不改变原始错误、external state 或 activeVersion。
- 先写 retry after failure and idempotency marker test。
- 先写 404 → no tombstone test。
- 先写 explicitly trashed parent/attachment → correct affected document tombstone test。
- 先写 one attachment trashed → sibling documents/source retained test。
- 先写 restored upstream item → restore same document test。
- 先写 immutable history retention test，确认 versions/chunks/provenance remain intact。
- 先写 explicit E2 boundary test，确认 E4 pipeline 不调用 indexing module/lifecycle。

**Implementation:** 以现有 `KnowledgeService.importDocument` 和 `createNextVersion` 为基础增加 external-document resolve/state-only path；补充 transaction-aware repository operations。E2 仅在 document ready-for-indexing 后由既有独立流程处理，E4 不等待或回滚 E2。

**Completion gate:** immutable version/chunks/provenance 永不 update/delete；state-only 更新不改变 version count；pipeline failure 不会污染 active version；import success 和 indexing success 可分别观测。

### E4.9 — REST API and module wiring

**Files:** `zotero.controller.ts`、`zotero.module.ts`、controller/module specs、`server/app.module.ts`、必要的 auth/request-context adapter。

**Contract:** 提供：

- `POST /api/zotero/connection`
- `GET /api/zotero/connection/health`
- `DELETE /api/zotero/connection`
- `GET /api/zotero/items`
- `POST /api/zotero/items/:itemKey/import`
- `POST /api/zotero/items/:itemKey/sync`
- `POST /api/zotero/attachments/:attachmentKey/import`

所有 owner 取自 authenticated request context。connection POST body 只含 apiKey；最终 libraryId 来自 introspection。任何 response 都不得返回 key、ciphertext、nonce、authTag、完整 secret-bearing URL 或 raw privilege secret。

**Tests first:**

- 先写 route/method/status/validation tests。
- 先写 authenticated owner isolation tests，拒绝 body/query/path 中的 platform userId/libraryId override。
- 先写 connection health tests，区分 active、disabled、invalid、revoked、insufficient privilege。
- 先写 import/sync response tests，确认 import success 不伪装成 indexing success。
- 先写 error serialization tests，确认错误 code 可供客户端处理但 message 不含 secret/upstream full URL。
- 先写 module wiring test，确认只依赖 C4/C1/C2/C3/E1，不依赖 E2/E3。

**Implementation:** controller 只负责 DTO validation、authenticated context、调用 application service 和错误映射；所有 identity/privilege/secret/transaction logic 留在 bounded services/repositories。将 `ZoteroModule` 注册到 app，但不改变 E3 module 或 E2 lifecycle。

**Completion gate:** endpoint contract、authorization、redaction、module dependency tests 全通过；没有新的 auth repair、frontend clone 或 production deployment wiring。

### E4.10 — Full integration, regression and CI gate

**Files:** `test/unit/postgres-e4-zotero.integration.spec.ts`、`test/unit/zotero-pipeline.integration.spec.ts`、existing E1/C4 regression specs、`package.json`、必要时 `.github/workflows/*`。

**Contract:** 用 fake Zotero transport 和 fake C4 storage 复现完整路径：fake Zotero → attachment bytes → C4 durable storage → C1 → C2 → C3 → E1 → ready-for-indexing；E2 不被调用。PostgreSQL 使用真实 migration/constraints/transactions，不能用真实 Zotero、DeepSeek 或 production service。

**Tests first:**

- 先写 fake transport pipeline test，覆盖 first import、duplicate import、parent metadata refresh、attachment independent sync、SHA unchanged、SHA changed。
- 先写 migration/constraint/owner isolation/concurrent SourceRecord and KnowledgeDocument resolve tests。
- 先写 external state advanced only after successful download/validation test。
- 先写 immutable version/chunks/provenance retention test。
- 先写 tombstone/restore and retry test。
- 先写 E1/E2/E3/E4 regression command coverage。

**Implementation:** 将 E4 integration spec 纳入既有 PostgreSQL integration command；保持 test fixtures deterministic；CI 继续使用 PostgreSQL + pgvector 既有路径，不增加 Redis/queue/vector index/real provider dependency。

**Completion gate:** targeted unit、PostgreSQL integration、full test、lint、typecheck、server/client build、bootstrap 和既有 E1/E2/E3 regression 全部通过；失败时停止进入 Review Candidate。

## 6. Transaction Boundaries

| Operation | Outside transaction | Single transaction / atomic write | Failure rule |
|---|---|---|---|
| Connection create/refresh | `/keys/current` introspection with auth header、privilege check、derived-library capability check、encryption preparation | insert/upsert `zotero_connections`、status/timestamps/fingerprint/key version | validation 失败不写 active connection；旧 active credential 保留到新 credential 验证成功 |
| Parent metadata sync | Zotero listing/item fetch、normalization | owner-safe SourceRecord resolve、assertions、external link/version update | invalid metadata 不产生半成品 source；unique loser rereads and succeeds |
| Attachment discovery | children/version discovery、file metadata fetch | only accepted external state/document metadata write | parent unchanged 也必须 discovery；discovery failure 不清空旧 state |
| Attachment import | bounded download、size/MIME/md5/SHA check、C4 upload/read、C1/C2/C3 | KnowledgeDocument resolve、KnowledgeDocumentVersion/chunks/provenance/import marker、activeVersion 和 external state | activeVersion/external state 只在全链路成功后更新；upload 后 downstream failure best-effort `removeOwned` |
| SHA unchanged | bytes validation outside transaction | externalVersion/upstream md5 state-only update | 不创建 version/chunks |
| SHA changed | full validation outside transaction | create immutable next version + state update + active transition | old version stays active/retained if any step fails |
| Tombstone/restore | status observation via `includeTrashed=1` or equivalent | affected document lifecycle transition under owner lock | ordinary 404 does nothing; explicit trash affects only that document; restore reuses identity; old immutable history retained |

Attachment state update 必须在 transaction 内对目标 KnowledgeDocument 做 owner-safe lookup，并在并发 sync 时使用 row lock 或等价 compare-and-update，避免旧请求覆盖已接受的新 externalVersion。外部 HTTP/storage 不得持有 DB transaction。

C4 compensation 不得扩大 DB transaction：C4 upload 先在 transaction 外完成，随后 readVerified/C1/C2/C3/E1 失败时，在 catch/failure path 调用 provider-neutral `removeOwned(userId, documentRef)`。cleanup 必须 best-effort；remove failure 不能覆盖原始 import error，也不能推进 external state/activeVersion。只有 E1 transaction commit 成功后才 retain artifact 并让 `sourceArtifactRef` 指向它。

## 7. Concurrency / Idempotency Strategy

- SourceRecord identity 由 `(platformUserId, provider, parentExternalIdentity)` 语义确定；数据库 external-link unique constraint 负责最终仲裁。竞争 insert 的 loser 重新读取并验证 owner/kind 后正常返回，不把预期 collision 作为用户错误。
- KnowledgeDocument identity 由 `(platformUserId, externalIdentity)` 确定；数据库 unique constraint 负责并发 create。loser 重新读取既有 document，再进入 version/state decision。
- attachment state decision 必须在目标 document 行锁下基于 persisted externalVersion/md5 重新判断；禁止使用 transaction 外的 stale read 直接覆盖状态。
- parent metadata idempotency 与 attachment sync idempotency 分离。parent 请求 fingerprint 可以沿用 `knowledge_imports`；attachment marker 至少包含 attachment identity、observed externalVersion、observed upstream md5 和 operation kind，不得只依赖 parent version。
- Duplicate import 在 state 未变时返回已有 document/readiness；state changed but SHA unchanged 只更新 state；state changed and SHA changed 只创建一个 next version。
- 失败 marker 可以记录失败结果用于 retry，但失败不能推进 accepted external state；retry 必须重新读取 upstream state 和 persisted state。
- 不引入分布式 lock、Redis、queue 或 worker scheduler；bounded HTTP concurrency 最大为 4。

## 8. Credential / Secret Security

- `/keys/current` 仅由 `ZoteroCredentialIntrospectionClient` 调用，并使用 `Zotero-API-Key` 与 `Zotero-API-Version: 3` headers；该 client 使用不含 secret 的 logical operation name 记录 telemetry。该 route 不携带 path secret，因此不增加 path-specific secret redaction/access-log/proxy handling。
- exception 对外只返回稳定 E4 error code 和安全 message；不得返回 API key、auth header、上游 response body 或 header dump。
- 普通 API 请求使用 `Zotero-API-Key` 与 `Zotero-API-Version: 3` headers；任何 code review/test 都应断言 URL query 不含 key，且 HTTP/access log、exception、tracing/APM、proxy/debug output 和 metrics labels 均执行 auth-header/key redaction。
- server-side encrypted credential 使用 authenticated encryption abstraction，至少持久化 ciphertext、nonce、authTag、algorithm、encryption key version；不能只保存无法 rotation 的 opaque encrypted string。
- resolver 解密只在调用 upstream 的短生命周期内保留 key；controller、SourceRecord、KnowledgeDocument、provenance、import marker、logs 和 metrics 均不接收 plaintext key。
- `keyFingerprint` 使用不可逆、适合识别 rotation/revoke 的 fingerprint 机制；不把原 key 作为 fingerprint。
- rotation 先 introspect/privilege-check/derived identity/capability-check，再原子替换 encrypted record；旧 credential 在成功切换前仍可用。revoke/disable 后所有 sync/import 明确返回 `ZOTERO_CONNECTION_DISABLED` 或对应安全错误。
- secrets 不进入测试快照；测试只使用 synthetic keys，并检查日志/traces/metrics redaction。

## 9. Error Model

内部使用 typed Zotero errors，controller 只输出稳定 `code`、安全 `message`、可选 retry hint 和 request correlation id。建议 code 与 HTTP mapping：

| Error code | HTTP | Retry | Meaning |
|---|---:|---|---|
| `ZOTERO_INVALID_CREDENTIAL` | 401 | no | key invalid/expired 或 introspection 无法认证 |
| `ZOTERO_INSUFFICIENT_PRIVILEGES` | 403 | no | key 不具备 E4 所需 library/files read capability |
| `ZOTERO_CONNECTION_DISABLED` | 409 | no | platform-side disabled/revoked connection |
| `ZOTERO_ITEM_NOT_FOUND` | 404 | no | item 不属于 authoritative personal library、普通请求中不可见或已不存在；ordinary 404 不等同于 tombstone |
| `ZOTERO_ATTACHMENT_UNSUPPORTED` | 422 | no | non-stored/non-PDF/notes/annotations/linked/snapshot attachment |
| `ZOTERO_ATTACHMENT_UNAVAILABLE` | 502 | bounded | upstream attachment metadata/file unavailable |
| `ZOTERO_ATTACHMENT_TOO_LARGE` | 413 | no | exceeds C4 20 MB limit |
| `ZOTERO_ATTACHMENT_INTEGRITY_FAILED` | 422 | bounded | md5/ETag/bytes validation failed |
| `ZOTERO_RATE_LIMITED` | 429 | yes | upstream 429；保留安全 retry hint，不暴露 key/path |
| `ZOTERO_UPSTREAM_TIMEOUT` | 504 | yes | bounded timeout exhausted |
| `ZOTERO_UPSTREAM_FAILED` | 502 | bounded | non-success upstream response after policy |
| `ZOTERO_METADATA_INVALID` | 422 | no | upstream item cannot satisfy typed canonical contract |

错误处理规则：

- 401/403/disabled 是 connection-level failure，不能创建或激活 import state。
- item not found 可将本次操作报告为 not found；不得误删 SourceRecord 或 KnowledgeDocument。
- ordinary 404 永远不触发 tombstone、删除 version/chunks/provenance 或 permanent deletion 推断。
- 只有 upstream 通过 `includeTrashed=1` 或等价 contract 明确表明 item/attachment 已进入 Zotero trash 时，才可 tombstone affected KnowledgeDocument；SourceRecord 默认保留，一个 attachment trash 不影响 sibling documents。
- 后续再次观察到相同 external identity 为 active 时，restore 原 KnowledgeDocument；不得创建第二个 document。`/deleted?since=<libraryVersion>` 依赖可靠 cursor，E4 v1 不实现 full-library deletion engine。
- attachment unsupported/unavailable/integrity/too-large 是 attachment-level failure；旧 accepted version/state 保留，不能报告 ready-for-indexing。
- C4 upload 成功后 readVerified、C1/C2/C3 或 E1 失败，必须尝试 `removeOwned`；cleanup failure 不掩盖原始错误。原始 accepted external state、activeVersion、旧 versions/chunks/provenance 保持不变；E1 commit 成功后不得 cleanup。
- `removeOwned` 的 owner/provider/bucket/canonical user-scoped path validation 失败时不得删除任何 artifact，并返回安全的 C4/E4 failure；caller 不能指定任意 filesystem path 或 bucket。
- 429/timeout/upstream 5xx 只做 bounded retry；超过上限返回稳定 code，禁止无限重试。
- metadata invalid 不写半成品 canonical assertion；provider raw response 不进入 returned error。

## 10. Test Matrix

| Area | Required tests | Location |
|---|---|---|
| Schema/migration | 0001→0004 order、fresh migration、columns、indexes、nullable unique、connection unique | `test/unit/postgres-e4-migration-order.spec.ts`, `test/unit/postgres-e4-zotero.integration.spec.ts` |
| Local DB | E4 table/columns、legacy document compatibility、owner uniqueness | `server/database/local-development.database.spec.ts` |
| Canonical metadata | eight additive fields、typed values、assertion references、resolution regression、provider JSON rejection | `server/modules/knowledge/knowledge.repository.spec.ts`, `knowledge.service.spec.ts`, `zotero.metadata.spec.ts` |
| Identity | authoritative userID、stable parent/attachment identity、client override rejection、owner-safe lookup；Zotero connection types 不进入 knowledge types | `zotero.identity.spec.ts`, controller/repository/module specs |
| Credential | fixture introspection、privilege adapter、encryption round trip/rotation/revoke、all redaction surfaces | credential/crypto/introspection specs |
| HTTP client | v3/header auth、no query key、pagination、timeout、429/503/Retry-After、bounded retry/concurrency | `zotero.client.spec.ts` |
| Source resolution | first/same/changed parent、concurrent collision、metadata invalid、ordinary 404/no tombstone、explicit trash、cross-owner isolation | `zotero-source.service.spec.ts`, PostgreSQL integration |
| Attachment state | parent unchanged discovery、version unchanged skip、version changed fetch、md5/SHA split、failed state preservation、concurrent update、trash sibling isolation、restore same document | `zotero-attachment.service.spec.ts`, PostgreSQL integration |
| C4 pipeline | stored PDF policy、20 MB、MIME/name、md5/SHA, durable storage, verified read, C1/C2/C3/E1 handoff、upload-success/downstream-failure compensation、cleanup failure、successful retention、retry orphan bound、owner/path safety | `document-input.service.spec.ts`, `zotero-import.service.spec.ts`, `test/unit/zotero-pipeline.integration.spec.ts` |
| E1 lifecycle | immutable version/chunks/provenance、active transition、state-only update、retry、C4 compensation、404 no tombstone、explicit trash tombstone、sibling retention、restore same document | knowledge service specs, pipeline integration |
| E2 boundary | E4 does not call indexing/embedding/queue; readiness is `ready-for-indexing` | pipeline/module integration |
| REST | route validation、auth context、safe responses、error mapping、health/status | controller/module specs |
| Regression | E1/E2/E3 existing suites、full app bootstrap、lint/typecheck/build | existing scripts and CI |

必须包含以下行为断言：

1. parent version unchanged 时 attachment version discovery 仍发生。
2. attachment externalVersion unchanged 时不下载。
3. attachment externalVersion changed 但 SHA-256 相同，不新增 KnowledgeDocumentVersion，只更新 `knowledge_documents` external state。
4. SHA-256 改变时同一 KnowledgeDocument 新增 immutable version，旧版本/chunks/provenance 保留。
5. 下载或 C4/C1/C2/C3/E1 任一步失败时 accepted external state 和 activeVersion 不提前推进。
6. 连接最终 libraryId 必须由 `/keys/current` response 的 authoritative `userID` 派生，且 `access.user.library`、`access.user.files` 均为 true。
7. 任意日志、错误、trace、proxy/debug、metrics 中不得出现 API key。
8. ordinary 404 不触发 tombstone；explicit trash 只 tombstone affected document；restore 复用 same external identity，历史 versions/chunks/provenance 保持。
9. C4 upload 后 downstream failure best-effort remove artifact；cleanup failure 保留原始 error，成功 E1 commit 保留 artifact；arbitrary/other-owner ref 不触发删除。

## 11. CI Verification

实施完成后，按项目现有命令顺序验证：

1. targeted Zotero/knowledge/C4 unit specs，使用 Jest in-band。
2. `npm run test:integration:postgres`，其中包含 schema、E2、E3 和新增 E4 PostgreSQL specs。
3. `npm test -- --runInBand`。
4. `npm run lint`。
5. `npm run type:check`。
6. `npm run build:server`。
7. `npm run build:client`。
8. `npm run test:app-bootstrap`。

CI 必须在 PostgreSQL + pgvector 既有环境执行真实 migration 和 owner/concurrency tests；fake Zotero transport 替代真实外网。若本地没有 PostgreSQL，允许记录 integration skipped，但 Review Candidate 不能在 CI integration 未通过时提出。不得引入真实 Zotero key、DeepSeek key、Redis、queue、ECS 或 production deployment 检查。

## 12. Scope Freeze

本 implementation plan 明确不包含：

- E2 redesign、E2 lifecycle ownership、E3 changes 或 retrieval behavior changes。
- E5 search、E6 grounded generation、RAG、citation generation、reranker。
- group library、shared library、Zotero Desktop Local API。
- notes、annotations、highlights、snapshots、linked files、linked URLs、arbitrary URL fetching。
- tags、collections、itemType、raw Zotero snapshot、full creator-role snapshot 的持久化。
- `ZoteroReference` model、providerMetadata arbitrary JSON、canonical validator bypass。
- Redis/BullMQ/queue/worker scheduler、新 vector DB、HNSW/IVFFlat 或其他索引改造。
- unrelated auth repair、frontend clone、ECS/production rollout、real-provider integration tests。
- 改写 E1 immutable version semantics、删除旧版本/chunks/provenance、把 import success 等同 indexing success。
- 除 E4 minimal migration 和 C4 provider-neutral buffered seam 之外的 schema/storage refactor。

任何超出上述范围的需求必须停止当前 E4 实施并获得新的架构批准。

## 13. Risks / Stop Conditions

- 若 GitHub `main` schema、migration numbering、E1 repository API 与本审计不一致：停止，不猜测、不改架构。
- 若 `/keys/current` 实际响应字段与所采用的官方 v3 fixture 不一致：停止 privilege interpretation，更新 adapter contract 后重新审查；不得在业务层散布未经确认的字段名。
- 若 `/keys/current` 未能同时确认 authoritative `userID`、`access.user.library=true` 和 `access.user.files=true`：停止 connection activation，不接受 client-supplied identity 或 privilege 作为替代。
- 若 authenticated request context 不能可靠提供 platform user owner：停止 API 实施；不得接受 client owner 字段作为替代。
- 若 C4 无法安全复用 server-side buffer path，且新增 seam 会复制 storage logic：停止并提交最小 seam 设计供审查。
- 若 C4 compensation 无法复用 DocumentInputRef owner/provider/bucket/canonical path validation，或需要 Zotero-specific filesystem writer/storage provider：停止并重新审查 seam；不得扩大 storage architecture。
- 若 PostgreSQL nullable unique semantics、owner-safe lookup 或 row locking 不能覆盖并发状态更新：停止 attachment state implementation。
- 若 upstream md5/ETag 与下载 bytes 不一致：保留旧 state，返回 integrity error，不创建新 active version。
- 若任何 secret 出现在 URL/log/error/trace/metrics：立即停止并修复 redaction tests/transport boundary。
- 若 ordinary 404 被实现为 tombstone，或 explicit trash 影响了 SourceRecord/sibling attachments，立即停止并修复 lifecycle boundary。
- 若没有可靠 library-version cursor 却实现 `/deleted?since=` permanent deletion：立即停止并删除该超出 E4 v1 的行为。
- 若 C4 upload 后 downstream failure 未触发 best-effort cleanup、cleanup failure 覆盖原始错误、或成功 E1 commit 后错误 cleanup artifact：停止并修复 compensation boundary。
- 若发现需要 E2、E3、Redis、queue、new vector index 或 production deployment 才能完成 E4：视为 scope violation，停止。
- 若 migration、unit、integration、full regression、lint、typecheck、build 或 bootstrap 任一失败：不能标记 Review Candidate。

## 14. Exact Implementation Order

未来获得 `PHASE_E4_IMPLEMENTATION_AUTHORIZED` 后，严格按以下顺序执行；每个 WP 内先落测试/contract assertions，再写实现，再运行 completion gate：

1. 确认 `main` 仍为 accepted baseline，并核对 GitHub 与本地状态。
2. 执行 `git pull --ff-only origin main`，确认没有 diverged history 或未预期工作区变更。
3. 创建唯一 Phase branch `phase/e4-zotero-integration`；任何 E4 implementation commit 都不得落在 `main`。
4. 在该 branch 上核对 branch/base/status、`origin` URL 和 repository-local `http.version=HTTP/1.1`。
5. E4.1 TDD：schema contract、local schema、`0004` migration、snapshot/journal、migration/integration tests。
6. E4.2 TDD：E1 additive canonical fields 与 validator/repository regression。
7. E4.3 TDD：config、`/keys/current` authoritative introspection、privilege adapter、encryption、connection repository、header redaction。
8. E4.4 TDD：v3 HTTP client、pagination、retry、timeout、bounded concurrency、`includeTrashed=1` status discovery seam。
9. E4.5 TDD：typed metadata normalization、parent SourceRecord owner-safe resolution、ordinary 404 与 explicit trash boundary。
10. E4.6 TDD：independent attachment discovery、external state persistence、tombstone/restore、concurrency/idempotency。
11. E4.7 TDD：C4 stored-PDF buffered ingestion seam audit and pipeline handoff。
12. E4.8 TDD：E1 KnowledgeDocument lifecycle、immutable next version、state-only path、tombstone/restore/history retention。
13. E4.9 TDD：REST controller、authenticated owner context、module/app wiring。
14. E4.10 TDD：full fake-provider pipeline、PostgreSQL concurrency/regression、CI command integration。
15. 运行第 11 节全部 full verification；审查 git diff 仅包含 E4 allowlist。
16. 在同一 Phase branch 上创建 implementation commits；重新核对 branch/base/status、origin 和 `HTTP/1.1`，push 同一 `phase/e4-zotero-integration` branch，创建 E4 PR，最后才标记 `PHASE_E4_REVIEW_CANDIDATE`。

## 15. Expected PR Boundary

未来唯一允许的 PR 是从 `phase/e4-zotero-integration` 创建的一个 Phase E4 PR；该 branch 必须从已核验的 accepted `main` 创建，所有 E4 commits 必须在该 branch 上，不能落在 `main`。范围仅限：`0004` additive schema、Zotero bounded module、E1 最小 canonical extension、C4 必要且 provider-neutral 的 buffered seam、E1 repository/service additive methods、E4 tests、既有 test command wiring 和必要文档。

PR 不得包含 E5/E6、E2 redesign、E3 changes、group library、provider snapshot、notes/annotations、Redis/queue、new vector indexes、frontend clone、auth repair、ECS 或 production rollout。PR 必须在 implementation tests 和 CI verification 全部通过后才能成为 implementation review candidate；当前任务仍不创建该 branch、PR 或 commit。

PHASE_E4_PLAN_REVIEW_CANDIDATE
