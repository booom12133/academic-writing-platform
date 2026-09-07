# P1 Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax. Execution is forbidden until `IMPLEMENTATION_AUTHORIZED=YES`.

**Goal:** 让 A→E6 已完成能力在 production 环境中安全、稳定、可诊断、可恢复地运行。

**Architecture:** 使用显式 `RUNTIME_PROFILE` 解耦 runtime、authentication、database 和 storage。Platform profile 保留现有 Platform runtime；local profile 只用于本地研发；standalone profile 使用可信 OIDC/JWT、标准 PostgreSQL/pgvector、持久化 filesystem 和真实 embedding provider。数据库 migration 继续作为独立 release operation，不在应用启动时自动执行。

**Tech Stack:** NestJS、Node.js 22、PostgreSQL 16、pgvector、Drizzle ORM、Jest、GitHub Actions、OIDC/JWT、OpenAI-compatible Embedding HTTP API、`pg_dump`/`pg_restore`。

**Spec:** 用户提供的 P1 Design Freeze：ADR-P1-01～ADR-P1-08、WP1～WP7 和 P1 Acceptance Invariants。

## Global Constraints

- `RUNTIME_PROFILE` 必须成为显式 runtime topology selector；application bootstrap 不得猜测 local profile。
- `NODE_ENV=production + RUNTIME_PROFILE` missing 必须 BOOT FAILURE。
- `NODE_ENV=production + RUNTIME_PROFILE=local` 必须 BOOT FAILURE。
- 任意 production runtime 都禁止 `DeterministicEmbeddingProvider`；除非 Platform runtime 已提供经过验证的真实 provider，否则 platform production 与 standalone production 都使用 P1 production embedding adapter。
- Standalone identity 只实现 Bearer JWT、JWKS signature verification、issuer、audience、expiry、algorithm allowlist 和 explicit user-id claim mapping。
- P1 不开发用户名/密码、OAuth login UI、refresh-token service、注册系统、introspection server 或 session database。
- Database migration 是 release operation；application boot 不得自动迁移或修改 schema。
- Production 默认 `LOG_REQUEST_BODY=false`、`LOG_RESPONSE_BODY=false`，并且不得记录论文正文、prompt、LLM response 或 credentials。
- Standalone filesystem 必须使用 absolute private persistent path；独立本地磁盘多节点 topology 不受支持。
- 不引入 Redis、BullMQ、RabbitMQ、Kafka、external worker service 或 distributed task scheduler。
- P1 使用 single-instance/process-local rate limiting；反向代理 rate limiting 只作为 defense-in-depth 文档边界。
- Backup/restore 使用 PostgreSQL 官方 `pg_dump`/`pg_restore` 或等价官方工具；项目只提供 thin wrapper、verification helper、runbook 和 CI invocation。
- Production-critical tooling 不得依赖浮动 `@latest`；应 pin 版本或移出 production-critical release path。
- 不扩展 Payment、P2 frontend、E7/E8 research、新 retrieval/citation 算法、object storage、Kubernetes、multi-region HA 或正式部署 rehearsal。
- 未来实施仍须先建立 phase branch；本计划阶段不创建 branch、commit、push 或 PR。

---

# 1. Baseline Audit

## Verified baseline

- `main` SHA：`6a3ee346bcf0b8cbd6ae7c6df58d30871bd74c30`。
- `origin/main` SHA：`6a3ee346bcf0b8cbd6ae7c6df58d30871bd74c30`。
- 当前分支：`main`。
- 当前工作树：初始 `git status --short` 无输出。
- accepted annotated tag：`phase-e6-accepted`，以当前 Project Controller 提供的正式状态为准。
- 正式状态：`PHASE_E6_ACCEPTED_CLOSED`、`CORE_R&D_COMPLETE`。
- 当前治理状态：`P1_DESIGN=FROZEN`、`P1_PLAN_REVIEW=P1_PLAN_REVIEW_PASS`、`P1_PLAN=P1_PLAN_FROZEN`、`IMPLEMENTATION_AUTHORIZED=YES`。

## Existing modules and constraints

- [server/app.module.ts](../../server/app.module.ts) 当前根据 storage driver 和 local-development 判断模块组合；P1 必须改为 profile-driven composition。
- [server/main.ts](../../server/main.ts) 已有 Nest bootstrap，但没有显式 health、shutdown、drain 或 startup config validation。
- [server/database/standard-postgres.module.ts](../../server/database/standard-postgres.module.ts) 已有 PostgreSQL URL validation、生产 TLS 约束、bounded pool 和 pool close lifecycle。
- [scripts/db-migrate.js](../../scripts/db-migrate.js) 已有 advisory-lock migration runner；P1 保持其 release-operation 角色。
- [drizzle/migrations/](../../drizzle/migrations/) 已有 standard schema、E1 provenance、E2 embedding/pgvector 和 E4 Zotero migrations。
- [server/modules/document-input/](../../server/modules/document-input/) 已有 MIME/size/hash/path 校验和 filesystem/platform storage adapters。
- [server/modules/knowledge/indexing/](../../server/modules/knowledge/indexing/) 已有 `EmbeddingProvider`、`EmbeddingResult`、`EmbeddingModelIdentity` 和 deterministic provider；当前 module 默认注册 deterministic provider。
- [server/modules/ai-tools/llm/](../../server/modules/ai-tools/llm/) 已有 DeepSeek provider、timeout 和错误映射。
- [server/modules/zotero/](../../server/modules/zotero/) 已有 credential encryption、retry、timeout 和下载大小限制。
- [server/modules/academic-search/](../../server/modules/academic-search/) 已有 OpenAlex 请求边界、cursor secret、timeout 和 retry。
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 已有 full regression、lint、typecheck、build 和 PostgreSQL schema integration。

## Confirmed GitHub audit findings

以下发现均来自 accepted baseline 当前代码，不因旧计划存在而默认保留：

