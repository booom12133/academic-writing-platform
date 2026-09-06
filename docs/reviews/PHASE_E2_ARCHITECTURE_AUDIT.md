# Phase E2 — Embedding & Index Architecture Audit

状态：`DESIGN SUPPORT ONLY / IMPLEMENTATION NOT AUTHORIZED`
审计日期：2026-09-05
审计基线：`main` / `origin/main` / `phase-e1-accepted`
基线 SHA：`d68331f594f671a1ce0099d008d3aaaa512448b1`

本报告只提供 E2 架构设计支持。它不授权创建 E2 分支、编写生产代码、
创建迁移、修改 CI、创建 PostgreSQL、访问 ECS、push 或创建 PR。

## 1. 审计结论

E2 应作为独立的 Embedding & Index 能力层，消费 E1 已经持久化且通过
`content-ready-for-indexing` 的 `KnowledgeDocumentVersion` 与
`KnowledgeChunk`。E2 不应重新解析文件、重新构造 C2/C3 上下文，也不应
直接接受请求中的临时 chunk。

建议的边界如下：

```text
E1 persisted version/chunks
        │  user-scoped, immutable, provenance-bearing
        ▼
E2 IndexingService
        ├─ EmbeddingProvider       (capability-specific)
        ├─ index profile/fingerprint
        ├─ idempotent job + lease/attempt state
        └─ chunk embedding rows    (pgvector)
        │
        └─ indexed / stale / failed state for later E3 consumption
```

E2 的最小可接受结果是：针对某个用户、某个 E1 文档版本、某个 embedding
profile，能够安全地把持久化 chunk 转换为可审计的向量行，并在重复、并发、
部分失败、重试和 profile 变化时保持确定性。检索、排序、RAG 和引用组装
仍属于 E3 及以后阶段。

## 2. 已审计的 E1 与 D4 边界

已读取并以 accepted `main` 为准的文件：

- `PROJECT_STATE.md`
- `ROADMAP.md`
- `AGENTS.md`
- `CODEX_WORKFLOW.md`
- `docs/reviews/PHASE_E1_FINAL_ACCEPTANCE_REPORT.md`
- `docs/superpowers/specs/2026-09-03-phase-e1-knowledge-provenance-foundation-design.md`
- `docs/superpowers/plans/2026-09-03-phase-e1-knowledge-provenance-foundation-plan.md`
- `server/database/schema.ts`
- `drizzle/migrations/0001_standard_postgres_baseline.sql`
- `drizzle/migrations/0002_e1_knowledge_provenance.sql`
- `drizzle/migrations/meta/_journal.json`
- `server/database/standard-postgres.module.ts`
- `server/database/database.types.ts`
- `server/modules/knowledge/knowledge.types.ts`
- `server/modules/knowledge/knowledge.hash.ts`
- `server/modules/knowledge/knowledge.provenance.ts`
- `server/modules/knowledge/knowledge.repository.ts`
- `server/modules/knowledge/knowledge.service.ts`
- `server/modules/knowledge/knowledge.module.ts`
- `server/modules/ai-tools/llm/text-generation.provider.ts`
- `server/modules/ai-tools/llm/llm.service.ts`
- `server/modules/ai-tools/llm/d4-provider-decoupling.integration.spec.ts`
- `server/modules/knowledge/*.spec.ts`
- `test/unit/postgres-schema.integration.spec.ts`
- `test/unit/postgres-migration-order.spec.ts`
- `.github/workflows/ci.yml`
- `package.json`

关键事实：

1. E1 的 `KnowledgeDocumentVersion` 是不可变版本，带有
   `indexInputFingerprint`、`parserProfile`、`chunkingProfile` 和
   `readinessStatus`。当前 readiness 只有
   `content-ready-for-indexing`，没有 indexed/stale/failed。
2. E1 的 `KnowledgeChunk` 持久化了文本、`textHash`、稳定 ordinal、文档版本
   关系、C1/C2/C3 provenance 和 `citationLocator`。chunk 的 durable UUID
   不是 C3 request-local chunk ID。
3. E1 通过用户字段和复合外键保护 source/document/version/chunk/import 的
   所有权；导入幂等键为 `(user_id, idempotency_key)`。
