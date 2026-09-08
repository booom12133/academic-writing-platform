# P2 Product Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重写已接受 A→E6/P1 核心能力的前提下，把身份、文档、AI 工具、任务、知识库、学术搜索、Zotero 和有据写作连接成两条真实可验收的 MVP 产品流程。

**Architecture:** P2 增加一层明确的 product capability、auth/session、document workspace、task/result 和 knowledge-product orchestration contracts。前端只把 production-ready 能力暴露为可执行入口；后端通过同一 capability policy 防止绕过 UI 直接提交 synthetic/legacy 工具。Knowledge indexing 与 E6 grounded generation 保持同步 HTTP 语义，不引入 durable queue、worker 或 TasksModule integration。

**Tech Stack:** React 19、React Router 6、TypeScript、Vite、axios、NestJS 10、Drizzle ORM、PostgreSQL/pgvector、Jest + ts-jest、accepted baseline 已存在的 `@lark-apaas/client-toolkit`、C1/C2/C3 document pipeline、E1/E2/E3 knowledge pipeline、E4 Zotero、E5 Academic Search、E6 Grounded Generation。P2 不预设 `@lark-apaas/auth-sdk` 已安装或具有可调用 API。

**Spec:** 当前任务中的 P2 Frozen Scope、Workflow A/B、P2-WP1～P2-WP8 设计冻结约束，以及 `docs/plans/PHASE_P2_GITHUB_AUDIT_DRAFT.md`。

## Global Constraints

- Accepted baseline 是 `main`、`origin/main`、`phase-p1-accepted` 均指向 `862b0548943fb09913c524b5d0178151524bf946`。
- `P2_IMPLEMENTATION_PLAN=DRAFT`；计划本身不构成 `IMPLEMENTATION_AUTHORIZED`、`REVIEW_PASS`、`ACCEPTED`、merge 或 push 授权。
- One Phase = One Branch；获授权后才从 accepted `main` 创建 P2 分支，禁止直接在 `main` 实施。
- production-visible capability 必须是真实能力；synthetic/mock generator 不能以 production tool 形式暴露。
- legacy `literature` generator 可能生成虚构论文；P2 不修补其模板，而是将其从 production execution gate 移除，真实发现入口改为 Academic Search。
- 所有仍显示“上传论文/资料”的 production tool 必须最终提交真实 `DocumentInputRef`；不能以 filename、file size、file count 或 ref count 代替文档内容。
- 复用并保持 Polish、Paper Revision、Topic Generation、Knowledge、Retrieval、Grounded Generation 既有 accepted 语义；只增加 additive product wiring、DTO、UI 和必要的 owner-scoped read facade。
- Knowledge/Indexing 只增加产品编排，不修改 E1 provenance、E2 embedding/index lifecycle、E3 retrieval/evidence assembly 的算法或数据库语义。
- P2 不实现 durable queue、crash replay、object storage、distributed rate limiting、multi-node filesystem redesign、payment provider、production deployment rehearsal、E7/E8。
- P2 不把同步 Knowledge indexing 或同步 E6 generation 包装成可靠后台任务；页面必须显示其同步/失败边界。
- P2 不引入新的生产依赖，除非在 Plan Review 中明确批准；优先使用现有 axios、React state、Jest 和现有 UI primitives。
- 每个实现 slice 都遵循 `failing test → minimal implementation → targeted regression → next slice`，禁止一次性改写多个高风险系统。
- 每次 push 前必须核对 `origin` 与 repository-local `http.version=HTTP/1.1`；本计划阶段不 push。

---

## 0. Baseline, authority and planning gates

### 0.1 已核验代码事实

当前代码已具备：

- React route `/`、`/tools/:toolType`、`/tasks`、`/tasks/:taskId`、`/profile`、`/recharge`、`/login`、`/register`。
- `client/src/api/` 中的 users、tasks、points、orders、AI submit、document upload wrappers。
- `/api/document-inputs` 的 C4 真实 multipart upload、owner validation、hash verification 和 C1→C2→C3 preparation。
- Polish/Paper Revision 的 D2/D3 typed submission 和真实 LLM execution pipeline。
- E4 Zotero controller/import service、E5 authenticated Academic Search、E6 authenticated synchronous Grounded Generation。
- E1/E2/E3 的 Knowledge、embedding/index、retrieval/evidence 服务与 PostgreSQL schema。
- P1 的 runtime profiles、standalone JWT/JWKS guard、local development auth middleware、PostgreSQL/pgvector、private filesystem、health/security/CI gates。

当前代码仍存在：

- 登录页写入 `aw_user_token=mock_token`，注册页只做本地延迟；请求 client 没有产品级 session contract。
- 多数工具上传 UI 只保存 File 或 filename/count；只有 Polish/Paper Revision 使用真实 `DocumentInputRef`。
- 通用 legacy generators 大量是模板、随机数或示例数据；`literature` 生成器不能作为真实文献发现产品暴露。
- 任务 keyword 在 client 发送但 server 不过滤；TaskDetail 下载按钮没有有效 action；rerun state 没有被工具页消费。
- Knowledge、Academic Search、Zotero、Grounded Generation 没有前端 route/API/UI。

### 0.2 先决 planning gates

P2 Design authority = ChatGPT 的 P2 Design Review decision + 本计划记录的 Frozen Scope。当前不要求另建独立 P2 design spec；若后续治理 closeout 需要独立设计文档，必须由 ChatGPT 单独授权。

实现授权前仍必须完成本草案的 ChatGPT Plan Review re-review；该流程门槛不等于已获得 `IMPLEMENTATION_AUTHORIZED`。

Auth 的实施决策边界如下：platform 先复用并核验 accepted baseline 中 `@lark-apaas/client-toolkit` 的 `getAxiosForBackend`、package exports、lockfile 与现有 session/cookie 用法；standalone 只实现可注入的真实 bearer/session acquisition boundary；local 继续复用现有 local development authentication middleware。若核验后确实需要新增 `@lark-apaas/auth-sdk`，必须把它作为独立 dependency decision 返回 ChatGPT Review，不能自动安装。

Workflow B 的 Knowledge indexing 在 P2 明确采用 synchronous HTTP orchestration。P3 只负责未来真实 deployment、topology 和 end-to-end validation；durable queue、worker、crash replay、distributed execution、task recovery 等不自动归入 P3，只有未来部署证据证明 MVP 必须具备时，才通过新的 architecture/change-control decision 决定后续 Phase。

### 0.3 Migration posture

P2 默认不新增 migration，也不修改 `server/database/schema.ts`。原因是现有表已经覆盖：

- `app_users`、`tasks`、`point_records`、`recharge_orders`；
- `zotero_connections`；
- `knowledge_source_records`、`knowledge_metadata_assertions`、`knowledge_source_external_links`；
- `knowledge_documents`、`knowledge_document_versions`、`knowledge_chunks`、`knowledge_imports`；
- `knowledge_embedding_indexes`、`knowledge_chunk_embeddings`。

P2 的 product DTO、capability state、document listing、index orchestration 和 client-side copy/export 均可使用现有 JSON/关系表。任何实现者若认为必须新增列或表，必须先把 migration 作为独立 Blocking decision 提交审查，不得顺手修改 accepted schema。

## 1. File map and responsibility boundaries

下面是获授权实现后允许触及的主要文件范围。文件名是计划接口的一部分；未列出的 legacy generator、C1/C2/C3、E1/E2/E3、E4/E5/E6 核心文件保持冻结。