1. `filesystem + production` 路径只加载标准 PostgreSQL/Logger，没有 standalone auth adapter/guard；local fixed identity 仅在 local-development middleware 中注入。
2. `PATCH /api/tasks/:id/status` 在 [server/modules/tasks/tasks.controller.ts](../../server/modules/tasks/tasks.controller.ts) 中未取得当前 user ID，service update 只按 task ID 更新，存在跨用户任意修改风险。
3. [scripts/build.sh](../../scripts/build.sh) 会在存在时复制 `.env` 到 `dist`，并清理 `dist/scripts`；migration runner/context 未作为明确 release artifact 处理。
4. [package.json](../../package.json) 的 `start` 指向根目录 `main.js`，而仓库根目录没有该文件；打包运行入口在 `scripts/run.sh`。
5. `KnowledgeIndexingModule` 当前默认使用 `DeterministicEmbeddingProvider`。
6. [server/main.ts](../../server/main.ts) 未启用 Nest shutdown hooks；当前没有 `/health/live`、`/health/ready` 的应用级 endpoint。
7. [server/common/filters/exception.filter.ts](../../server/common/filters/exception.filter.ts) 的未知异常响应包含 `stack` 和 `cause`。
8. AI task 当前使用进程内异步处理；P1 只处理 graceful shutdown、bounded drain、new-work rejection、interrupted/stale task semantics 和 failure visibility，不引入 durable queue/worker architecture。

# 2. Frozen Architecture Decisions

## ADR-P1-01 — Explicit Runtime Profile

固定 profile：

```text
local      = fixed dev identity + LocalDevelopmentDatabase + local filesystem
platform   = Platform authentication + Platform runtime/database + Platform storage
standalone = trusted external JWT + Standard PostgreSQL/pgvector + persistent filesystem
```

`RUNTIME_PROFILE` 必须由 development scripts 显式设置为 `local`；application bootstrap 不得根据 `NODE_ENV` 或 storage driver 猜测 profile。

## ADR-P1-02 — Trusted Production Identity

Standalone 只实现：

```text
Bearer JWT
→ JWKS signature verification
→ issuer validation
→ audience validation
→ expiry validation
→ algorithm allowlist
→ explicit user-id claim mapping
→ minimal verified userContext
```

业务层只依赖 verified `userId`，不接收完整 claims object，除非某个审计字段明确需要。

## ADR-P1-03 — Migration Is a Release Operation

```text
migration context
→ migration success
→ schema/readiness verification
→ application artifact rollout
```

Application boot 不调用 migration runner，不自动执行 DDL。

## ADR-P1-04 — Fake Embedding Forbidden in Production

`DeterministicEmbeddingProvider` 只允许 `NODE_ENV=test` 或 `RUNTIME_PROFILE=local`。任何 `NODE_ENV=production` profile 若注入 deterministic provider，必须 boot failure；platform production 也适用，除非 Platform 已注入经验证的真实 provider。

## ADR-P1-05 — Health Separation

- `/health/live`：只表示进程存活。
- `/health/ready`：只返回最小 ready/not-ready 状态及稳定 reason code，检查 config、PostgreSQL、schema、pgvector、storage。
- Provider diagnostics：不作为匿名公网 diagnostics。若保留 `/health/providers`，必须 internal/protected，并且返回 sanitized status，不返回 URL、路径、credentials、upstream response、stack 或 secret names。

## ADR-P1-06 — Content-Safe Logging

Production body logging 必须关闭；请求 ID、route、status、latency、error class、provider name 和 timestamp 可以保留。任何正文、prompt、response、JWT、API key、DB password、Zotero/embedding credential 不得进入正常日志。

## ADR-P1-07 — Filesystem Persistence

Standalone filesystem 必须是 absolute、private、persistent volume，具备受限权限、明确 OS ownership、容量监控边界和 backup coverage。`multiple application nodes + independent local disks` 明确 unsupported。

## ADR-P1-08 — Reproducible Build

Production-critical build 不允许依赖 `@latest`；当前 scripts 中的动态 tooling 必须固定版本或移出 production release path。

# 3. Implementation Strategy

实现顺序固定为：

```text
WP1
 ├── WP2
 ├── WP3
 ├── WP4
 └── WP5
       ↓
      WP6
       ↓
      WP7
```

先完成 profile/config contract，使之后的 auth、DB、storage、provider 都有明确运行时边界；再并行完成安全、数据库、文件和 provider hardening；最后集中实现 health、logging、shutdown，并由 CI 验证 clean artifact。

保留：

- E1–E6 repository/service 语义和 ownership predicates；
- E2 `EmbeddingProvider`、`EmbeddingResult`、`EmbeddingModelIdentity` 和 fingerprint semantics；
- PostgreSQL TLS/pool 基础；
- C4 hash/path/size/parse-before-store contract；
- DeepSeek/Zotero/OpenAlex 现有 timeout、retry 和错误类型。

解除：

- `DOCUMENT_STORAGE_DRIVER` 对 DB/Auth/Storage topology 的隐式控制；
- local auth 与 production bootstrap 的混用；
- production module graph 与 deterministic embedding 的混用；
- application startup 与 migration mutation 的混用；
- provider health 与 liveness 的混用。

# 4. WP1–WP7 Detailed Plan

## WP1 — Runtime Profiles + Config / Secrets Contract

**Goal:** 引入显式 `RUNTIME_PROFILE`，集中解析配置，critical production config 无效时 fail-fast。

**Existing code involved:** `server/app.module.ts`、`server/main.ts`、`server/config/*`、`server/middleware/local-development-auth.middleware.ts`、`server/database/local-development.database.ts`、`server/database/standard-postgres.module.ts`、`scripts/dev-local.js`、`scripts/dev-entry.js`、`.env.example`、`package.json`。

**Files likely to modify:**

- `server/app.module.ts`
- `server/main.ts`
- `server/config/local-development.ts`
- `scripts/dev-local.js`
- `scripts/dev-entry.js`
- `.env.example`
- `package.json`

**Files likely to create:**

- `server/config/runtime-profile.ts`
- `server/config/production-config.ts`
- `server/config/config-validation.ts`
- `server/config/runtime-profile.spec.ts`
- `server/config/config-validation.spec.ts`

**Interfaces:**

```ts
type RuntimeProfile = 'local' | 'platform' | 'standalone';

interface RuntimeConfig {
  nodeEnv: string;
  profile: RuntimeProfile;
  auth: { mode: 'local-fixed' | 'platform' | 'standalone-jwt' };
  database: { mode: 'local-memory' | 'platform' | 'postgres'; url?: string };
  storage: { mode: 'local-filesystem' | 'platform' | 'persistent-filesystem'; root?: string };
}

function loadRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig;
function validateRuntimeConfig(config: RuntimeConfig, env: NodeJS.ProcessEnv): void;
```

**Behavioral changes:**