4. `StandardPostgresDatabaseModule` 使用 `drizzle-orm/node-postgres`、直接
   `pg.Pool`、`DATABASE_URL`，并导出既有 `DRIZZLE_DATABASE` token。当前
   `postgres:16` CI 服务验证的是普通 PostgreSQL，不证明安装了 pgvector。
5. D4 的链路是 `LlmService → TextGenerationProvider → DeepSeekProvider`。
   `TextGenerationProvider` 只负责文本生成和健康检查，不能被重用为通用
   AI provider。
6. 当前依赖已经包含 `pg`、Drizzle、`drizzle-kit` 和 `pg-mem`，但仓库中没有
   embedding provider、向量类型、pgvector extension 或索引表。

## 3. E2 provider boundary

### 3.1 独立抽象

E2 应定义 capability-specific token 和接口，例如：

```ts
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingProvider {
  getIdentity(): Promise<EmbeddingModelIdentity>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  checkHealth(): Promise<EmbeddingHealth>;
}
```

建议的请求/结果语义：

- `EmbeddingRequest.items` 是有序的 `{ inputFingerprint, text }[]`；provider
  必须按输入顺序返回结果，不能依赖数据库顺序或自行丢弃项目。
- `EmbeddingModelIdentity` 至少包含稳定的 `provider`、`model`、`modelRevision`
  （若 provider 能提供）、`dimensions` 和 `distanceMetric`。
- `EmbeddingResult` 返回相同数量的向量、实际 identity、维度和可选 usage
  telemetry。返回数量不一致、维度错误、非有限数值和重复/未知输入都属于
  provider contract failure。
- provider 可以声明 batch size、最大输入长度和 truncation policy；这些配置
  必须进入 E2 profile fingerprint。
- provider 错误必须可区分 transient、rate-limited、invalid-input、unsupported
  configuration 和 permanent failure；不得把 API key 或原始远端响应写入
  E2 业务错误字段。

`EmbeddingProvider` 是 E2 的依赖注入边界，`IndexingService` 只依赖该接口。
它不得注入 `LlmService`、`TEXT_GENERATION_PROVIDER` 或 `DeepSeekProvider`。
embedding usage 可以记录为 telemetry，但本阶段不改变积分、任务计费或
现有 AI 生成调用。

### 3.2 provider 选择

本仓库没有证据证明 DeepSeek 是 embedding provider。DeepSeek 只能继续作为
D4 文本生成 provider，不能因为已有配置而被硬编码为 embedding provider。
E2 应先由产品/架构审查批准具体 provider、模型、维度、数据出境规则和限流
策略，再绑定实现；在此之前只定义 neutral contract 和 fake provider 测试。

## 4. Index input contract

E2 的唯一正式输入是 E1 数据库中的、用户有权访问的：

```text
knowledge_document_versions
  └─ knowledge_chunks (ordered by ordinal)
```

默认索引目标建议是：指定用户的 active document version，且 version 与
document 均未 tombstone、version readiness 为
`content-ready-for-indexing`。为历史版本建立显式 index job 可以作为内部
能力保留，但不能让默认流程绕过 active/lifecycle 规则。

索引前应在同一数据库读取/校验：

- `version.userId`、`documentId` 和用户请求一致；
- version 的 E1 `indexInputFingerprint`；
- chunks 的 `(documentVersionId, ordinal)` 顺序、`textHash` 和 provenance；
- 每个 chunk 的持久化文本 hash 与重新计算的 SHA-256 一致；
- chunk 数量和 ordinal 连续性。

E2 不接受客户端提供的文本、C3 chunk ID、来源链接或 provenance 作为权威
输入。E1 provenance 只读继承；E2 的 vector row 必须能回指 E1 的 durable
chunk/version，不能建立旁路的无 provenance 文本副本。

## 5. Identity and fingerprints

建议固定以下身份层次，并禁止把 secret、access token 或完整 endpoint 写入
fingerprint：

| 身份 | 建议组成 | 用途 |
|---|---|---|
| embedding model identity | provider、model、model revision、dimensions、distance metric | 说明向量由谁生成 |
| embedding config/profile fingerprint | model identity + input type + normalization + truncation + batch/request protocol + provider adapter version | 区分可复用的 E2 embedding profile |
| chunk input fingerprint | E1 `indexInputFingerprint` + version ID + chunk ID + ordinal + `textHash` | 证明该向量对应哪个不可变输入 |
| index job fingerprint | user ID + version ID + E1 index input fingerprint + profile fingerprint + ordered chunk input fingerprints | 幂等和并发竞争的自然身份 |