| WP | Create | Modify | Reuse unchanged | Test additions |
|---|---|---|---|---|
| WP1 | `shared/product-capability.interface.ts`; `shared/product-capability.catalog.ts`; `server/modules/ai-tools/product-capability.policy.ts`; `client/src/pages/Tools/CapabilityGate.tsx` | `server/modules/ai-tools/ai-tools.service.ts`; `server/modules/ai-tools/ai-tools.controller.ts`; `client/src/api/ai-tools.ts`; `client/src/pages/Home/HomePage.tsx`; `client/src/pages/Tools/ToolsPage.tsx`; `client/src/pages/Tools/ToolSidebar.tsx`; `client/src/pages/Tools/ToolHelper.tsx` | existing generators and `shared/api.interface.ts` `TaskType`/legacy `TOOL_CONFIGS` | `server/modules/ai-tools/product-capability.policy.spec.ts`; `server/modules/ai-tools/ai-tools.controller.spec.ts` additive cases; `test/unit/product-capability-client.spec.ts`; `test/unit/tool-capability-gate.spec.ts` |
| WP2 | `client/src/auth/session.types.ts`; `client/src/auth/session-provider.ts`; `client/src/auth/AppAuthProvider.tsx`; `client/src/auth/RequireAuth.tsx`; `client/src/api/http.ts` | `client/src/app.tsx`; `client/src/pages/Login/LoginPage.tsx`; `client/src/pages/Register/RegisterPage.tsx`; `client/src/components/Layout.tsx`; `client/src/components/Navbar.tsx`; all product wrappers in `client/src/api/*.ts` | `server/auth/**`; `server/middleware/local-development-auth.middleware.ts`; accepted `@lark-apaas/client-toolkit` `getAxiosForBackend` and existing session/cookie behavior | `test/unit/auth-session-client.spec.ts`; `test/unit/api-auth-context.spec.ts`; existing `server/auth/*.spec.ts` regression |
| WP3 | `shared/knowledge-product.interface.ts`; `server/modules/knowledge-product/knowledge-product.module.ts`; `knowledge-product.controller.ts`; `knowledge-product.service.ts`; `knowledge-product.http.dto.ts`; `knowledge-product.errors.ts`; `knowledge-product.types.ts`; `client/src/api/knowledge.ts`; `client/src/components/documents/DocumentWorkspacePicker.tsx`; `client/src/components/documents/DocumentUploadFlow.tsx`; `client/src/pages/Knowledge/KnowledgePage.tsx`; `test/unit/knowledge-product-client.spec.ts` | `server/modules/knowledge/knowledge.repository.ts`; `server/modules/knowledge/knowledge.types.ts` only for additive projection types; `server/app.module.ts`; `client/src/app.tsx`; `client/src/components/Navbar.tsx`; `client/src/pages/Tools/tools/ToolCommon.tsx`; `client/src/pages/Tools/tools/PolishTool.tsx`; `client/src/pages/Tools/tools/PaperRevisionTool.tsx` | `DocumentInputService`, `/api/document-inputs`, C1/C2/C3 parser/context/chunker, D2/D3 submission services | `server/modules/knowledge-product/knowledge-product.service.spec.ts`; `knowledge-product.controller.spec.ts`; `test/unit/knowledge-product.http.integration.spec.ts`; existing C4 client/server tests |
| WP4 | `client/src/pages/Tools/tool-input-contract.ts`; `test/unit/ai-tool-input-contract.spec.ts`; `server/modules/ai-tools/product-tool-input.policy.spec.ts` | `server/modules/ai-tools/product-capability.policy.ts`; `server/modules/ai-tools/ai-tools.service.ts`; `client/src/pages/Tools/ToolsPage.tsx`; `client/src/pages/Tools/tools/PolishTool.tsx`; `client/src/pages/Tools/tools/PaperRevisionTool.tsx`; `client/src/api/ai-tools.ts` | D2/D3/Topic generators; all non-production legacy generator source files | `server/modules/ai-tools/product-tool-input.policy.spec.ts`; `test/unit/ai-tool-input-contract.spec.ts`; `test/unit/production-capability-boundary.spec.ts` |
| WP5 | `shared/task-result.interface.ts`; `client/src/components/tasks/TaskStatePanel.tsx`; `client/src/components/tasks/TaskResultActions.tsx`; `client/src/lib/task-result.ts`; `client/src/lib/task-actions.ts`; `test/unit/task-result-client.spec.ts`; `test/unit/task-actions-client.spec.ts` | `server/modules/tasks/tasks.controller.ts`; `server/modules/tasks/tasks.service.ts`; `client/src/api/task.ts`; `client/src/pages/Tasks/TasksPage.tsx`; `client/src/pages/TaskDetail/TaskDetailPage.tsx` | `tasks` table; `AiToolsService` in-process lifecycle; existing per-tool result renderers until individually migrated | `server/modules/tasks/tasks.service.spec.ts`; `server/modules/tasks/tasks.controller.spec.ts`; `test/unit/task-search-client.spec.ts`; `test/unit/task-result-client.spec.ts` |
| WP6 | `shared/academic-search.interface.ts`; `shared/zotero.interface.ts`; `client/src/api/academic-search.ts`; `client/src/api/zotero.ts`; `client/src/pages/AcademicSearch/AcademicSearchPage.tsx`; `client/src/pages/Zotero/ZoteroPage.tsx`; `client/src/components/academic-search/AcademicSearchResultCard.tsx`; `client/src/components/zotero/ZoteroConnectionPanel.tsx`; `client/src/components/zotero/ZoteroItemsList.tsx`; `test/unit/academic-search-client.spec.ts`; `test/unit/zotero-client.spec.ts` | `client/src/app.tsx`; `client/src/components/Navbar.tsx`; server controllers only if type re-export is needed | E4 Zotero connector/import services; E5 OpenAlex service/provider/cursor; E1 metadata provenance | existing E4/E5 unit, HTTP and integration suites; new client API contract tests |
| WP7 | `server/modules/knowledge-product/knowledge-product.indexing.ts`; `test/unit/knowledge-product-indexing.spec.ts`; `test/unit/knowledge-product-indexing.http.integration.spec.ts` | `server/modules/knowledge-product/knowledge-product.module.ts`; `knowledge-product.controller.ts`; `knowledge-product.service.ts`; `server/modules/knowledge/knowledge.repository.ts`; `server/modules/knowledge/indexing/knowledge-index.repository.ts`; `server/modules/knowledge/indexing/knowledge-indexing.types.ts`; `server/app.module.ts`; `client/src/api/knowledge.ts`; `client/src/pages/Knowledge/KnowledgePage.tsx` | E1 `KnowledgeService.importDocument`; E2 `KnowledgeIndexingService.indexVersion/retryIndex`; E3 retrieval/evidence | existing E1/E2/E3 tests; additive owner/idempotency/status tests; PostgreSQL product HTTP integration |
| WP8 | `client/src/api/grounded-generation.ts`; `client/src/pages/GroundedWriting/GroundedWritingPage.tsx`; `client/src/components/grounded-writing/EvidenceSelectionPanel.tsx`; `client/src/components/grounded-writing/GroundedResultPanel.tsx`; `client/src/lib/grounded-writing.ts`; `test/unit/grounded-generation-client.spec.ts`; `test/unit/grounded-writing-client.spec.ts` | `client/src/app.tsx`; `client/src/components/Navbar.tsx`; `client/src/pages/Knowledge/KnowledgePage.tsx` | E3 `KnowledgeEvidenceService`; E6 controller/service/DTO/citation/evidence implementation | existing `server/modules/grounded-generation/**` and `test/unit/grounded-generation-boundary.spec.ts`; new client request/response contract tests |

## 2. Shared contracts and cross-WP interfaces

### 2.1 Product capability contract

Create `shared/product-capability.interface.ts` without changing the legacy `TaskType` union, and create `shared/product-capability.catalog.ts` as the only authoritative static capability/readiness catalog:

```ts
export type ProductCapabilityReadiness = 'production' | 'preview' | 'disabled';
export type ProductInputMode = 'text' | 'document-ref' | 'knowledge-selection';
export type ProductExecutionKind = 'llm' | 'document-pipeline' | 'integration' | 'legacy';

export interface ProductToolCapability {
  type: import('./api.interface').TaskType;
  readiness: ProductCapabilityReadiness;
  execution: ProductExecutionKind;
  inputModes: ProductInputMode[];
  replacementRoute?: string;
  supportsCopy: boolean;
  supportsExport: boolean;
}
```