- `RUNTIME_PROFILE` 为显式 topology selector。
- production 缺少 profile、使用 local profile、使用 local fixed auth 或使用 local database 均失败。
- development scripts 显式设置 `RUNTIME_PROFILE=local`。
- profile 决定 module composition；`DOCUMENT_STORAGE_DRIVER` 不再决定 DB/Auth topology。
- `.env.example` 仅提供 local-safe defaults，production secrets 留空且标记 required。

**TDD tests first:**

- `productionMissingProfileFails`
- `productionLocalProfileFails`
- `developmentRequiresScriptProvidedLocalProfile`
- `unknownProfileFails`
- `standaloneRequiresDatabaseAndStorageConfig`
- `platformDoesNotLoadStandaloneModules`
- `localLoadsOnlyFixedAuthAndLocalDatabase`

**Regression tests:** `test/unit/app-bootstrap.spec.ts`、local-development auth tests、现有 platform bootstrap tests、full Jest suite。

**Completion criteria:** 三种 profile 的 module composition 可测试；production local/missing profile fail-fast；所有后续 WP 可消费统一 `RuntimeConfig`；现有 local/platform flow 保持可启动。

**Dependencies:** none。

**Risks:** 现有 dev scripts 必须同步注入 profile，否则会把隐式兼容问题误判为业务回归。

**Future test cycle:** 先写上述 failing tests；运行 `npm test -- --runInBand server/config` 验证失败；实现最小 config/profile wiring；运行 targeted tests、`npm run test:app-bootstrap`、`npm run type:check:server`；再提交独立 WP1 commit。

## WP2 — Production Auth + User Isolation + API Security

**Goal:** 实现 standalone JWT trust boundary，修复 owner isolation，并加入 strict CORS、request limits、single-instance rate limiting。

**Existing code involved:** controllers 中的 `NeedLogin`、`server/middleware/local-development-auth.middleware.ts`、Users/Tasks/Points/Orders/DocumentInput/AcademicSearch/Zotero/GroundedGeneration/AiTools modules。

**Files likely to modify:**

- `server/app.module.ts`
- `server/modules/tasks/tasks.controller.ts`
- `server/modules/tasks/tasks.service.ts`
- 其他需要统一读取 verified user context 的 protected controllers
- `server/main.ts`
- `.env.example`

**Files likely to create:**

- `server/auth/standalone-auth.module.ts`
- `server/auth/standalone-auth.adapter.ts`
- `server/auth/standalone-auth.guard.ts`
- `server/auth/standalone-auth.types.ts`
- `server/auth/standalone-auth.spec.ts`
- `server/common/security/rate-limit.guard.ts`
- `server/common/security/request-limits.ts`
- `server/common/security/security.spec.ts`

**Interfaces:**

```ts
interface VerifiedIdentity {
  userId: string;
}

interface StandaloneAuthAdapter {
  verifyBearerToken(token: string): Promise<VerifiedIdentity>;
}

interface StandaloneAuthGuard {
  canActivate(context: ExecutionContext): Promise<boolean>;
}
```

**Behavioral changes:**

- standalone 只接受 Bearer JWT，验证 JWKS signature、issuer、audience、expiry 和算法 allowlist。
- verified identity 只映射最小 `userId`。
- anonymous、invalid、expired、wrong issuer/audience token 均返回 401。
- `PATCH /tasks/:id/status` 改为 owner-scoped update；status/progress/result/error 使用严格 runtime validation。
- 所有 protected resource 的 read/update/delete 均不能只按 resource ID 授权。
- CORS 只允许明确配置的 origins。
- rate limiting 使用 process-local implementation；expensive endpoints 使用更严格 policy。
- 不引入 Redis 或分布式 limiter。

**TDD tests first:**

- anonymous protected API → 401
- invalid/expired/wrong issuer/wrong audience JWT → 401
- disallowed algorithm → 401
- forged body `userId` 不改变 verified identity
- user A 不能读取、更新或删除 user B task
- task status update 必须使用 owner user ID
- invalid task status/progress/result payload → 400
- disallowed CORS origin → rejected
- expensive endpoint over limit → 429
- oversized JSON/upload → rejected

**Regression tests:** `server/modules/tasks/tasks.service.spec.ts`、各 controller unit/http boundary tests、document-input tests、grounded-generation HTTP tests、academic-search HTTP tests、zotero HTTP tests、full Jest suite。

**Completion criteria:** standalone auth fail-closed；client supplied userId 不可信；跨用户 read/write/delete 测试通过；protected APIs 统一 401/403；CORS、limits、rate limiting 有 HTTP evidence。

**Dependencies:** WP1。

**Risks:** OIDC/JWKS library 必须使用已锁定版本；当前 P1 topology 不支持多节点独立本地磁盘，因此 process-local limiter 是明确边界。

**Future test cycle:** 先添加 auth/isolation/security failing tests；运行 targeted Jest 确认失败；实现 adapter/guard/owner filter；运行 auth、task、HTTP regression 和 server typecheck；提交 WP2 reviewable commit。

## WP3 — PostgreSQL / pgvector + Migration + Backup / Restore

**Goal:** 建立 migration release gate、schema/pgvector readiness 和官方工具驱动的 backup/restore baseline。

**Existing code involved:** `server/database/standard-postgres.module.ts`、`scripts/db-migrate.js`、`drizzle/migrations/*`、PostgreSQL integration tests、`.github/workflows/ci.yml`。

**Files likely to modify:**

- `server/database/standard-postgres.module.ts`
- `scripts/db-migrate.js`
- `package.json`
- `.github/workflows/ci.yml`
- existing PostgreSQL integration tests

**Files likely to create:**

- `server/database/database-readiness.ts`
- `server/database/database-readiness.spec.ts`
- `scripts/db-backup.js`
- `scripts/db-restore-verify.js`
- `test/unit/postgres-migration-upgrade.integration.spec.ts`
- `docs/operations/database-backup-restore.md`

**Behavioral changes:**

- migration runner 保持独立，失败返回非零，不触发应用 rollout。
- fresh DB、E6 existing DB upgrade、concurrent migration lock 均可验证。
- readiness 检查 PostgreSQL、required schema version 和 `vector` extension。
- 支持 migration principal/runtime principal 的权限边界。
- backup/restore 只封装 `pg_dump`、`pg_restore` 和 verification，不自研 backup protocol。

**TDD tests first:**

- fresh database applies all migrations
- existing baseline upgrades without destructive mutation
- concurrent migration attempts serialize on advisory lock
- invalid DB URL/TLS config fails
- migration failure exits nonzero
- application bootstrap never calls migration runner
- missing vector extension or required migration version causes not-ready
- restored dump contains required tables and vector extension