所有 canonical serialization 都必须明确：对象 key 排序、数组顺序、Unicode
和数字表示。不要只用裸文本 hash：相同文本出现在不同版本/不同 provenance
中时仍需保持可追溯。不要把 embedding model 变化伪装成 E1 新文档版本；
model/profile 是 E2 index identity。

## 6. Lifecycle and re-index semantics

E1 的 readiness 不变。E2 自己维护 index job 和 chunk embedding 的状态：

```text
pending → processing → indexed
             │             │
             ├→ failed     └→ stale (profile/input/lifecycle no longer current)
             └→ pending (lease expired / retryable failure)
```

建议语义：

- `pending`：已声明索引目标但尚未成功生成向量。
- `processing`：某个 worker/请求持有租约，正在调用 provider；不是最终状态。
- `indexed`：向量、维度、profile fingerprint 和 chunk input fingerprint 全部
  匹配，且该行可被后续 E3 识别为当前有效索引材料。
- `failed`：最近一次尝试失败；保留 typed failure、attempt count 和最后一次
  失败时间，允许 E2 明确 retry。
- `stale`：该行曾属于有效索引，但其目标已被新的 E1 version、embedding
  profile/config、chunk input fingerprint 或 tombstone/lifecycle 策略取代。

版本是不可变的，因此旧版本的向量不能因文本被“原地修改”而失效。建议默认
索引策略是 active-version scoped：文档 active version 变更后，旧版本对应
profile 的 index job/rows 标记为 `stale`；若明确请求历史版本索引，则该目标
可重新进入 pending/processing。这样保留历史审计数据，同时避免后续 E3 把
旧 active version 当作默认证据。

以下事件由 E2 负责识别并触发 re-index：

1. 新 E1 version 成为 active version；
2. 相同版本使用不同 model、model revision、dimensions、metric 或任何影响
   向量结果的 profile 配置；
3. 持久化 chunk 的 `textHash`、ordinal 或 E1 input fingerprint 与已有 index
   row 不一致；
4. document/version 被 tombstone，或当前索引策略不再允许该目标。

相同 `(version, profile, chunk input fingerprint)` 的 `indexed` 行不得重复
生成。重试和 re-index 的所有权属于 E2；E1 只负责产生 content-ready 输入。
E2 v1 可以提供显式内部 retry/re-index service，不应顺便引入 Redis、BullMQ
或新的公开检索 API。

## 7. Proposed storage surface (not implemented)

标准 PostgreSQL + pgvector 是与 E1 一致的目标，但要先解决 extension 和
provider dimension 的基础设施门槛。建议至少新增以下 E2 关系：

### 7.1 `knowledge_index_jobs`

每个用户、E1 document version 和 E2 profile 的一次索引目标/汇总：

- `id uuid primary key`；`user_id varchar(64) not null`；
- `document_version_id uuid not null`，通过 `(document_version_id,user_id)`
  复合外键指向 E1 version；
- `e1_index_input_fingerprint varchar(64) not null`；
- `embedding_model_identity jsonb not null`；
- `embedding_profile_fingerprint varchar(64) not null`；
- `status`（至少 `pending/processing/indexed/failed/stale`）；
- `total_chunks`, `indexed_chunks`, `failed_chunks`；
- `attempt_count`, `last_error_code`, `last_error_at`；
- lease 所需的 `lease_owner`, `lease_expires_at`；
- `created_at`, `updated_at`, `indexed_at`；
- unique `(user_id, document_version_id, embedding_profile_fingerprint,
  e1_index_input_fingerprint)`；用户/版本状态查询索引。

### 7.2 `knowledge_chunk_embeddings`

每个 E1 chunk、profile 和输入 fingerprint 的向量结果：

- `id uuid primary key`；`user_id varchar(64) not null`；
- `knowledge_chunk_id uuid not null`，通过用户复合外键指向
  `knowledge_chunks(id,user_id)`；