`shared/product-capability.catalog.ts` owns the complete mapping of capability type, readiness, execution kind, input modes, replacement route and copy/export support. It exports the catalog and pure lookup helpers. The server policy imports this catalog only to enforce submission rules; the client imports the same catalog/helpers for navigation and route gating. The server capability API, if retained, serializes catalog entries and adds no second readiness mapping or override. `client/src/api/ai-tools.ts` may normalize that response but must not redefine capability truth.

The initial production set is `topic-generation`, `polish`, and `paper-revision`. Academic Search, Knowledge, Zotero, and Grounded Writing are separate product capabilities rather than `TaskType` values. `literature` is `disabled` with replacement route `/academic-search`; other legacy tools are `preview` or `disabled` according to whether the current generator consumes real user input. The default catalog must not show `preview`/`disabled` items as ordinary executable tools.

### 2.2 Document workspace contract

Use existing `DocumentInputRef` for tool execution and add a product projection for selectable documents:

```ts
export interface KnowledgeWorkspaceDocument {
  document: {
    id: string;
    userId: string;
    sourceRecordId?: string;
    originKind: 'user-upload' | 'generated-artifact' | 'external-attachment';
    displayName: string;
    sourceType: 'docx' | 'pdf' | 'txt' | 'markdown';
    activeVersionId?: string;
    lifecycleStatus: 'active' | 'tombstoned';
    createdAt?: string;
    updatedAt?: string;
  };
  activeVersion?: {
    id: string;
    documentId: string;
    versionNumber: number;
    readinessStatus: 'content-ready-for-indexing';
    createdAt: string;
  };
  documentRef?: import('./document-input.interface').DocumentInputRef;
  index?: {
    id: string;
    status: 'indexing' | 'indexed' | 'failed' | 'stale';
    totalChunks: number;
    indexedChunks: number;
    failedChunks: number;
    lastErrorCode?: string;
    lastErrorMessage?: string;
  };
}
```

The actual implementation must not import server-only types into the browser. The browser-facing version should define the same JSON shape in `client/src/api/knowledge.ts`; the server implementation derives `documentRef` from `activeVersion.sourceArtifactRef + document.sourceType` only when the version has a stored artifact. `sourceText` versions are selectable for grounded writing but do not expose a file ref to Polish/Paper Revision.

### 2.3 Task/result contract

Create `shared/task-result.interface.ts` with a non-breaking envelope used for new accepted results:

```ts
export type TaskResultKind = 'polish' | 'paper-revision' | 'topic-generation' | 'legacy-preview';

export interface TaskResultEnvelope {
  schemaVersion: 1;
  kind: TaskResultKind;
  content?: string;
  originalContent?: string;
  revisedContent?: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
  exportable: boolean;
}
```

The initial adapter must accept existing `resultData` shapes and return a typed envelope; it must not rewrite stored historical `resultData`. Missing or malformed fields produce a visible “结果格式不可用” error state instead of a false empty result.

### 2.4 Error and auth contract

All new client wrappers normalize errors to:

```ts
export interface ProductApiError {
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
}
```

`client/src/auth/session.types.ts` must define an injectable `AuthAdapter` boundary (the exact provider implementation is selected only after package/export verification):

```ts
export type AuthSessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface AuthSessionSnapshot {
  status: AuthSessionStatus;
  userId?: string;
  displayName?: string;
  loginUrl?: string;
  errorCode?: string;
}

export interface AuthAdapter {
  getSession(): Promise<AuthSessionSnapshot>;
  getAccessToken(): Promise<string | null>;
  beginLogin?: (returnUrl: string) => void | Promise<void>;
  signOut?: () => Promise<void>;
}
```

The adapter must never manufacture `mock_token`, fake bearer credentials or hard-coded JWTs. Optional `beginLogin`/`signOut` are capabilities supplied by a verified host/provider; the client must show configuration unavailable when a protected mode has no real operation, rather than inventing a redirect or login success. The client must never persist an access token supplied only for local demo purposes in a production-visible code path.

## 3. P2-WP1 — Capability Inventory & Product Truth

### Objective

Create one authoritative production-readiness view for tool navigation and server submission. Keep legacy `TOOL_CONFIGS` for compatibility, but stop treating its presence as proof of real execution.

### Interfaces

- `PRODUCT_CAPABILITY_CATALOG`, `getProductCapabilities()` and `productCapabilityFor(type)` in `shared/product-capability.catalog.ts` are the only static capability/readiness truth used by server, client and tests.
- `product-capability.policy.ts` is an enforcement adapter, not a second catalog: `assertToolSubmissionAllowed(type, inputData): void` always evaluates the shared catalog and rejects disabled/preview submissions with stable error code `AI_TOOL_NOT_PRODUCTION_READY`.
- The production `/api/ai-tools/submit` path always executes that policy. It has no `runtime`, `NODE_ENV`, local-runtime or test-runtime bypass.

### TDD slices

- [ ] **Slice 1: Write the failing capability inventory tests.**

  Test `productCapabilityFor('polish')`, `productCapabilityFor('paper-revision')`, and `productCapabilityFor('topic-generation')` as `production`; assert `literature` is not production and has `/academic-search` as its replacement route. Assert every production capability has at least one real input mode and `execution !== 'legacy'`.

- [ ] **Slice 2: Run the focused tests and verify the contract is absent.**

  Run `npx jest test/unit/product-capability-client.spec.ts server/modules/ai-tools/product-capability.policy.spec.ts --runInBand`.

  Expected: FAIL because the shared capability contract and policy do not exist.

- [ ] **Slice 3: Add the minimal shared catalog and enforcement adapter.**

  Create `shared/product-capability.interface.ts`, `shared/product-capability.catalog.ts` and `server/modules/ai-tools/product-capability.policy.ts`. Keep the legacy `TOOL_CONFIGS` unchanged; define the production/preview/disabled mapping only in the shared catalog, make catalog reads defensive, and keep the server policy limited to enforcement.

- [ ] **Slice 4: Expose the catalog from the server and make the client consume the same source.**

  Modify `AiToolsService.getToolConfigs()`/controller return types to serialize `ProductToolCapability[]` directly from the shared catalog. Update `client/src/api/ai-tools.ts` and Home/Tools navigation to import/use the same catalog; response normalization may validate the shape but must not create another readiness mapping.

- [ ] **Slice 5: Add the route gate.**

  Create `CapabilityGate.tsx`. In `ToolsPage.tsx`, resolve the requested type through `productCapabilityFor` from the shared catalog before rendering a tool. A disabled literature route renders a message and a link to `/academic-search`; preview routes render a clear preview state with no submit button; production routes render the existing component.

- [ ] **Slice 6: Enforce the server boundary without bypasses.**

  Call `assertToolSubmissionAllowed` at the beginning of `AiToolsService.submitTask`. The same policy must run in production, local runtime and Jest. Legacy generators may continue to have independent direct unit tests, but no `/api/ai-tools/submit` request may reach a non-production capability and no environment-specific exception may weaken this rule. Do not alter generator implementations.

- [ ] **Slice 7: Verify UI and server regression.**

  Run the focused tests, existing `server/modules/ai-tools/ai-tools.service.spec.ts`, `server/modules/ai-tools/ai-tools.module.spec.ts`, `npm run type:check:server`, and `npm run type:check:client`.

### Completion conditions

- Home/sidebar/default tool catalog exposes only production capabilities as executable.
- Direct `/tools/literature` cannot submit the legacy fictional-literature generator and points to Academic Search.
- Direct API submission of a disabled/preview tool is rejected in production runtime with a stable sanitized error.
- Existing accepted topic/polish/paper-revision generator tests remain unchanged and pass; legacy generator unit tests remain direct generator tests and do not authorize API submission.
- No migration and no legacy generator semantic change.

## 4. P2-WP2 — Auth & Session Integration

### Objective

Replace the mock login/register flow with a product-level session boundary. P2 integrates existing platform/local auth contexts; P3 remains responsible for production IdP/JWKS deployment rehearsal and operator configuration.

### Provider decisions