**Regression tests:** `test/unit/postgres-schema.integration.spec.ts`、`postgres-e2-embedding.integration.spec.ts`、`postgres-e3-retrieval.integration.spec.ts`、`postgres-e4-zotero.integration.spec.ts`、full Jest suite。

**Completion criteria:** release migration context stable/repeatable；application boot 不执行 DDL；fresh/upgrade/backup/restore evidence 在 Linux PostgreSQL CI 中通过；runtime principal 不拥有不必要的 migration 权限。

**Dependencies:** WP1；health endpoint 在 WP6 消费 database readiness contract。

**Risks:** `pg_dump`/`pg_restore` 依赖 Linux PostgreSQL service；本地 Windows 只需保留可运行的 wrapper contract，CI 为 authoritative verification。

**Future test cycle:** 先写 fresh/upgrade/readiness/backup failing tests；运行 PostgreSQL integration job；实现 readiness 和 thin wrappers；运行所有 PostgreSQL suites；提交 WP3 commit。

## WP4 — Production File Storage Hardening

**Goal:** 确立 standalone filesystem 的 private persistent contract，并增加权限、容量、temporary/orphan 生命周期边界。

**Existing code involved:** `document-storage.config.ts`、`filesystem-document-storage.adapter.ts`、`document-input.service.ts`、platform storage adapter。

**Files likely to modify:**

- `server/modules/document-input/document-storage.config.ts`
- `server/modules/document-input/filesystem-document-storage.adapter.ts`
- `server/modules/document-input/document-input.service.ts`
- `.env.example`

**Files likely to create:**

- `server/modules/document-input/storage-readiness.ts`
- `server/modules/document-input/storage-readiness.spec.ts`
- `server/modules/document-input/storage-lifecycle.spec.ts`
- `docs/operations/filesystem-storage.md`

**Behavioral changes:**

- standalone 要求 absolute root、private path、persistent volume contract。
- 拒绝 public web root、相对路径、不可访问目录。
- 保留 exclusive create、root containment、hash verification、parse-before-store。
- 对 permission、ENOSPC、temporary/orphan 文件提供 sanitized behavior。
- 明确容量监控、OS ownership/permissions、backup coverage 和 unsupported multi-node topology。

**TDD tests first:**

- relative root rejected
- public web root rejected
- unreadable/unwritable root not ready
- same-key concurrent write cannot overwrite
- path traversal cannot escape root
- capacity/permission failure maps to sanitized error
- temporary/orphan cleanup is bounded
- stored file cannot be served by public route

**Regression tests:** document input parser/MIME/size/hash/path traversal/ownership tests、platform storage adapter tests。

**Completion criteria:** standalone storage readiness 可验证；文件不暴露到 public route；C4 storage semantics 保持；backup 和 topology boundary 有 runbook。

**Dependencies:** WP1；WP3 backup contract。

**Risks:** filesystem permission test 需 Linux CI 验证；P1 不引入 object storage。

**Future test cycle:** 先添加 storage config/readiness/lifecycle failing tests；实现最小 validation 和 capacity boundary；运行 document-input regression 与 Linux smoke；提交 WP4 commit。

## WP5 — External Provider Productionization

**Goal:** 为 DeepSeek、真实 embedding、Zotero、OpenAlex/Crossref 建立 production config、错误、timeout、retry 和 degraded health 边界。

**Existing code involved:** `server/modules/ai-tools/llm/deepseek.provider.ts`、`server/modules/knowledge/indexing/embedding.provider.ts`、`embedding.types.ts`、`embedding.fake.ts`、`knowledge-indexing.module.ts`、`zotero.config.ts`、`academic-search.config.ts`。

**Files likely to modify:**

- `server/modules/knowledge/indexing/knowledge-indexing.module.ts`
- `server/modules/knowledge/indexing/embedding.config.ts`
- `server/modules/ai-tools/llm/deepseek.provider.ts`
- `server/modules/zotero/zotero.config.ts`
- `server/modules/academic-search/academic-search.config.ts`
- provider health integration

**Files likely to create:**

- `server/modules/knowledge/indexing/openai-compatible-embedding.provider.ts`
- `server/modules/knowledge/indexing/openai-compatible-embedding.provider.spec.ts`
- `server/modules/knowledge/indexing/embedding-production-config.ts`
- `server/modules/knowledge/indexing/embedding-production-config.spec.ts`
- provider health aggregation tests

**Interfaces:** 新 adapter 必须实现当前接口：

```ts
interface EmbeddingProvider {
  getIdentity(): Promise<EmbeddingModelIdentity>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  checkHealth(): Promise<EmbeddingHealth>;
}
```

adapter 使用现有 `EmbeddingRequest.items[].text` 生成 OpenAI-compatible request，按输入 fingerprint 恢复结果顺序，校验 vector dimensions，返回现有 `EmbeddingResult`，并复用 E2 model identity/fingerprint semantics。

**Behavioral changes:**

- `NODE_ENV=production` 的 local、platform、standalone 均不得注册 deterministic provider。
- Platform production 若没有真实 Platform embedding provider，则使用 P1 HTTP adapter。
- standalone 需要 base URL、API key、model、expected dimensions、timeout。
- production provider URL 必须 HTTPS。
- timeout、429、5xx、malformed response 映射到现有 `EmbeddingProviderError` 分类。
- provider 不记录输入文本、API key 或完整 response。
- DeepSeek/Zotero/OpenAlex 保留现有 retry/timeout，增加 startup validation 和 sanitized errors。
- 当前仓库若无独立 Crossref provider，不创建没有调用方的虚拟 provider。

**TDD tests first:**

- production local profile rejects deterministic provider
- production platform profile rejects deterministic provider
- standalone missing embedding config fails bootstrap
- compatible request payload is correct
- response item mapping preserves fingerprint order
- wrong vector dimension is rejected
- timeout/429/5xx map to bounded typed errors
- production HTTPS requirement is enforced
- provider outage reports degraded health without liveness failure
- provider secrets and input text do not appear in error/log output

**Regression tests:** `embedding.provider.spec.ts`、`embedding.fingerprint.spec.ts`、`knowledge-indexing.service.spec.ts`、`knowledge-retrieval.service.spec.ts`、PostgreSQL E2/E3 suites、DeepSeek provider tests、Zotero tests、Academic Search tests。

**Completion criteria:** 任一 production profile 都不会注入 deterministic provider；真实 adapter 通过 `EmbeddingProvider` contract 工作；dimensions/model identity 与 E2 schema 一致；provider degraded 可独立表达。