- `index_job_id uuid not null`，通过用户复合外键指向 index job；
- `input_fingerprint varchar(64) not null`；
- `embedding_profile_fingerprint varchar(64) not null`；
- `dimensions integer not null`；
- `embedding vector`（初版不固定维度，维度由 profile 和应用校验）；
- `status`、`attempt_count`、typed error 字段、lease/时间戳字段；
- unique `(user_id, knowledge_chunk_id, embedding_profile_fingerprint,
  input_fingerprint)`；按用户、job、状态和 profile 建索引。

这里的 `vector` 建议先使用不带维度参数的 pgvector 类型，以避免在具体
provider 尚未批准前把某个模型/维度写死进 migration。应用必须严格校验
`dimensions` 与向量长度；待模型确定后，再评估按 profile 建立固定维度的
HNSW/IVFFlat 索引。E2 不提供相似度查询 API，因此 ANN 索引类型不是 E2
最小实现的前置条件。

E2 不需要复制 `text`、provenance、source record 或 citation locator；通过
`knowledge_chunk_id` 回读 E1 即可。若为了查询性能重复保存
`document_version_id`，必须额外增加能证明 chunk/version 归属的复合约束，
不能只放两个彼此独立的外键。

### 7.3 Migration and infrastructure gate

E2 migration 需要：

1. `CREATE EXTENSION IF NOT EXISTS vector`，并验证 extension 版本；
2. Linux CI 使用 pgvector-capable PostgreSQL 16 image，而当前 `.github/workflows/ci.yml`
   的普通 `postgres:16` 不能直接证明该能力；
3. 明确生产 PostgreSQL 是否允许/已安装 pgvector、升级路径和备份策略；
4. 明确 vector column/index 策略、维度变更策略和删除/保留策略；
5. 继续使用 E1 的 Drizzle migration journal 和应用-owned schema，不使用
   `db-schema-sync` 或 Miaoda/DataPaas 作为 E2 的 schema authority。

以上是实现前的设计/基础设施决策，不在本次审计中修改。

## 8. Batch failure, retry, and concurrency

建议把“声明目标”和“处理批次”分开：短事务创建/获取唯一 job，并为所有
持久化 chunk 建立待处理 manifest；worker 以小批量租约 claim 行，事务外
调用 provider，随后用 lease owner 条件提交结果。这样不会把远端 API 调用
放在长数据库事务中。

规则建议如下：

- provider 返回前先校验 item 数量、input fingerprint、维度和数值；整批结果
  不通过校验时不得写入任何向量。
- 可重试错误只增加 attempt/保留失败原因，并在 lease 释放或过期后重新进入
  pending；不可重试错误进入 failed。达到上限后 job 保持 failed，显式 retry
  可重新打开失败行。
- 已成功的行不因同一 job 重试而重新调用 provider；部分成功允许 job
  `failed`，直到所有必要行均为 indexed。
- 同一自然 job 使用 `INSERT ... ON CONFLICT DO NOTHING` 竞争；未获胜者按
  fingerprint 读取并返回既有 job，而不是暴露 PostgreSQL unique violation。
- 行 claim 使用 `FOR UPDATE SKIP LOCKED` 或等价的条件更新；结果提交必须
  检查 job、user、profile、input fingerprint 和 lease owner。
- lease 超时只能回收 `processing`，不能覆盖已经 `indexed` 的正确结果。
- 所有查询都带 `user_id`；跨用户 ID、跨版本 chunk 和 tombstoned 目标统一
  映射为不可见/不可索引，避免泄漏资源存在性。

E2 v1 的重试次数、batch size、lease duration 和退避上限应作为 embedding
profile/运行配置的一部分，但是否由同步 HTTP 请求、受控内部命令还是未来
worker 触发，需要单独批准。当前不扩展队列、Redis 或部署流程。

## 9. Testing strategy

实现获授权后，至少需要以下测试面：

### Unit and mock-provider tests

- 只读取 E1 持久化 version/chunk，拒绝 request-local text/chunk；
- deterministic profile/model/input/job fingerprint；Unicode、emoji、CRLF 和
  chunk 顺序保持稳定；
- provider 返回数量、维度、非有限数值、未知 fingerprint 的 contract failure；
- empty input、batch limit、transient/permanent/rate-limit 错误分类；
- indexed/failed/stale 状态迁移和 retry 只重跑必要行；
- E2 不注入 `LlmService`、`TEXT_GENERATION_PROVIDER` 或 DeepSeek。

### Provider contract tests