- `platform`: first verify the accepted baseline's `@lark-apaas/client-toolkit` package exports, lockfile and existing `getAxiosForBackend` usage. Reuse its actual platform session/cookie behavior. Do not assume a direct auth SDK or any login/session method that is not present in those verified sources. If a browser login handoff is not exposed, surface configuration unavailable instead of fabricating one.
- `local-fixed`: bootstrap with the existing `/api/users/profile` call through the existing local development authentication middleware; display a development-only local identity banner rather than a fake login success.
- `standalone-jwt`: use an injected `AuthAdapter`/host bridge to supply a real bearer token and, only if supplied, a real login handoff. No provider configured means fail closed with an explicit configuration-unavailable state. P3 verifies actual OIDC/JWKS browser handoff and deployment behavior; P2 does not implement either.

### Files and interfaces

- Create the five auth files listed in the file map.
- `client/src/api/http.ts` owns the product axios instance and request/response normalization. It may wrap `getAxiosForBackend()` but must not edit `node_modules`.
- All product API wrappers (`user.ts`, `task.ts`, `point.ts`, `order.ts`, `ai-tools.ts`, `document-input.ts`, and new wrappers) import the product HTTP module, so 401 handling is centralized.
- `RequireAuth` accepts `children`, optional `returnTo`, and renders a loading/anonymous/error state.

### TDD slices

- [ ] **Slice 1: Verify the available platform auth surface and define session state transitions.**

  Before choosing a platform adapter implementation, inspect `package.json`, the lockfile, `@lark-apaas/client-toolkit` exports and existing repository usage for the actual session/cookie behavior. Add `test/unit/auth-session-client.spec.ts` with cases for authenticated, anonymous, provider failure, optional `signOut`, and no-token standalone configuration. Assert no state transition writes `aw_user_token`.

- [ ] **Slice 2: Run the client auth tests before implementation.**

  Run `npx jest test/unit/auth-session-client.spec.ts --runInBand`.

  Expected: FAIL because the auth provider and session state do not exist.

- [ ] **Slice 3: Implement adapters against verified boundaries.**

  Implement `AuthAdapter` with injected functions so tests can use an in-memory adapter without creating a fake product login. The platform adapter may map the actual verified toolkit/session result to `userId/displayName`; the local adapter reads profile through the product HTTP module; the standalone adapter asks the host bridge for a real token and optional real login/logout operations, and fails closed when unavailable. If this requires a direct `@lark-apaas/auth-sdk` dependency, stop and return that dependency decision to ChatGPT Review; do not install it automatically.

- [ ] **Slice 4: Implement `AppAuthProvider` and `RequireAuth`.**

  Load one session snapshot at app start, expose `refreshSession` and `logout`, and redirect anonymous users to `/login?returnTo=<encoded-current-path>`. Protected routes include tools, tasks, profile, recharge, knowledge, academic search, Zotero, and grounded writing.

- [ ] **Slice 5: Replace login/register behavior.**

  `LoginPage` invokes the adapter's verified `beginLogin` only when it exists for platform/standalone; otherwise it shows configuration unavailable. It only displays local-fixed development identity when that mode is active. `RegisterPage` becomes an auth-provider registration handoff only when a verified operation exists, or an explicit “由组织身份系统创建账户” state; remove the simulated delay and mock token write.

- [ ] **Slice 6: Centralize request auth and 401 handling.**

  `http.ts` attaches `Authorization: Bearer <token>` only when the standalone provider returns a real token, preserves platform cookie requests, maps 401 to a session refresh/anonymous event, and prevents repeated redirect loops. Add tests that request config never contains `mock_token` and that 401 maps to `anonymous`.

- [ ] **Slice 7: Update layout and navbar.**

  `Navbar` consumes context instead of independently fetching profile/balance on every mount. Logout awaits provider `signOut`, clears local UI state, and navigates to the saved login return path. Keep profile/points API calls owner-scoped on the server.

- [ ] **Slice 8: Run auth and full client regression.**

  Run `npx jest test/unit/auth-session-client.spec.ts test/unit/api-auth-context.spec.ts server/auth server/middleware/local-development-auth.middleware.spec.ts --runInBand`, then `npm run type:check:client` and `npm run build:client`.

### Completion conditions

- No product source writes `aw_user_token=mock_token`.
- No simulated registration success is presented as an account creation result.
- Anonymous protected routes show a deterministic real login handoff when the adapter provides one, otherwise a configuration-unavailable state; authenticated calls preserve user isolation.
- Local development remains usable through existing fixed middleware.
- Standalone production auth is represented by a real-token adapter boundary with fail-closed behavior when unconfigured; no fake login and no P3 IdP deployment work is added.
- No user/auth migration is added.

## 5. P2-WP3 — Document Workspace & Input Unification

### Objective

Turn C4 document upload into a reusable document workspace. Reuse `/api/document-inputs` for upload and `KnowledgeService.importDocument` for durable knowledge ownership. Polish/Paper Revision must accept either a freshly uploaded ref or a workspace-selected stored artifact ref.

### Server API contract

Add authenticated routes in `KnowledgeProductController`:

```text
POST   /api/knowledge/documents
GET    /api/knowledge/documents
GET    /api/knowledge/documents/:documentId
DELETE /api/knowledge/documents/:documentId
```

`POST /api/knowledge/documents` accepts:

```ts
interface ImportWorkspaceDocumentRequest {
  idempotencyKey: string;
  displayName: string;
  documentRef: DocumentInputRef;
  sourceRecordId?: string;
  chunkingPolicy?: { maxSize: number };
}
```

The controller obtains `userId` only from `req.userContext`; it never trusts a body `userId`. The service calls accepted `KnowledgeService.importDocument({ originKind: 'user-upload', input: { kind: 'stored-file', documentRef }, chunkingPolicy: { maxSize: 2_000, ...request.chunkingPolicy } })`. It returns a `KnowledgeWorkspaceDocument` projection and does not index yet.

### Files and reuse

- Add `KnowledgeProductModule` and import it from `server/app.module.ts`; it imports existing `KnowledgeModule` and `DocumentInputModule` only.
- Add owner-scoped `listDocuments(userId)` to `KnowledgeRepositoryPort`/`KnowledgeRepository`; keep existing import/version/tombstone behavior unchanged.
- `DocumentUploadFlow` composes existing `documentInputApi.uploadDocument()` then `knowledgeApi.importDocument()` with a browser-generated idempotency key.
- `DocumentWorkspacePicker` returns `{ documentRef, documentId, documentVersionId, displayName }`, not raw File objects or arbitrary path strings.
- Refactor Polish/Paper Revision to use this component; the existing D2/D3 submit helpers still receive the same `DocumentInputRef` shape.

### TDD slices

- [ ] **Slice 1: Add repository projection tests.**

  In `knowledge-product.service.spec.ts`, create fake repository methods for one active document, one active version with `sourceArtifactRef`, and one text-only version. Assert the projection includes a ref only for the stored artifact and never leaks another user's row.

- [ ] **Slice 2: Add import request validation tests.**

  Assert missing idempotency key, invalid document ref, unsupported source type, mismatched owner, and source record from another user map to stable 4xx domain errors before calling `KnowledgeService`.

- [ ] **Slice 3: Run the server product tests before implementation.**

  Run `npx jest server/modules/knowledge-product --runInBand`.

  Expected: FAIL because the product module, DTO and controller do not exist.

- [ ] **Slice 4: Implement the minimal product facade.**

  Add DTO parsing, owner-scoped repository listing, document projection, import delegation, and tombstone delegation. Do not add index calls in this WP.

- [ ] **Slice 5: Add HTTP controller coverage.**

  Test authenticated `POST` delegates the server user id and returns the import projection; anonymous/malformed requests are rejected; `DELETE` only tombstones the authenticated owner. Use the same controller/filter style as E4/E5/E6 HTTP tests.

- [ ] **Slice 6: Add client API and pure picker state.**

  Add `knowledgeApi.importDocument`, `listDocuments`, `getDocument`, `deleteDocument`. Add a pure reducer or state transition helper for `idle → selecting → uploading → importing → ready/error`, and test that selecting a new file clears the prior descriptor/ref.