**Dependencies:** WP1；WP2 expensive endpoint limits；WP6 provider diagnostics。

**Risks:** provider retry 与 E2 execution retry 不得叠加成请求放大；embedding dimensions 不匹配时必须在启动或 provider result validation 阶段显式失败。

**Future test cycle:** 先写 provider/config/production bootstrap failing tests；实现 adapter 和 profile registration；运行 E2/E3/provider regression；提交 WP5 commit。

## WP6 — Health + Logging + Observability + Graceful Shutdown

**Goal:** 建立最小 health contract、content-safe structured logging、correlation 和 clean shutdown。

**Existing code involved:** `server/main.ts`、`server/common/filters/exception.filter.ts`、logger configuration、database lifecycle、storage/provider clients、`server/modules/ai-tools/ai-tools.service.ts`。

**Files likely to modify:**

- `server/main.ts`
- `server/common/filters/exception.filter.ts`
- `server/app.module.ts`
- provider logger/error paths
- `server/database/standard-postgres.module.ts`

**Files likely to create:**

- `server/modules/health/health.module.ts`
- `server/modules/health/health.controller.ts`
- `server/modules/health/health.service.ts`
- `server/modules/health/health.types.ts`
- `server/modules/health/health.spec.ts`
- `server/common/logging/redaction.ts`
- `server/common/logging/redaction.spec.ts`
- shutdown/lifecycle tests

**Behavioral changes:**

- `GET /health/live` 只表示 process alive。
- `GET /health/ready` 只返回最小状态和稳定 reason code，检查 WP1/WP3/WP4 readiness。
- provider diagnostics 不作为匿名公网 endpoint；若实现 `/health/providers`，必须 internal/protected，且只返回 sanitized state。
- production request/response body logging 强制关闭。
- exception response 不返回 stack/cause。
- 每个 request 记录 request ID、route、status、latency 和 error class，但不记录内容和 secrets。
- 启用 Nest shutdown hooks，处理 SIGTERM/SIGINT、bounded drain、new-work rejection、DB pool close 和 provider/storage cleanup。
- 现有进程内 task 只增加 interrupted/stale 状态语义和 failure visibility；不引入 durable queue/worker architecture。

**TDD tests first:**

- liveness succeeds during DB/provider outage
- readiness fails on DB/schema/vector/storage failure
- provider diagnostics are protected and sanitized
- production logs exclude document text, prompt, response, JWT and credentials
- unknown exception response excludes stack/cause
- request correlation ID is present
- SIGTERM/SIGINT closes DB pool and registered resources
- new work is rejected after shutdown begins
- in-flight work receives bounded drain behavior
- interrupted task is never reported as completed

**Regression tests:** full Jest、bootstrap、DeepSeek health、database lifecycle、document storage、task execution tests。

**Completion criteria:** liveness/readiness/provider diagnostics boundary stable；logs content-safe；SIGTERM clean shutdown evidence available；in-process task interruption behavior explicit；不会把 provider temporary outage 转成 liveness failure。

**Dependencies:** WP1–WP5。

**Risks:** logger dependency 的 production behavior 不能只由 env flag 保证，必须在应用层做 redaction/interceptor；任务架构不得借此扩展为 queue/worker。

**Future test cycle:** 先写 health/redaction/shutdown failing tests；实现 health service、redaction 和 lifecycle wiring；运行 targeted tests、full regression 和 process smoke；提交 WP6 commit。

## WP7 — Production CI/CD Gates + Reproducible Build

**Goal:** 用 GitHub Actions 证明 production config、artifact、migration、health、security 和 shutdown contract。

**Existing code involved:** `.github/workflows/ci.yml`、`package.json`、`scripts/build.sh`、`scripts/run.sh`、`scripts/test-app-bootstrap.js`。

**Files likely to modify:**

- `.github/workflows/ci.yml`
- `package.json`
- `scripts/build.sh`
- `scripts/run.sh`
- `scripts/test-app-bootstrap.js`

**Files likely to create:**

- `test/unit/production-bootstrap.spec.ts`
- `test/unit/production-config.spec.ts`
- `test/unit/graceful-shutdown.spec.ts`
- `scripts/test-production-artifact.js`
- `scripts/test-reproducible-build.js`

**Behavioral changes:**

- 移除 production-critical path 中的动态 `@latest`；保留现有开发流程所需 tooling，但固定版本或从 release artifact path 移除。
- production artifact 不复制 `.env`。
- migration execution context 与 application artifact 分离但均可重复获得。
- clean directory 中的 artifact 能启动并提供 health。
- CI 增加 config negative tests、fake embedding rejection、fresh/upgrade migration、security isolation、shutdown、artifact smoke 和 backup/restore verification。

**TDD tests first:**

- valid production bootstrap succeeds
- missing/invalid production config blocks bootstrap
- production local profile blocks bootstrap
- production deterministic provider blocks bootstrap
- artifact contains no `.env` or secret values
- artifact startup succeeds from clean directory
- migration context is available to release gate
- health endpoints respond after artifact startup
- reproducible build metadata is stable
- existing E6 regression remains green

**Regression tests:** existing full Jest、lint、typecheck、server/client build、PostgreSQL service job、app bootstrap。

**Completion criteria:** CI 能阻止 invalid production config、local/fake embedding、secret-bearing artifact 和 migration failure；clean artifact startup/health/shutdown 均有 evidence；浮动 tooling 不再是 release dependency。

**Dependencies:** WP1–WP6。

**Risks:** `scripts/build.sh` 是 Bash，production artifact gate 以 Linux CI 为 authoritative environment；不把 P3 deployment rehearsal 纳入本 WP。

**Future test cycle:** 先写 workflow fixture 和 artifact smoke failing tests；实现最小 CI/build changes；运行完整 workflow；提交 WP7 commit。

# 5. Detailed TDD Matrix