对每个实际 provider 和 fake provider 共用一套 contract：

- identity 必须包含 model 与 dimensions；
- 输入顺序与输出顺序一致；
- 相同 profile/input 产生可识别的 deterministic result 或明确记录 provider
  非确定性；
- health、超长输入、批量上限、错误分类和 usage telemetry 行为一致；
- 不把 secrets 或原始远端 payload 写入错误。

### Real PostgreSQL/pgvector integration tests

- fresh PostgreSQL 16 + pgvector 执行 E1 0001/0002 与 E2 migration；
- migration second-run 幂等、extension/version、vector insert/select、维度
  校验、复合 FK、唯一索引和 rollback；
- E1 version/chunk 仍可独立读取，E2 rows 能通过 durable chunk 回指 provenance；
- job 与 row 的 indexed/stale/failed/lease 状态在真实事务下正确持久化。

### Idempotency/concurrency tests

- 同一用户、同一 version/profile/input 的并发请求只有一个 job/向量写入者，
  其他调用者得到同一结果；
- 同一自然 key 但 fingerprint 不同返回 typed conflict，不创建第二套结果；
- 两个 worker 不能同时持有同一 lease；过期 lease 可以安全回收；
- 一个批次成功、下一批失败时，成功行保留，job 为 failed，retry 只处理失败行；
- 不同用户即使使用相同 chunk/text/profile 也不共享越权结果。

### Migration and frozen-path regression

- 当前 E1 migration/schema tests 必须保持通过；
- E1 readiness 仍只有 `content-ready-for-indexing`，E2 状态不进入 E1 类型；
- C1/C2/C3/C4、D1-D4、TextGenerationProvider 和现有 CI full regression
  不得因 E2 provider 注入而改变行为。

## 10. Explicit scope exclusion

本 E2 设计不包含：

- retrieval、semantic search API、相似度查询、ranking、reranking；
- RAG、evidence assembly、Zotero、academic search、OpenAlex 或 connector；
- citation grounding、citation rendering 或 generation changes；
- 修改 `TextGenerationProvider`、DeepSeek generation provider、LlmService 或
  既有 AI execution contract；
- 修改 E1 source/document/version/chunk provenance 语义，或绕过 E1 直接建索引；
- public E2 controller、搜索 API、前端索引管理界面；
- 积分/计费重构、任务状态重构、self-host authentication；
- 生产 PostgreSQL provision/apply、ECS 操作、部署 pipeline expansion；
- 未经批准的 Redis、BullMQ、queue/worker platform expansion；
- 为解决 provider 维度问题而提前选定 DeepSeek 或任意具体模型。

## 11. Blocking design questions before implementation authorization

在 ChatGPT 设计审查明确回答以下问题前，不应进入 E2 实现：

1. 产品批准的 embedding provider、model、revision、distance metric、维度、
   数据出境/隐私政策和 provider rate limit 是什么？
2. 初版是否接受无维度 `vector`，还是要在 migration 中固定单一维度？如果
   未来多 profile 并存，ANN index 如何按维度隔离？
3. 默认索引范围是否严格为 active version；历史版本是否允许显式内部索引，
   以及 active version 变化时旧 rows 是否按本报告建议标记 stale？
4. E2 v1 的 retry/re-index 由显式内部 service/命令触发，还是需要单独批准
   worker/queue？本报告默认不扩展 Redis/BullMQ。
5. pgvector 在 Linux CI 与目标运行环境的安装方式、版本、可升级性和生产
   迁移 gate 是否已批准？当前普通 `postgres:16` CI service 不足以验证它。
6. tombstone 后向量是保留为审计历史并标记 stale，还是进入独立 retention
   purge；物理删除不应隐含在 E2 普通重试中。
7. embedding usage 仅作 telemetry，还是要进入积分/成本策略？本报告默认
   不改变现有 billing。

## 12. Governance stop condition

本审计未创建 E2 branch，未修改生产代码、`server/database/schema.ts`、
Drizzle migrations、CI、package dependencies 或 ECS/数据库，未调用任何
embedding/LLM/外部服务，也未进入 E3。

下一步应由 ChatGPT 完成 E2 design review，并在明确 provider、pgvector
基础设施和索引目标语义后，另行给出 implementation authorization。当前
状态仍为：`E2 NOT AUTHORIZED`。