- [ ] **Slice 7: Integrate the workspace page.**

  Add `/knowledge` route. The page lists documents, active version, read-only index status, source type and actions. It must distinguish upload failure, import failure, empty workspace and loading.

- [ ] **Slice 8: Reuse the picker in the two real document tools.**

  Replace duplicated file/ref state in `PolishTool.tsx` and `PaperRevisionTool.tsx` with `DocumentWorkspacePicker`. Fresh upload still calls `/api/document-inputs`; selected workspace documents supply the reconstructed ref; submit remains blocked until a valid ref exists.

- [ ] **Slice 9: Run C4/D2/D3 regressions.**

  Run `npx jest server/modules/document-input test/unit/document-input-client.spec.ts test/unit/polish-migration-client.spec.ts test/unit/paper-revision-migration-client.spec.ts server/modules/knowledge-product --runInBand`, then `npm run type:check` and `npm run build:client`.

### Completion conditions

- Workflow A can upload a document once, import it into the workspace, select it later, and submit Polish/Paper Revision with a genuine `DocumentInputRef`.
- No production document tool sends only filename/count metadata.
- Document list, import, selection, and tombstone are authenticated and owner-scoped.
- C4 upload/storage/parser/context/chunk semantics are reused unchanged.
- No migration and no background worker are added.

## 6. P2-WP4 — AI Tool Execution Closure

### Objective

Make the production capability surface truthful and close the remaining execution contract around the three P2 production tool paths. Legacy tool forms remain source-compatible but are not allowed to present synthetic output as production capability.

### Execution policy

- `topic-generation`: keep the accepted `TopicGenerationGenerator`/LLM path.
- `polish`: keep the accepted D2 text and document-ref path.
- `paper-revision`: keep the accepted D3 text and document-ref path.
- `literature`: route to Academic Search; never invoke the legacy fake generator through a production-visible path.
- File-oriented legacy forms in `FormatTool.tsx`, `CheckTool.tsx`, `AiReduceTool.tsx`, `CommentRevisionTool.tsx`, `DataAnalysisTool.tsx`, `PaperReverseTool.tsx`, `ThesisTool.tsx`, `GraduationDesignTool.tsx`, `ProposalTool.tsx`, `PracticeReportTool.tsx`, `JournalPaperTool.tsx` and similar components are either behind `CapabilityGate` or are converted to the shared picker only when their capability is explicitly promoted. They must not remain visibly executable with filename/count-only submission.

### TDD slices

- [ ] **Slice 1: Write input-contract tests.**

  Add `test/unit/ai-tool-input-contract.spec.ts` asserting Polish file requests contain `documentRef` and no File/name-only field; Paper Revision has the same rule; topic generation accepts real text fields; all disabled file capabilities reject a submission with only `fileName`, `fileSize`, `fileCount`, `refCount`, or `resourceCount`.

- [ ] **Slice 2: Run input-contract tests before implementation.**

  Run `npx jest test/unit/ai-tool-input-contract.spec.ts server/modules/ai-tools/product-tool-input.policy.spec.ts --runInBand`.

  Expected: FAIL because the product input policy and canonical validators do not exist.

- [ ] **Slice 3: Implement the smallest policy layer.**

  Add pure `validateProductToolInput(capability, inputData)` and call it from the server submission boundary. It must accept the existing typed D2/D3 shapes, reject file metadata without a ref, and return stable error codes without invoking a generator.

- [ ] **Slice 4: Gate legacy UI paths.**

  Update `ToolsPage` and `CapabilityGate` so direct URLs to disabled/preview tools do not mount a submit-capable form. Keep legacy components intact unless they are needed for an approved production capability; this prevents a broad unreviewed generator rewrite.

- [ ] **Slice 5: Add explicit literature replacement UX.**

  The literature route explains that fictional references are unavailable, links to `/academic-search`, and does not call `/api/ai-tools/submit`. Add a client test for the replacement route and a server production-policy test for `literature` rejection.

- [ ] **Slice 6: Verify accepted real execution paths.**

  Re-run `server/modules/ai-tools/generators/topic-generation.generator.spec.ts`, all Polish/Paper Revision suites, `server/modules/ai-tools/ai-tools.service.spec.ts`, and the capability boundary tests. Ensure no DeepSeek call is made by unit tests.

### Completion conditions

- The production catalog contains no executable fake literature discovery path.
- Every production file submission reaches the server as a validated `DocumentInputRef`.
- Topic/Polish/Paper Revision behavior and accepted result shapes remain regression-safe.
- Legacy tools are visibly labeled preview/disabled or excluded; they cannot silently return synthetic results as production output.
- No legacy generator is rewritten in bulk and no new AI provider is introduced.

## 7. P2-WP5 — Task & Result UX

### Objective

Make Workflow A operational after submission: truthful task search, visible loading/error/empty states, rerun/continue semantics, copy/export for text results, and no dead download controls.

### Server contract

Extend `GET /api/tasks` with `keyword?: string`:

```ts
interface ListUserTasksInput {
  userId: string;
  page: number;
  pageSize: number;
  taskType?: TaskType;
  status?: TaskStatus;
  keyword?: string;
}
```

The service trims and bounds keyword length, filters owner-scoped title and UUID text, and keeps existing pagination. The controller reads `@Query('keyword')`. Do not add a task type or migration for indexing/grounded generation; E6 explicitly froze TasksModule integration.

### Client action semantics

- `Retry load`: retry a failed GET/list/detail request; does not charge points.
- `Rerun task`: submit the stored original input as a new AI task, after explicit confirmation that points may be charged again.
- `Continue editing`: navigate to `/tools/:taskType` with a sanitized `location.state` payload; each production tool consumes only recognized fields and clears state after initialization.
- `Copy`: copy normalized text to clipboard and show success/error feedback.
- `Export`: create a client-side `.md` or `.txt` Blob only for `TaskResultEnvelope.exportable=true`; do not show a fake server download button when `downloadUrl` is empty.
- `Cancel`: not added as server execution cancellation in P2 because the current in-process task lifecycle has no durable cancellation contract. UI may delete completed/failed records through the existing endpoint, but must not label deletion as cancellation.

### TDD slices

- [ ] **Slice 1: Add server keyword tests.**

  Add cases to `tasks.service.spec.ts` for title match, UUID text match, non-match, owner isolation, empty keyword, and bounded keyword. Add controller coverage asserting `keyword` is forwarded to the service.

- [ ] **Slice 2: Run task tests before implementation.**

  Run `npx jest server/modules/tasks/tasks.service.spec.ts server/modules/tasks/tasks.controller.spec.ts --runInBand`.

  Expected: FAIL for keyword forwarding/filtering because the current controller/service ignore the field.

- [ ] **Slice 3: Implement minimal keyword filtering.**

  Add the optional parameter and Drizzle condition using owner-scoped `and(...)`; use a safe text cast for UUID matching or restrict matching to title and a validated UUID prefix. Preserve sort and pagination.

- [ ] **Slice 4: Add result envelope adapters.**

  Create `shared/task-result.interface.ts` and `client/src/lib/task-result.ts`. Adapt current Polish/Paper Revision/Topic result fields into a stable envelope; return an invalid-result state when required strings/arrays are absent.

- [ ] **Slice 5: Add action helper tests.**

  Test `buildRerunPayload(task)` removes `id`, `status`, `resultData`, `errorMessage`, and `pointsCost`; preserves only recognized inputData; test `exportTaskResult` chooses `.md` for markdown and `.txt` for plain text; test copy uses the normalized revised/content field.

- [ ] **Slice 6: Implement reusable task state/actions components.**

  Add `TaskStatePanel`, `TaskResultActions`, `task-actions.ts`, and `task-result.ts`. Components accept explicit callbacks for retry, rerun, continue, copy and export, so they can be unit-tested without browser rendering.

- [ ] **Slice 7: Repair TasksPage states.**

  Add `error` state distinct from `data.items.length === 0`, wire keyword to the now-functional server parameter, disable duplicate search/delete calls, and show a retry action. Keep active polling at the current bounded interval.