| WP | Test case | Test type | Expected behavior | Existing/new test file | Level |
|---|---|---|---|---|---|
| WP1 | production missing `RUNTIME_PROFILE` | bootstrap | boot failure | `server/config/runtime-profile.spec.ts` | Blocking |
| WP1 | production `RUNTIME_PROFILE=local` | bootstrap | boot failure | `server/config/runtime-profile.spec.ts` | Blocking |
| WP1 | invalid critical config | unit | validation failure | `server/config/config-validation.spec.ts` | Blocking |
| WP1 | profile module composition | bootstrap | only profile modules loaded | `test/unit/app-bootstrap.spec.ts` | Blocking |
| WP2 | anonymous protected request | HTTP | 401 | new auth HTTP spec | Blocking |
| WP2 | invalid/expired JWT | unit/HTTP | 401 | `server/auth/standalone-auth.spec.ts` | Blocking |
| WP2 | fake userId in request body | HTTP/security | ignored/rejected | new auth HTTP spec | Blocking |
| WP2 | cross-user read/update/delete | service/HTTP | 403/404 | task isolation specs | Blocking |
| WP2 | strict task payload | HTTP | invalid state rejected | task controller spec | Blocking |
| WP2 | CORS origin | HTTP | untrusted origin rejected | `server/common/security/security.spec.ts` | Important |
| WP2 | expensive endpoint rate limit | HTTP | 429 after limit | `security.spec.ts` | Important |
| WP3 | fresh DB migration | PostgreSQL integration | migrations apply | `postgres-schema.integration.spec.ts` | Blocking |
| WP3 | existing DB upgrade | PostgreSQL integration | upgrade succeeds without destructive mutation | new upgrade spec | Blocking |
| WP3 | migration failure | process/integration | nonzero exit, rollout blocked | migration integration | Blocking |
| WP3 | pgvector/schema readiness | integration | not-ready on missing extension/version | `database-readiness.spec.ts` | Blocking |
| WP3 | backup/restore verification | integration/ops | restored schema verified | backup/restore scripts | Blocking |
| WP4 | filesystem root validation | unit/bootstrap | invalid/private boundary rejected | `storage-readiness.spec.ts` | Blocking |
| WP4 | private file access | HTTP/integration | public route cannot read | storage HTTP spec | Blocking |
| WP4 | capacity/permission failure | unit | sanitized error | `storage-readiness.spec.ts` | Important |
| WP4 | orphan/temp lifecycle | unit/ops | bounded cleanup | `storage-lifecycle.spec.ts` | Important |
| WP5 | production platform/standalone provider selection | bootstrap | real adapter selected | `production-bootstrap.spec.ts` | Blocking |
| WP5 | fake embedding in production | bootstrap | boot failure | `production-config.spec.ts` | Blocking |
| WP5 | OpenAI-compatible response mapping | unit | fingerprints/order preserved | embedding provider spec | Blocking |
| WP5 | dimensions mismatch | unit | result rejected | embedding provider spec | Blocking |
| WP5 | timeout/429/5xx | unit | typed bounded provider error | embedding provider spec | Important |
| WP5 | provider degradation | integration | degraded only, no liveness failure | health spec | Important |
| WP6 | liveness during dependency outage | HTTP | liveness remains ready to process | `health.spec.ts` | Blocking |
| WP6 | readiness DB/storage failure | HTTP | minimal not-ready response | `health.spec.ts` | Blocking |
| WP6 | provider diagnostics exposure | HTTP/security | protected and sanitized | `health.spec.ts` | Blocking |
| WP6 | safe logging | unit/integration | content/secrets absent | `redaction.spec.ts` | Blocking |
| WP6 | error response redaction | HTTP | no stack/cause | exception filter spec | Blocking |
| WP6 | SIGTERM/SIGINT | process/lifecycle | clean shutdown | `graceful-shutdown.spec.ts` | Blocking |
| WP6 | interrupted in-process task | lifecycle | not silently completed | task lifecycle spec | Important |
| WP7 | production bootstrap CI | CI/process | invalid config blocks job | workflow + bootstrap spec | Blocking |
| WP7 | artifact startup | process | clean artifact serves health | `test-production-artifact.js` | Blocking |
| WP7 | artifact secret scan | CI | no `.env`/secret values | artifact smoke | Blocking |
| WP7 | reproducible build | CI | no floating release tooling | reproducibility script | Important |
| WP7 | A→E6 regression | regression | prior suites remain green | existing suite | Blocking |

# 6. Configuration Contract

| Logical configuration | Required | Secret | Profiles | Production rule/default |
|---|---|---:|---|---|
| `NODE_ENV`, `RUNTIME_PROFILE` | required | no | all | no implicit profile; production local/missing profile forbidden |
| OIDC issuer, audience, JWKS URL | standalone required | URL non-secret | standalone | HTTPS; signature, issuer, audience, expiry and algorithm validation mandatory |
| `DATABASE_URL` | standalone required | yes | standalone | PostgreSQL URL; production TLS mandatory |
| DB TLS/pool bounds | optional with bounded defaults | no | standalone | insecure TLS forbidden; pool/timeout values bounded |
| storage root | standalone required | no | standalone | absolute private persistent path; no public web root |
| `DEEPSEEK_API_KEY` | required when AI tools enabled | yes | platform/standalone | no empty production fallback |
| DeepSeek base URL/model/timeout | required in production | URL/model non-secret | platform/standalone | HTTPS; explicit production model; bounded timeout |
| embedding base URL/key/model/dimensions/timeout | required in production | key yes | platform/standalone | real adapter only; dimensions must match pgvector |
| Zotero encryption key/version | required when Zotero enabled | yes | platform/standalone | valid versioned 32-byte key; no default |
| Academic cursor secret | standalone required | yes | standalone | no static production fallback |
| OpenAlex/Crossref provider settings | conditional | provider key yes | platform/standalone | only actual enabled provider paths; HTTPS in production |
| `LOG_DIR`, logger level | optional | no | all | writable path; production level not trace by implicit dependency default |
| body logging flags | required policy | no | production | enforced `false` for request and response |
| rate limit window/limit | optional with bounded defaults | no | platform/standalone | process-local; expensive endpoints stricter |
| health timeout settings | optional with bounded defaults | no | all | short, bounded DB/storage/provider checks |
| server host/port/body limit/proxy trust | optional | no | all | production values explicit; proxy trust must be deployment-bounded |

Profile contract：

```text
local:
  RUNTIME_PROFILE=local
  NODE_ENV must not be production
  fixed local identity + pg-mem + local filesystem

platform:
  RUNTIME_PROFILE=platform
  Platform auth/runtime/database/storage
  deterministic embedding forbidden when NODE_ENV=production

standalone:
  RUNTIME_PROFILE=standalone
  NODE_ENV=production
  verified OIDC/JWT + standard PostgreSQL/pgvector + persistent filesystem
```

# 7. Authentication / Authorization Model

## Identity

Standalone request processing：