- [ ] **Slice 8: Repair TaskDetail actions without rewriting all renderers.**

  Keep existing legacy renderer switch as a compatibility layer. Add the new envelope adapter and actions around accepted Polish/Paper Revision/Topic results. Remove or hide unimplemented download controls; add copy/export and explicit point-charge rerun confirmation. Pass `taskType`, title and sanitized inputData to tool routes.

- [ ] **Slice 9: Consume continue state in production tools.**

  Polish and Paper Revision initialize from recognized text/options/documentRef state only after validating the task type. A mismatched or malformed state is ignored with a visible fresh-form state. Do not trust a client-provided user id or task id.

- [ ] **Slice 10: Verify task/result regression.**

  Run task server suites, the new client pure tests, existing migration client tests, `npm run type:check`, and `npm run build:client`.

### Completion conditions

- Task keyword search matches the documented behavior and remains owner-scoped.
- Network failure is not rendered as “暂无任务/暂无结果”.
- A completed Polish/Paper Revision/Topic task supports copy and client-side export when its result is valid.
- Rerun is an explicit new charge/new task; continue editing actually pre-fills only approved tool fields.
- No fake download action and no P2 durable cancellation claim remain.
- No schema migration and no TasksModule integration for E6/Knowledge indexing.

## 8. P2-WP6 — Academic Search & Zotero Product Integration

### Objective

Expose the accepted E5/E4 HTTP capabilities through real authenticated frontend pages. Academic Search becomes the replacement for fictional literature discovery; Zotero imports real metadata/PDF attachments into the Knowledge product.

### Client contracts

Create shared wire types matching the existing server contracts without changing E4/E5 semantics:

- `AcademicSearchRequest`: `q`, date/year/work type/open-access filters, page size, opaque cursor.
- `AcademicDiscoverySet`: provider/status/items/next cursor/diagnostics/provenance.
- `ZoteroConnection`: connection id/status/library/key fingerprint/health timestamps; never API key.
- `ZoteroItemsPage`: items and optional library version; item `data` remains opaque to the UI except safe display fields.

Add wrappers:

```ts
search(request: AcademicSearchRequest): Promise<AcademicDiscoverySet>
getConnectionHealth(): Promise<ZoteroConnection | null>
connect(apiKey: string): Promise<ZoteroConnection>
disconnect(): Promise<{ status: 'revoked' }>
listItems(): Promise<ZoteroItemsPage>
importItem(itemKey: string): Promise<ZoteroImportResult>
syncItem(itemKey: string): Promise<ZoteroImportResult>
importAttachment(attachmentKey: string): Promise<ZoteroAttachmentImportResult>
```

### TDD slices

- [ ] **Slice 1: Add client API request tests.**

  Mock `axiosForBackend` and assert Academic Search posts only the accepted request keys to `/api/academic-search/search`; assert cursor is passed opaquely and not decoded client-side. Assert Zotero connect posts the API key only in the request body and never stores or returns it.

- [ ] **Slice 2: Run the client integration tests before implementation.**

  Run `npx jest test/unit/academic-search-client.spec.ts test/unit/zotero-client.spec.ts --runInBand`.

  Expected: FAIL because the wrappers/types do not exist.

- [ ] **Slice 3: Implement wrappers and error mapping.**

  Add the two wrappers through `client/src/api/http.ts`; map E5/E4 stable error codes to retryable/non-retryable UI errors without exposing raw upstream messages or secrets.

- [ ] **Slice 4: Build the Academic Search page.**

  Add `/academic-search`, query/filter form, loading/error/empty/partial states, opaque next-page action, provenance display, DOI/landing/PDF links, and “use this query in literature discovery” replacement messaging. Do not claim that a metadata-only search result is indexed content.

- [ ] **Slice 5: Build the Zotero page.**

  Add `/zotero`, connection form, health/revoked state, item list, import/sync actions, attachment import state and safe error handling. Refresh the Knowledge workspace after a successful item/attachment import.

- [ ] **Slice 6: Add product navigation.**

  Add authenticated navbar links to Academic Search, Knowledge, Zotero and Grounded Writing. Keep routes protected by WP2 and preserve existing mobile navigation.

- [ ] **Slice 7: Run E4/E5 regressions and frontend type/build checks.**

  Run existing `server/modules/academic-search`, `server/modules/zotero`, `test/unit/academic-search-frozen-boundary.spec.ts`, `test/unit/zotero-pipeline.integration.spec.ts`, the new client tests, `npm run type:check:client`, and `npm run build:client`.

### Completion conditions

- `/academic-search` performs real authenticated E5 search with opaque cursor and provenance; it does not invoke legacy literature generator.
- `/zotero` can connect, list, import/sync items and import supported PDF attachments through accepted E4 services.
- API keys, raw upstream errors and secret fields never render or persist in browser state.
- Successful Zotero attachment import produces a Knowledge document that WP7 can index.
- No new external connector or migration is introduced.

## 9. P2-WP7 — Knowledge Indexing Orchestration

### Objective

Add product orchestration around E1/E2 without changing E1 provenance, E2 embedding/index lifecycle or E3 retrieval semantics. The user can import/upload a document, explicitly start indexing, observe status, and retry a failed/stale index in the same request-boundary model.

### Server API contract

Extend `KnowledgeProductController`:

```text
POST /api/knowledge/documents/:documentId/index
GET  /api/knowledge/documents/:documentId/index
POST /api/knowledge/indexes/:indexId/retry
```

The service exposes:

```ts
indexActiveVersion(userId: string, documentId: string): Promise<KnowledgeWorkspaceDocument>
getIndexStatus(userId: string, documentId: string): Promise<KnowledgeWorkspaceDocument>
retryIndex(userId: string, indexId: string): Promise<KnowledgeWorkspaceDocument>
```

`indexActiveVersion` verifies owner and active version through additive repository reads, then calls accepted `KnowledgeIndexingService.indexVersion({ userId, documentVersionId })`. It returns the existing index status/counters. It does not create a Task row, points charge, generated artifact or queue record.

Add to `KnowledgeRepositoryPort` only the read operations needed for product projection, such as `listDocuments(userId)` and existing version reads. Add to `KnowledgeIndexRepositoryPort` an owner-scoped `getLatestIndexForVersion(userId, documentVersionId)` or equivalent batch read. Do not alter index transitions, fingerprints, leases, embedding provider behavior or retrieval filters.

### TDD slices

- [ ] **Slice 1: Write orchestration boundary tests.**

  Test `indexActiveVersion` delegates exactly once to `indexVersion` for the active owned version; test missing document, missing active version, cross-user document, failed/stale retry and indexed idempotent behavior; assert no `TasksService` call and no point mutation.

- [ ] **Slice 2: Run the orchestration tests before implementation.**

  Run `npx jest test/unit/knowledge-product-indexing.spec.ts server/modules/knowledge-product --runInBand`.

  Expected: FAIL because the indexing facade and product routes do not exist.

- [ ] **Slice 3: Add index status projection reads.**

  Implement owner-scoped latest-version/index lookups. Keep the workspace response bounded to a small page and avoid exposing `leaseOwner`, raw provider credentials or internal embedding vectors.

- [ ] **Slice 4: Implement synchronous index orchestration.**

  Add the minimal service methods and controller routes. Map known Knowledge/Indexing errors to sanitized product errors with retryable flags. A provider failure returns a visible failed/stale status or stable 5xx; it must not be reported as indexed.

- [ ] **Slice 5: Add HTTP integration coverage.**

  Use a Nest test application with authenticated request context and fake accepted services to verify route paths, user scoping, status response, retry route and absence of Task/points side effects.

- [ ] **Slice 6: Add PostgreSQL product integration coverage without changing package scripts.**

  Add `test/unit/knowledge-product-indexing.http.integration.spec.ts` guarded by `DATABASE_URL`. Migrate the existing `drizzle/migrations` only; seed a user/document/chunks/index and verify owner-scoped status and index lifecycle projection. Do not modify `package.json` or add this suite to `test:integration:postgres`; at acceptance run it explicitly with `npx jest test/unit/knowledge-product-indexing.http.integration.spec.ts --runInBand` and record whether the environment guard ran or skipped.

  WP7 File Map therefore intentionally excludes `package.json`; no package-script change is part of this plan.