```text
Authorization: Bearer <JWT>
→ JWKS verification
→ issuer/audience/expiry/algorithm validation
→ explicit configured user-id claim mapping
→ req.userContext.userId
```

只保存最小 verified `userId`。不接受 body/query/header 中 client supplied `userId` 作为可信身份。

## Authorization

- guard/middleware 负责 anonymous rejection 和 token verification。
- service/repository 负责 resource ownership。
- task status mutation 必须使用 `(taskId, currentUserId)` 条件。
- Users、Tasks、Points、Orders、Documents、Knowledge、Zotero、Academic Search 和 Grounded Generation 均必须从 verified context 获取 user ID。
- local fixed identity 只能在 `RUNTIME_PROFILE=local` 且非 production 存在。

## API boundary

- strict CORS 仅允许配置 origins。
- JSON、multipart、分页、provider payload 均有上限。
- AI、grounded generation、document processing、search、embedding/indexing、Zotero 使用更严格 process-local limits。
- 反向代理 rate limiting 记录为 deployment defense-in-depth，不成为 P1 application dependency。

# 8. Database / Migration / Backup Strategy

## Release flow

```text
build fixed migration context
→ backup existing DB
→ pg_dump/restore verification baseline
→ npm run db:migrate using migration principal
→ verify schema version + vector extension
→ start application artifact with runtime principal
→ readiness gate
```

## Fresh and existing DB

- Fresh DB：应用所有 ordered migrations，验证 `vector` extension、tables、constraints、indexes。
- Existing DB：先识别当前 migration version，backup 后执行增量 migration，失败返回非零并阻止 rollout。
- Advisory lock 保留，保证 concurrent release migration 串行。

## Runtime behavior

- `main.ts` 不调用 `scripts/db-migrate.js`。
- 应用只检查连接、schema version 和 pgvector readiness。
- Runtime DB principal 与 migration principal 可以分离；runtime 不持有不必要的 DDL 权限。

## Backup

- 使用 `pg_dump` 创建逻辑备份。
- 使用 `pg_restore` 恢复到隔离验证数据库。
- verification 检查 migration table、用户/任务/points/orders、E1/E2/E4 表、constraints、indexes 和 vector extension。
- filesystem backup 在 WP4 runbook 中与 database backup coverage 一起记录。

# 9. Filesystem Storage Production Contract

Standalone storage 必须满足：

```text
absolute path
outside public web root
persistent volume
restricted permissions
correct OS ownership
capacity monitoring boundary
database/file backup coverage
```

保留当前 adapter 的 exclusive create、canonical key、root containment、hash verification、20MB input limit 和 parse-before-store。新增 readiness、permission/capacity error、temporary/orphan cleanup 和 topology documentation。

以下 topology 不属于 P1 supported contract：

```text
multiple application nodes + independent local disks
```

P1 不迁移 S3/COS/OSS。

# 10. Provider Production Strategy

## DeepSeek

复用当前 provider 的 timeout、429/auth/billing/status 映射；production 校验 key、HTTPS URL、model 和 bounded timeout；health degraded 不影响 liveness；日志不记录 prompt/response/key。

## Embedding

新增 OpenAI-compatible HTTP adapter，实现当前 `EmbeddingProvider`。request 使用现有文本输入，response 必须验证数量、顺序、fingerprint、dimensions 和 model identity。E2 的 `EmbeddingModelIdentity`、fingerprint、repository compatibility 和 retrieval semantics 不重写。

生产 profile 的 provider selection：

```text
NODE_ENV=test                  → deterministic allowed
RUNTIME_PROFILE=local          → deterministic allowed
NODE_ENV=production/platform   → real provider required
NODE_ENV=production/standalone → real provider required
```

若 Platform runtime 尚无真实 embedding provider，则 platform production 也使用 P1 adapter/config contract。

## Zotero

保留 credential encryption、retry、timeout、response size cap；增加 startup key validation、sanitized errors、degraded health 和 key rotation runbook。

## OpenAlex

保留 strict query/page/cursor validation、timeout/retry；增加 production HTTPS/config validation、health 和 request budget。

## Crossref

根据 accepted baseline 的实际调用路径处理。若仓库没有独立 Crossref provider，不创建没有调用方的模块；只覆盖实际启用的 provider configuration/health path。

# 11. Health / Logging / Shutdown Strategy

## Public health

```text
GET /health/live  → minimal alive response
GET /health/ready → minimal ready/not-ready + stable reason code
```

不得返回 credentials、upstream response、stack、provider URL、DB details、filesystem path 或 secret names。

## Internal provider diagnostics

详细 provider state 只通过 protected/internal diagnostics 或 structured operational logs 暴露。若保留 `/health/providers`，必须经过 production auth/internal access protection，并仅返回 configured/reachable/degraded/lastChecked 等 sanitized fields。

## Shutdown

- `app.enableShutdownHooks(['SIGTERM', 'SIGINT'])` 或等价实现。
- shutdown 开始后拒绝新 work。
- 对进程内任务执行 bounded drain。
- DB pool、HTTP clients、timers、storage resources 正常关闭。
- interrupted/stale task 不得静默变成 completed。
- 不引入 queue、worker、Redis 或 external scheduler。

# 12. CI / Release Gates

在现有 CI 基础上按顺序增加：

1. production config validation；
2. missing/local profile negative tests；
3. fake embedding production rejection；
4. production bootstrap smoke；
5. fresh migration；
6. upgrade migration；
7. pgvector/schema readiness；
8. user-isolation/security HTTP tests；
9. safe logging and health smoke；
10. graceful shutdown；
11. backup/restore verification；
12. clean production artifact startup；
13. artifact secret scan；
14. reproducible build/tooling check；
15. existing full A→E6 regression。

任何 migration/config/artifact/security gate 失败，都不得进入 application rollout。

# 13. Production Artifact Strategy

Production artifact 分为两个明确 context：

```text
migration context:
  fixed Node/dependency context + drizzle/migrations + scripts/db-migrate.js

application context:
  server/client runtime + scripts/run.sh equivalent entrypoint
```

两者不绑定为 application startup migration。发布流程必须保证 migration context 稳定存在、版本固定、可在 clean environment 执行。

具体 artifact contract：

- 不复制 `.env` 到 `dist`。
- 不依赖根目录不存在的 `main.js`。
- `scripts/run.sh` 或等价 entrypoint 从明确的 artifact working directory 启动。
- migration files 不因普通应用 artifact 清理而丢失；若作为独立 release artifact，则 CI 必须验证其完整性。
- clean artifact smoke 启动后检查 `/health/live` 和 `/health/ready`。
- 不使用 `npx @latest` 作为 release-critical action。