- [ ] **Slice 7: Integrate Knowledge page controls.**

  Extend the WP3 index status projection with start-index, progress counters, failure message and retry action. Poll only while the current synchronous call is active or after a refresh; do not invent a durable background status model.

- [ ] **Slice 8: Verify E1/E2/E3 frozen boundaries.**

  Run all Knowledge/indexing/retrieval suites, PostgreSQL integration where available, and boundary checks proving no changes to E1/E2/E3 algorithm files or E6 retrieval wiring.

### Completion conditions

- Workflow B can turn an uploaded PDF or Zotero-imported PDF into a Knowledge document, explicitly index it, and observe `indexed`/`failed`/`stale` state.
- Index status and retry are authenticated, owner-scoped and sanitized.
- The P2 indexing path is synchronous HTTP orchestration: no task row, points charge, queue, worker, crash replay, distributed execution or migration is introduced. P3 deployment/topology/end-to-end validation does not automatically acquire these reliability systems; any later addition requires a new architecture/change-control decision.
- E1/E2/E3 tests and frozen interfaces remain unchanged in meaning.

## 10. P2-WP8 — Grounded Writing & Product Navigation

### Objective

Expose accepted E6 Grounded Generation as a real writing surface over selected indexed Knowledge versions, with citations, bibliography, evidence trace and provenance visible to the user. Keep E6 synchronous and do not index generated content.

### Client request/response contract

`client/src/api/grounded-generation.ts` posts the existing request shape:

```ts
interface GroundedWritingInput {
  instructions: string;
  queryText: string;
  retrieval?: {
    selection?: { mode: 'active' } | { mode: 'explicit'; documentVersionIds: string[] };
    filters?: { documentIds?: string[]; sourceRecordIds?: string[]; sourceKinds?: string[]; originKinds?: string[]; sourceTypes?: string[] };
    policy?: { topK?: number; candidateLimit?: number; minRetrievalScore?: number };
  };
  output?: { format: 'markdown' | 'plain'; citationStyle: 'numeric-inline' };
  grounding?: { onUnbound: 'block' | 'annotate' };
}
```

The response is the existing E6 `GroundedGenerationResult`: `status`, `content`, `claims`, `citations`, `bibliography`, `evidenceTrace`, `grounding`, `provenance`, and generation metadata. Client code must display blocked/partial/grounded distinctly.

### TDD slices

- [ ] **Slice 1: Write request/response contract tests.**

  Assert the client posts to `/api/grounded-generation/generate`, preserves explicit version IDs, sends default `citationStyle: 'numeric-inline'`, and never sends File objects or arbitrary document paths. Assert the result mapper preserves citation ids, bibliography fields, evidence ids, and provenance.

- [ ] **Slice 2: Run the client tests before implementation.**

  Run `npx jest test/unit/grounded-generation-client.spec.ts test/unit/grounded-writing-client.spec.ts --runInBand`.

  Expected: FAIL because the client wrapper and result mapper do not exist.

- [ ] **Slice 3: Implement the wrapper and pure result mapper.**

  Use `client/src/api/http.ts`, return typed E6 response data, and map domain errors into retryable/blocked UI states without changing server messages or semantics.

- [ ] **Slice 4: Build evidence selection.**

  `EvidenceSelectionPanel` consumes the WP7 Knowledge workspace list, allows active or explicit version selection, prevents selecting an unindexed/failed version, and displays source title/type/index status. It must never let the browser manufacture an `EvidenceSet`.

- [ ] **Slice 5: Build grounded writing page/result.**

  Add `/grounded-writing`, instruction/query fields, generation loading/error/blocked/partial states, inline citation rendering, bibliography list, provenance/evidence trace disclosure, copy and markdown export. Generated content is not sent back to Knowledge import in P2.

- [ ] **Slice 6: Add route navigation and continuation.**

  Add a Knowledge-page action to continue with selected sources and a Grounded-result action to copy/export. Do not add Task creation; E6 frozen boundaries explicitly exclude TasksModule integration.

- [ ] **Slice 7: Run E6 and end-to-end boundary regressions.**

  Run all `server/modules/grounded-generation` suites, `test/unit/grounded-generation-boundary.spec.ts`, the new client tests, `npm run type:check`, `npm run build:client`, and AppModule bootstrap.

### Completion conditions

- Workflow B reaches grounded generation only from authenticated, indexed, owner-scoped Knowledge sources.
- The UI distinguishes grounded, partial and blocked results and shows claim/citation/bibliography/provenance data from the accepted E6 response.
- Copy/export works for generated content; generated content is not silently indexed or treated as source evidence.
- No E6 service/controller/retrieval/citation semantic rewrite and no TasksModule integration.

## 11. Recommended implementation order and dependency graph

### Order

1. **Preflight / Plan Review gate** — re-review this corrected draft, record the accepted-baseline evidence and verify that the auth adapter and synchronous indexing boundaries are implemented exactly as frozen; this step does not authorize implementation by itself.
2. **P2-WP1** — capability/readiness truth and server/client gate.
3. **P2-WP2** — session context and protected route/request behavior.
4. **P2-WP3** — workspace document projection, import, picker, Polish/Paper Revision selection.
5. **P2-WP4** — production tool input enforcement and literature replacement.
6. **P2-WP5** — task search/result/action UX for Workflow A.
7. **P2-WP6** — Academic Search and Zotero pages; Zotero attachment import feeds the workspace.
8. **P2-WP7** — explicit Knowledge indexing/status/retry orchestration.
9. **P2-WP8** — Grounded Writing over indexed versions.
10. **P2 acceptance evidence** — two flow smoke tests, full regression, static boundary audit and final review package.

### Dependencies

```text
P2 Plan Review gate
        |
       WP1
      /   \
    WP2   WP3
      \   /  \
       WP4   WP6
         \   /
          WP5
           |
          WP7
           |
          WP8
```

WP2 and WP3 can be parallel only after WP1 contracts are accepted. WP6 may begin after WP2 and its client API wrappers can be developed while WP3 is in review, but Zotero attachment-to-workspace acceptance depends on WP3. WP7 must precede WP8. WP5 does not depend on WP7 and should be completed before adding the synchronous grounded-writing page so task/result UX patterns are established.

### Commit/review checkpoints after authorization

Each checkpoint should be independently reviewable and pass its own targeted tests:

- `feat(p2): freeze product capability policy`
- `feat(p2): integrate auth session boundary`
- `feat(p2): add document workspace projection`
- `feat(p2): enforce real tool input readiness`
- `feat(p2): close task result actions`
- `feat(p2): add academic search and zotero product pages`
- `feat(p2): orchestrate knowledge indexing`
- `feat(p2): add grounded writing surface`

No checkpoint may be merged to `main` before explicit `PHASE_P2_ACCEPTED`.

## 12. WP-level compatibility and regression matrix

| WP | Compatibility risk | Mitigation | Required regression |
|---|---|---|---|
| WP1 | Existing tests/direct API callers expect all legacy `TaskType` values | Keep `TaskType`/legacy configs; use the shared catalog as the only readiness truth and enforce it on every `/api/ai-tools/submit` request, including local and Jest | AI service/module tests, capability boundary, server/client type-check |
| WP2 | Toolkit auth differs across local/platform/standalone; redirect loops | Adapter interface, local-fixed profile bootstrap, 401 state machine, no token fabrication | auth adapter tests, existing standalone guard tests, local middleware tests |
| WP3 | Reconstructing a `DocumentInputRef` from Knowledge artifact metadata may omit fields or leak path | Validate owner/provider/bucket/path/hash through existing `DocumentInputService` semantics; expose only safe projection | C4 document tests, workspace owner/idempotency HTTP tests, client upload tests |
| WP4 | Hidden legacy forms may be reachable by direct route; direct generator unit tests may regress if API access is blocked | Route gate + unconditional server capability gate, keep legacy generator tests direct and isolated, no generator rewrite | policy tests, production negative tests, accepted real-generator tests |
| WP5 | Task JSON resultData is historical and loose; renderer refactor can cause regressions | Add adapter/registry around existing renderers; only migrate accepted result kinds first | task service/controller tests, existing migration client tests, result mapper tests |
| WP6 | Third-party API latency/rate limits and secret exposure | Existing E4/E5 error filters, opaque cursor, client-side safe DTOs and no API-key persistence | E4/E5 full targeted suites, client request contract tests |
| WP7 | Synchronous indexing may exceed request time; accidental E1/E2/E3 semantic change | Explicit synchronous UI copy, bounded document page, thin facade only, frozen-boundary tests | Knowledge/index/retrieval regression, PostgreSQL owner/status integration |
| WP8 | E6 strict request schema and evidence binding reject malformed UI state | Build request from selected workspace IDs, default valid options, preserve blocked/partial responses | all E6 suites, grounded client contract, AppModule bootstrap |