# 14. Commit Strategy

仅在后续获得 `IMPLEMENTATION_AUTHORIZED=YES` 后建立 `phase-p1` branch。建议 commit 边界：

1. `WP1 runtime profiles/config/secrets`
2. `WP2 auth/isolation/API security`
3. `WP3 database/migration/backup`
4. `WP4 filesystem hardening`
5. `WP5 provider productionization`
6. `WP6 health/logging/shutdown`
7. `WP7 CI/artifact/release gates`
8. final evidence/governance documentation

每个 commit 遵循：failing test → minimal implementation → targeted test → regression test → reviewable commit。不得混入无关重构或 E1–E6 语义变化。

# 15. Acceptance Invariants Traceability Matrix

| Acceptance Invariant | WP | Planned implementation | Planned test evidence |
|---|---|---|---|
| production cannot run local auth | WP1/WP2 | production profile validation；standalone guard；local middleware only local | production local/missing profile bootstrap tests；anonymous auth tests |
| production cannot run deterministic embedding | WP1/WP5/WP7 | production module graph rejects deterministic provider；real adapter required | platform/standalone production bootstrap rejection tests；CI negative gate |
| invalid critical production config fails startup | WP1/WP7 | centralized `RuntimeConfig` validation and fail-fast bootstrap | config-validation and production-bootstrap tests |
| unauthenticated protected APIs are rejected | WP2 | standalone JWT guard and protected route enforcement | anonymous request → 401 HTTP tests |
| client supplied userId is not trusted | WP2 | verified JWT claim mapping only；body/query userId ignored | forged userId security test |
| cross-user access is rejected | WP2 | owner-scoped service/repository operations | tasks/users/documents/knowledge isolation tests |
| DB migration is explicit release operation | WP3/WP7 | migration context and CI release gate separate from app artifact | migration process tests and workflow job |
| application boot does not migrate schema | WP3/WP6 | main bootstrap only validates readiness | bootstrap spy test proving migration runner not called |
| pgvector/schema readiness can be validated | WP3/WP6 | database readiness service checks extension/version | PostgreSQL readiness integration |
| filesystem storage remains private | WP4/WP6 | private root validation and no public route exposure | storage HTTP/readiness tests |
| filesystem production persistence semantics are documented | WP4 | persistent volume/permissions/ownership/topology runbook | storage contract and CI/Linux smoke |
| request/response content logging is disabled by default | WP1/WP6 | production config false plus application redaction | production logging tests |
| secrets are never emitted in normal logs | WP6/WP7 | redaction and sanitized exception/provider errors | secret/content absence test and artifact scan |
| liveness exists | WP6 | `/health/live` minimal process check | liveness HTTP test during dependency outage |
| readiness exists | WP3/WP4/WP6 | `/health/ready` config/DB/schema/vector/storage check | readiness failure matrix |
| provider degradation is distinguishable | WP5/WP6 | protected/internal provider diagnostics and degraded state | provider outage/degraded health tests |
| SIGTERM causes clean application shutdown | WP6/WP7 | shutdown hooks, bounded drain, resource close | SIGTERM/SIGINT process test |
| production build is reproducible | WP7 | pin/remove `@latest` tooling and clean artifact contract | reproducibility/tooling CI check |
| CI exercises production bootstrap | WP7 | production fixture config and bootstrap smoke | GitHub Actions production bootstrap job |
| backup/restore minimum path exists and can be verified | WP3/WP4/WP7 | pg_dump/pg_restore thin wrappers, restore verification, storage runbook | Linux PostgreSQL backup/restore job |
| A→E6 behavior remains regression-safe | WP1–WP7 | preserve interfaces and run full regression after every WP | existing 119-suite baseline plus final full CI |

# 16. Risks

## Blocking risks

- Standalone auth adapter未完成前，self-hosted production 不能开放 protected APIs。
- 任何 production profile 仍注入 deterministic embedding 时，production bootstrap 必须失败。
- task status owner authorization 未修复前存在跨用户完整性风险。
- migration context、application artifact 和 secrets handling 未闭环前不能 rollout。
- 没有最小 liveness/readiness/shutdown contract 时无法安全进行 process supervision。

## Important risks

- 当前进程内 task architecture 的恢复能力有限；P1 只定义 interrupted/stale/failure visibility，不通过 queue/worker 扩架构。若 acceptance 需要 durable execution，必须另开阶段。
- provider retry 与 E2 execution retry 可能叠加，需要在实现中保持单一 retry budget。
- local pg-mem 与真实 pgvector 的 schema 差异必须通过 production-like PostgreSQL CI 覆盖。
- filesystem permission/ownership 在 Windows 和 Linux 语义不同，Linux CI/部署环境为权威验证环境。
- process-local rate limit 不提供多节点全局一致性；该限制与 P1 standalone filesystem topology 一致。
- 依赖包的 logger 默认行为不能替代应用层 redaction。

# 17. Remaining Open Questions

None. 以下事项已经由 Project Controller 冻结，实施阶段直接执行：

- E6 historical governance drift：以 accepted main/tag 为准，不为历史 snapshot 制造治理 commit。
- Payment expansion：明确排除 P1。
- Durable queue/worker architecture：明确排除 P1；WP6 只实现 bounded drain、new-work rejection、interrupted/stale semantics 和 failure visibility。
- Distributed rate limiting/Redis：明确排除 P1，使用 single-instance/process-local limiter。
- Standalone OIDC 第一版协议：固定为 Bearer JWT + JWKS + issuer/audience/expiry/algorithm/user-id claim validation。
- Backup implementation：固定使用 `pg_dump`/`pg_restore` thin wrapper 和 verification。
- Platform embedding：WP5 开始时审计当前 Platform dependency contract；若无可验证真实 provider，platform production 直接使用 P1 OpenAI-compatible adapter；任何 production deterministic provider 都必须 boot failure。

普通库选择、文件命名、测试 helper 和上述已冻结的 provider audit 不再升级为 Open Question。

## Plan self-review

- 本计划只修订了设计与执行边界，没有修改业务源码、测试源码、CI 或 `package.json`。
- 本轮不创建 branch、commit、push 或 PR。
- Plan freeze 时的实施授权由 Project Controller 单独控制；当前执行轮已通过正式授权消息进入实施。后续执行者不得从本文件推断授权状态，必须以当前 Controller 指令为准。