## 13. Test strategy and commands

### 13.1 Unit tests

Unit tests are required before each implementation slice for:

- capability/readiness policy and legacy literature replacement;
- auth state/provider mappings and 401 behavior;
- document projection, ref reconstruction, idempotency and owner isolation;
- task keyword normalization, result envelope mapping, rerun payload sanitization and copy/export helpers;
- Academic Search/Zotero/Grounded client request and response mapping;
- Knowledge indexing orchestration boundary and status mapping.

Tests should use fakes for external services, fixed dates/ids, and zero real DeepSeek/OpenAlex/Zotero calls unless an existing guarded integration suite explicitly requires a configured dependency.

### 13.2 Server integration/HTTP tests

Each new controller needs a Nest HTTP boundary test covering authenticated success, missing auth, malformed input, stable domain error mapping, owner isolation and no secret/raw error leakage. The Knowledge product controller additionally needs a PostgreSQL integration path when `DATABASE_URL` is available; when unavailable, the suite must skip through the same explicit environment guard used by existing PostgreSQL tests.

### 13.3 Client tests

Because the current Jest setup uses Node + ts-jest and has no browser component-test dependency, P2 client tests should initially target pure reducers, API wrappers, mappers and action builders under `test/unit`. React components must keep orchestration in testable functions. Introducing a DOM testing library is optional and requires a separate dependency decision; it is not necessary for the first P2 implementation slices.

### 13.4 Required verification commands at Review Candidate

Run from the authorized P2 branch after all slices:

```text
npm test -- --runInBand
npm run test:integration:postgres
npm run test:app-bootstrap
npm run lint
npm run type:check
npm run build:server
npm run build:client
```

Also run targeted suites for each WP and a local no-external-call MVP smoke harness. The smoke harness must use local-fixed auth, deterministic/fake embedding, fake LLM where appropriate, and real document parser/storage contract fixtures; it must not call DeepSeek, OpenAlex or Zotero credentials.

## 14. P2 overall acceptance evidence

P2 cannot be considered a Review Candidate until all evidence below is attached to the Phase branch/PR for ChatGPT review:

### Workflow A evidence

1. Authenticated local/platform session snapshot is established without `mock_token`.
2. User uploads a non-empty `.pdf` or `.docx` through `/api/document-inputs`.
3. The same artifact is imported into `/api/knowledge/documents` with an idempotency key.
4. Workspace selection returns a validated `DocumentInputRef`.
5. Polish or Paper Revision submits only the ref (no File/name/count substitute).
6. Task reaches the existing accepted execution path and result is shown.
7. Task detail supports loading/error/empty distinctions, copy, client-side export and explicit rerun/continue behavior.
8. Refreshing `/tasks` and searching by title/ID returns the owner-scoped task.

### Workflow B evidence

1. Authenticated user uploads a PDF or imports a supported Zotero PDF attachment.
2. A Knowledge source/document/version is visible with provenance and owner scope.
3. User explicitly starts indexing; response shows real index counters/status.
4. Indexed version is selectable; failed/stale version cannot be used as ready evidence and exposes retry.
5. Grounded Writing sends accepted E6 request with active/explicit version selection.
6. Result shows `grounded`/`partial`/`blocked`, claims, numeric citations, bibliography, evidence trace and provenance.
7. User can copy/export grounded content; generated content is not automatically indexed.

### Cross-cutting evidence

- Anonymous protected requests produce login/401 behavior; cross-user document/task/knowledge reads do not succeed.
- No production-visible path submits legacy fictional literature or metadata-only file input.
- No raw API key, bearer token, stack trace, prompt, response content or upstream secret appears in UI/API error payloads.
- No P2 migration is present unless separately approved; existing migrations remain ordered/idempotent.
- Existing A→E6/P1 targeted and full regressions pass with only already accepted non-blocking warnings.
- `git diff` contains only authorized P2 files plus the existing collaboration documents; no P3/queue/payment/deployment/E7/E8 change is present.

## 15. Explicit out-of-scope boundaries

The following must not enter P2 implementation or its acceptance claim:

- durable queue, Redis/BullMQ, worker fleet, crash replay, task recovery, distributed cancellation or multi-node execution;
- object storage migration, multi-node filesystem redesign, automated retention/cleanup, backup/restore redesign or deployment rehearsal;
- real OIDC/JWKS provider deployment, key rotation rehearsal, production auth operations and tenant provisioning;
- payment provider, webhook, refund, reconciliation, commercial billing or order compliance;
- full rewrite of the 20+ legacy generators into real LLM/search/formatting/plagiarism/data-analysis engines;
- production plagiarism source integration, true document-format export engine, OCR, reranking, external search persistence or generated-content indexing;
- E7/E8 and any new retrieval/citation algorithm, E3 source-resolution/assembly change, E6 evidence-binding/citation semantic change;
- TasksModule integration for Knowledge indexing or Grounded Generation;
- unrelated refactors, dependency upgrades, visual redesigns beyond the frozen product UX needed by the two MVP flows.

## 16. Blocking / Important planning issues

### Blocking before implementation branch

No unresolved implementation-planning Blocking issue is identified after this correction. Implementation remains prohibited until ChatGPT completes the re-review and explicitly changes `IMPLEMENTATION_AUTHORIZED`; that governance gate is a required approval state, not a claim that the draft has an unresolved architecture blocker.

### Important but not implementation-blocking after explicit decision

1. **Known Governance Documentation Drift:** `PROJECT_STATE.md`、`ROADMAP.md` 和 P1 Final Acceptance Report 的部分 closeout 文字落后于 `phase-p1-accepted` annotated tag 指向的 accepted `main`。P2 实施不因该文字漂移停止，也不得擅自改写 P1 历史 acceptance 内容；后续治理可单独修正。
2. The P2 design authority is the ChatGPT P2 Design Review decision plus the Frozen Scope recorded in this plan; no checked-in standalone P2 design spec is required for implementation authorization.
3. The existing P2 audit document is an untracked collaboration artifact from the prior audit round. It must be retained or deliberately included in the later Phase documentation policy; this plan does not edit it.
4. No `package.json` change is planned for WP7. Its PostgreSQL product integration suite has an explicit `npx jest ... --runInBand` acceptance command; existing package scripts and their known Windows portability behavior should be recorded as verification context only.
5. The actual platform auth surface still requires implementation-time package/export verification. If the accepted `@lark-apaas/client-toolkit` cannot provide the needed session behavior, a direct auth SDK dependency is a separate ChatGPT Review decision, not an automatic implementation step.

## 17. Plan handoff state

This document is a draft for ChatGPT Plan Review. It does not create a branch, modify business code, add migrations, authorize implementation, permit a PR, or advance to P3.

Required state after this drafting round:

```text
P2_IMPLEMENTATION_PLAN=DRAFT
P2_PLAN_REVIEW=PENDING_RE_REVIEW
IMPLEMENTATION_AUTHORIZED=NO
P2_IMPLEMENTATION=NOT_STARTED
P2_ACCEPTED=NOT_CLAIMED
P3=NOT_ENTERED
```
