# Phase P4 — Core Academic Writing Workflow Implementation Plan Draft

> **Status:** `DRAFT / CONTROLLER REVIEW REQUIRED / IMPLEMENTATION NOT AUTHORIZED`
>
> **Goal:** 以最小的新领域模型，把“研究想法 → 选题 → Research Plan → 可编辑大纲 → 分章节生成/改写 → 保存与证据追踪”连接成一个真实可用的论文项目工作流。
>
> **Architecture:** 新增 `PaperProject` 一级聚合；项目状态与一次性 AI `Task` 分离；有据写作只编排现有 Knowledge / Retrieval / `EvidenceSet` / Grounded Generation；无资料写作直接走 `LlmService`，并执行独立的 academic-integrity 校验。
>
> **Tech stack:** NestJS 10、Drizzle ORM 0.44/PostgreSQL、Zod 3、React 19、React Router 6、Jest、Playwright。
>
> **Execution gate:** 本文获 Controller 审查并明确给出 `PHASE_P4_IMPLEMENTATION_AUTHORIZED` 前，不得执行本文任何实现工作包。

## Global Constraints

- 本轮仅允许修改本文；`BUSINESS_CODE_CHANGE = NO`，`DATABASE_MIGRATION = NO`，`SCHEMA_CHANGE = NO`。
- P4 实施必须继续使用同一 Knowledge / indexing / retrieval / `EvidenceSet` 体系，不创建第二套文件、chunk、embedding、retrieval 或 citation engine。
- P4 MVP 使用同步 orchestration；不引入 Redis、BullMQ、worker、workflow DSL 或 agent framework。
- `MODEL_ONLY` 是一等路径；用户没有上传文件时仍可走完整的 planning 与 section draft 流程。
- Academic Search metadata/abstract 不等于 evidence；只有进入 Knowledge、完成索引并实际进入 `EvidenceSet` 的内容才可形成 evidence support。
- 任何历史 evidence snapshot 都不得被解释为当前用户编辑文本仍然有效的 evidence binding。
- 本文是设计与实施顺序草案，不授权 PR、merge、tag、生产变更或真实外部 LLM 调用。

---

## 1. Executive Decision

### 1.1 Should `PaperProject` be a new first-class aggregate?

**YES.**

仓库事实支持这一判断：

- `server/database/schema.ts` 的 `tasks` 只保存一次性工具执行、积分成本、输入/输出和状态；`TasksService.createTask()` 会扣积分，`AiToolsService` 再通过进程内 `setTimeout` 完成 one-shot execution。它不具备项目结构、章节身份、当前内容、修订历史或 source selection 语义。
- `knowledgeSourceRecords`、`knowledgeDocuments`、`knowledgeDocumentVersions`、`knowledgeChunks` 和 embedding tables 共同表达用户知识资产及其不可变版本，不表达某篇论文的研究目标、结构和正文。
- `GroundedGenerationResult` 是一次同步生成结果，包含 claim binding、citation、bibliography 和 `evidenceTrace`，但没有跨多章节的项目生命周期。

因此 P4 新增 `PaperProject` 聚合根，并以引用方式关联 Knowledge identifiers；不得把 `Task`、`KnowledgeDocument` 或 `GroundedGenerationResult` 直接冒充论文项目。

### 1.2 Can a zero-upload user complete the P4 MVP workflow?

**YES.** 精确路径如下：

```text
/papers/new
→ POST /api/paper-projects
→ POST /api/paper-projects/:projectId/topics/generate
→ PUT  /api/paper-projects/:projectId/topic-selection
→ POST /api/paper-projects/:projectId/research-plan/generate
→ PUT  /api/paper-projects/:projectId/research-plan
→ POST /api/paper-projects/:projectId/outline/generate
→ PUT  /api/paper-projects/:projectId/outline
→ select a writing-unit / PaperSection
→ POST /api/paper-projects/:projectId/sections/:sectionId/generations
   sourceStrategy = MODEL_ONLY
→ POST /api/paper-projects/:projectId/sections/:sectionId/revisions
   origin = USER_EDIT
```

这条路径不访问 upload、Knowledge、Academic Search 或 retrieval。MODEL_ONLY 结果必须标为“模型草稿”，不得产生 citation、DOI、虚构实验或统计结果。

### 1.3 Core architecture decision

P4 MVP 新建五张表：

1. `paper_projects`
2. `paper_outline_nodes`
3. `paper_sections`
4. `paper_section_revisions`
5. `paper_project_sources`

`ProjectProfile` 与 `ResearchPlan` 使用聚合根内的 schema-versioned JSONB；`GenerationRecord` 合并进 immutable `PaperSectionRevision`。这样既满足项目、树、章节、source binding 与历史追踪，又避免为 DDD 完整性过度拆表。

## 2. Accepted Baseline

### 2.1 GitHub verification

2026-09-19 本轮从真实 `origin` 核验：

```text
repository:        https://github.com/booom12133/academic-writing-platform.git
origin/main:       58a05980c0516792210e9f0bce6f3038da8ee41b
local main:        58a05980c0516792210e9f0bce6f3038da8ee41b
accepted tag:      phase-p3-accepted
annotated object:  2bcb50b40f8e2a8f1f5dc39da7fdcfe5dabcf92f
peeled target:     58a05980c0516792210e9f0bce6f3038da8ee41b
http.version:      HTTP/1.1
P4 branch:         phase/p4-core-writing-workflow
```

结论：P3 已经 CLOSED。`PROJECT_STATE.md`、`ROADMAP.md` 和 `docs/reviews/PHASE_P3_FINAL_ACCEPTANCE_REPORT.md` 仍包含 tag-pending 历史文字；这是用户已明确说明且由远端 tag 事实证实的治理记录滞后。本 Phase 不重新开启 P3，也不修改这些历史文件。

### 2.2 Frozen baseline

P4 将 E1–E6、P1–P3 accepted 行为视为冻结基线，尤其是：

- Knowledge provenance 与 immutable document version lifecycle；
- embedding/index lifecycle；
- E3 retrieval selection、filters、score、`EvidenceSet` assembly；
- E5 OpenAlex discovery contract；
- Academic Search Import 的 metadata-only/full-text 分流；
- E6 structured grounded output、claim binding、numeric-inline citation、bibliography 与 evidence trace semantics；
- production auth/user isolation、rate-limit、deadline 和 sanitized error contracts。

P4 只做 additive integration；若实现阶段发现必须改变上述语义，应停止并重新取得 Controller 授权。

## 3. P4 Capability Inventory

| Capability | Existing implementation | Reuse directly | Extend | New | Frozen boundary |
|---|---|---:|---:|---:|---|
| Auth / user isolation | `@NeedLogin()` + `req.userContext.userId`；`KnowledgeProductService`、`GroundedGenerationController` | Yes | Owner-scoped Paper repository/API | Paper ownership FKs | 不改变 P1 auth 语义 |
| LLM service | `server/modules/ai-tools/llm/LlmService` → `TEXT_GENERATION_PROVIDER` | Yes | 新 structured generators 调用 | Research Plan、Outline、MODEL_ONLY draft generators | 不改变 provider abstraction / DeepSeek semantics |
| Topic generation | `TopicGenerationGenerator`，真实 LLM、Zod、一次 retry、provider/model metadata | Yes | 从 `AiToolsModule` additive export；Paper planning adapter | 项目内选择/保存 | 不经 legacy outline；不改既有 `/api/ai-tools/submit` |
| Research Plan | 无 | No | No | Structured contract、generator、edit API | 不硬编码经济学实证模板 |
| Outline | `outline.generator.ts` 是固定模板；capability catalog 标记 `preview/legacy` | No | 保留 legacy 工具 | 正式 hierarchical Paper Outline path | 不把 legacy preview 宣称为 P4 production |
| Tasks | `tasks` table、`TasksService`、`AiToolsService`；one-shot、积分、状态 | Limited | 可选 observability/billing 以后另议 | No canonical project state | P4 MVP 不依赖 `setTimeout` task runner，不引入 queue |
| Document input | `DocumentInputService`、`DocumentUploadFlow` | Yes | Paper Workspace 中复用入口 | No | 不复制存储对象 |
| Knowledge source/document/version | `knowledgeSourceRecords`、`knowledgeDocuments`、`knowledgeDocumentVersions`；`KnowledgeService` | Yes | Project source binding 引用 existing IDs | `paper_project_sources` | 不复制全文或 provenance records |
| Indexing | `KnowledgeIndexingService`、`KnowledgeProductIndexingService`、现有 index APIs | Yes | Workspace 内编排/状态展示 | No second index | 不改变 embedding/index lifecycle |
| Retrieval | `KnowledgeEvidenceService.retrieve()`、explicit version selection、filters | Yes | P4 adapter 提供 project-selected versions | Strategy router | 不改 E3 scoring/filter semantics |
| `EvidenceSet` | `evidence-assembly.ts`；chunk/provenance/citation locator/source identity | Yes | 只消费结果 | Support classification | 不以 metadata 构造 EvidenceSet |
| Academic Search | `POST /api/academic-search/search`、OpenAlex provider | Yes | Paper Workspace 嵌入/跳转 | No | `AcademicDiscoverySet != EvidenceSet` |
| Academic Search Import | `POST /api/academic-search/import`；full-text 或 metadata-only | Yes | 导入后绑定项目 source | Readiness UI | metadata-only 不得标 grounded |
| Zotero positioning | Zotero PDF attachment 最终进入 Knowledge；P3 定位为 Optional Advanced Integration | Indirect | Paper 可选择其 Knowledge document | No direct P4 Zotero flow | 不做 reference-manager replacement/OAuth |
| Grounded Generation | `GroundedGenerationService` 已由 module 导出；claim/citation/bibliography/trace | Yes | P4 orchestrator + revision snapshot | Support-mode classifier | 不重写 E6 prompt/binding/citation semantics |
| Citation | `CitationSemanticsService`、`CitationRenderer`、`BibliographyBuilder` | Yes | snapshot 到 section revision | UI projection | 仅实际 EvidenceSet 可支持 citation badge |
| Evidence trace | `GroundedGenerationResult.evidenceTrace` | Yes | immutable revision snapshot | Paper evidence view API | 不复制 Knowledge chunks/embeddings |
| Frontend pages | `/knowledge`、`/academic-search`、`/grounded-writing` | Yes | 与项目 source panel 互链 | `/papers*` Paper Workspace | 旧页面保留为独立能力 |
| Persistence | Drizzle schema + migrations 0001–0004 + local pg-mem schema | Yes | migration 0005、local schema | P4 tables/repository | 不改 accepted migrations |
| Revisions | Knowledge document versions；无 Paper section revision | Pattern only | No | immutable `paper_section_revisions` | 不借用 Knowledge version 表保存正文 |

## 4. Reuse vs New vs Frozen

### 4.1 Direct reuse

- `LlmService.generate()`：Topic、Research Plan、Outline、MODEL_ONLY draft。
- `TopicGenerationGenerator.generate()`：保持既有 prompt、Zod validation、single retry 和 metadata；仅新增 module export 与项目 adapter。
- `KnowledgeProductService` 与现有 `/api/knowledge/*`：列出、导入、建立索引、刷新和 retry。
- `AcademicSearchService` 与 `AcademicSearchImportService`：搜索、选择、导入；P4 不复制 OpenAlex client 或 PDF fetch 安全逻辑。
- `KnowledgeEvidenceService.retrieve()` / `GroundedGenerationService.generate()`：USER_KNOWLEDGE、WEB_RETRIEVED、MIXED 的唯一 grounded path。
- `GroundedGenerationResult`：作为新 revision evidence/provenance snapshot 的输入。

### 4.2 Additive extensions

- `AiToolsModule` additive export `TopicGenerationGenerator`；不改变既有 task submission。
- 新 `PaperProjectModule` imports `AiToolsModule`、`KnowledgeModule`、`KnowledgeProductModule`、`GroundedGenerationModule`。
- 新 P4 shared contract；现有 academic-search、knowledge、grounded-generation contracts 保持兼容。
- Paper Workspace 调用现有 search/import/index API，再用新 project-source API 绑定已有 IDs。

### 4.3 New code

- Paper domain types、repository、service、controllers、DTO validation、module。
- Research Plan generator、production Outline generator、MODEL_ONLY section generator、academic-integrity validator。
- Source strategy router、support classifier、section revision orchestration。
- P4 migration/local schema、Paper frontend pages/components/API/state helpers、P4 tests。

### 4.4 Tasks decision

可复用的是 user-owned execution/audit 的概念与现有计费基础，不可复用的是 canonical state。

```text
Reusable later: task/status UX, points transaction pattern, operational audit.
Must not become Paper state: inputData, resultData, task status, process-local timer.
```

P4 MVP 的项目保存、章节保存和修订历史完全独立于 `tasks`。本需求未定义 P4 价格，因此不通过 `TasksService.createTask()` 隐式扣分；如 Controller 要求计费，应另行明确价格与原子性，并把 task ID 作为 generation metadata 的可选关联，而不是项目状态来源。

## 5. P4 MVP User Workflow

### 5.1 Primary flow

```text
Create Paper Project
→ enter idea / requirements
→ generate or directly enter topic
→ select title
→ generate/edit Research Plan
→ generate/edit/reorder Outline
→ select writing unit
→ choose SourceStrategy
→ validate source readiness when needed
→ generate SectionRevision
→ inspect support badge + citations/trace
→ edit locally
→ explicit Save creates USER_EDIT revision
→ rewrite creates a new AI revision
```

### 5.2 Strategy-specific entry

- `MODEL_ONLY`: no source precondition.
- `USER_KNOWLEDGE`: select existing indexed Knowledge document versions.
- `WEB_RETRIEVED`: search → select → import → bind → index when full text is available.
- `MIXED`: select at least one user source and at least one web-imported source; both still resolve to existing Knowledge version IDs.

### 5.3 Save semantics

The editor owns an unsaved local buffer. Only explicit **Save** creates a revision. Keystrokes do not generate server revisions. Navigation with dirty content must warn. A content hash equal to the current revision is a no-op and does not create history noise.

## 6. Domain Model

### 6.1 Aggregate root and ownership

`PaperProject` is the aggregate root. Every P4 row contains `userId`; child FKs include project/owner identity so cross-user IDs cannot be attached even if a UUID is guessed.

```text
PaperProject
├── ProjectProfile (JSONB value object)
├── ResearchPlan (JSONB value object)
├── OutlineNode[] (relational hierarchy)
├── PaperSection[] (stable writing-unit identity)
│   └── SectionRevision[] (immutable history; latest numbered revision is current)
└── ProjectSource[] (references to existing Knowledge identities)
```

### 6.2 `ProjectProfile`

Schema version 1 fields:

```ts
interface ProjectProfileV1 {
  schemaVersion: 1;
  researchIdea: string;
  discipline?: string;
  educationLevel?: string;
  paperType:
    | 'empirical-quantitative'
    | 'empirical-qualitative'
    | 'mixed-methods'
    | 'computer-science-engineering'
    | 'literature-review'
    | 'conceptual-theoretical'
    | 'other';
  language: 'zh-CN' | 'en';
  targetWords?: number;
  requirements?: string;
}
```

`selectedTitle` 是 root 的独立列，便于列表与排序；profile 不重复保存 title。

### 6.3 `ResearchPlan`

```ts
interface ResearchPlanV1 {
  schemaVersion: 1;
  researchProblem: string;
  researchQuestions: string[];
  hypotheses?: Array<{ id: string; statement: string; rationale?: string }>;
  propositions?: Array<{ id: string; statement: string; rationale?: string }>;
  researchObjectives: string[];
  methodology: {
    approach: string;
    design?: string;
    methods: string[];
    dataOrMaterials?: string[];
    samplingOrSelection?: string;
    analysisPlan?: string[];
    validationPlan?: string[];
  };
  dataMaterialRequirements: string[];
  expectedContributions: string[];
  limitationsAssumptions: string[];
  keywords: string[];
}
```

Rules:

- `hypotheses` 与 `propositions` 都是可选的；review、qualitative、engineering 和 theoretical 项目不强迫填写。
- generator 根据 `paperType` 选择适当结构，但输出始终通过同一 contract。
- Research Plan 是计划，不得把 expected results 写成已证实结果。

### 6.4 `OutlineNode`

```ts
interface OutlineNode {
  id: string;                 // server UUID, stable
  parentId?: string;
  nodeType: 'container' | 'writing-unit';
  title: string;
  position: number;           // unique among active siblings
  targetWords?: number;
  generationNotes?: string;
  status: 'active' | 'archived';
}
```

- `writing-unit` 必须是 leaf，并一对一映射 `PaperSection`。
- `container` 只组织层级，不直接保存正文。
- `OutlineNode != SectionRevision`；调整标题、顺序或父节点不修改历史正文。
- 从 outline 提交中移除已有 writing-unit 时，node 被 archived，对应 section 标为 `orphaned`，历史仍可读。
- 用户可显式 remap orphaned section 到一个尚无 section 的 active writing-unit；section ID 与 revisions 不变。

### 6.5 `PaperSection` and `SectionRevision`

`PaperSection` 是稳定身份与 outline binding。`SectionRevision` 是不可变内容版本：

```ts
type RevisionOrigin = 'AI_GENERATION' | 'AI_REWRITE' | 'USER_EDIT';
type SourceStrategy = 'MODEL_ONLY' | 'WEB_RETRIEVED' | 'USER_KNOWLEDGE' | 'MIXED';
type ActualSupportMode = 'AI_DRAFT' | 'WEB_EVIDENCE' | 'USER_EVIDENCE' | 'MIXED_EVIDENCE';
type SupportState = 'NOT_CLAIMED' | 'VALID' | 'STALE_AFTER_EDIT';
```

每次 generation、rewrite 或 explicit user save 创建新 revision。`paper_sections.current_revision_number` 在同一事务内递增；该编号对应的 immutable row 是 canonical current content。并发写入使用 `expectedCurrentRevisionNumber`，冲突返回 HTTP 409。

### 6.6 Lifecycle and deletion

- Project: `active → archived`；MVP `DELETE` 是 archive，不物理级联删除。
- Outline node: `active → archived`；保留 section link 与历史。
- Section: `active | orphaned | archived`；正文历史不可由 outline edit 隐式删除。
- Revision: immutable；回滚通过复制旧内容形成新 revision，不移动历史指针。
- Project source: 可解除当前选择；已有 revision snapshot 不删除。
- Knowledge source/document/version: P4 从不 cascade delete、tombstone 或复制它们。

### 6.7 Optimistic concurrency

MVP 需要轻量 optimistic concurrency，但不需要协同编辑：

- `paper_projects.lock_version` 保护 profile、title、Research Plan、outline bulk update 和 source selection。
- `paper_sections.current_revision_number` 保护 section save/generate/rewrite。
- API request 携带 expected version；冲突返回最新 resource summary，让用户 reload/compare。

## 7. Source Strategy & Support Provenance Model

### 7.1 Three separate concepts

1. **Requested strategy**：用户本次要求系统如何写。
2. **Evidence availability**：被选择来源当前是否具备可检索全文。
3. **Actual support**：这次 revision 实际使用了哪些 evidence。

```ts
type EvidenceAvailability =
  | 'NOT_REQUIRED'
  | 'READY'
  | 'PARTIALLY_READY'
  | 'METADATA_ONLY'
  | 'NOT_INDEXED'
  | 'INDEXING'
  | 'INDEX_FAILED'
  | 'NO_EVIDENCE';
```

### 7.2 Classification rules

| Requested strategy | Actual EvidenceSet outcome | Revision result | Badge |
|---|---|---|---|
| `MODEL_ONLY` | Not queried | `AI_DRAFT / NOT_CLAIMED` | 模型草稿 |
| `USER_KNOWLEDGE` | valid items only from user-selected versions | `USER_EVIDENCE / VALID` | 来自用户资料 |
| `WEB_RETRIEVED` | valid items only from web-imported indexed versions | `WEB_EVIDENCE / VALID` | 有真实文献证据 |
| `MIXED` | cited items include both origins | `MIXED_EVIDENCE / VALID` | 混合证据 |
| `MIXED` | actual cited items only from user sources | `USER_EVIDENCE / VALID` + warning | 来自用户资料（Web 未采用） |
| `MIXED` | actual cited items only from web sources | `WEB_EVIDENCE / VALID` + warning | 文献证据（用户资料未采用） |
| any evidence strategy | metadata-only / not indexed / empty EvidenceSet | no revision; structured degraded response | 不可声称 grounded |

`requested WEB_RETRIEVED + only metadata found != WEB_EVIDENCE`。默认 fail-closed：不静默降级成模型草稿。UI 可提供“明确改用 MODEL_ONLY”操作；新的 request 必须真的携带 `MODEL_ONLY`。

### 7.3 Origin classification

`paper_project_sources.origin_class` 由服务端根据 existing source/document provenance 得出：

- `WEB_IMPORTED`: `SourceRecord.externalProvenance` 包含 `connectorKind='academic-discovery'` / provider `openalex`，且绑定 full-text Knowledge version。
- `USER_KNOWLEDGE`: 用户上传或其他非 web discovery 的 Knowledge document version。
- metadata-only web record 可绑定以显示 discovery 状态，但没有 `documentVersionId`，不可进入 retrieval selection。
- Zotero attachment 仍作为 Knowledge document；MVP 将其归入 user-selected knowledge，除非后续明确增加独立 UI taxonomy。

Actual support classifier 只统计 `GroundedGenerationResult.evidenceTrace` 中真正被 citation semantics 采用的 `documentVersionId`，再与 project source bindings 对照；不能仅按“用户选过什么”判 badge。

### 7.4 User edit policy

若用户编辑一个 `VALID` grounded revision：

- 新 `USER_EDIT` revision 保存当前文本；
- 保留 base revision 的 citation/evidence snapshot 供历史查看；
- `supportState = STALE_AFTER_EDIT`；
- UI 显示“已手动编辑，原证据绑定需重新验证”，不得显示当前文本为 grounded；
- 下一次 evidence-backed rewrite 必须重新 retrieval、binding、citation，并生成新的 `VALID` snapshot。

## 8. Database Design

实现阶段使用 Drizzle/PostgreSQL 风格：UUID、owner composite unique/FK、`timestamptz(3)`、明确 indexes/checks；新增 `drizzle/migrations/0005_p4_paper_projects.sql`，不修改 0001–0004。

### 8.1 `paper_projects`

| Item | Design |
|---|---|
| Purpose | Aggregate root；current planning state |
| PK | `id uuid default gen_random_uuid()` |
| Ownership | `user_id varchar(64) not null`; unique `(id,user_id)` |
| Important columns | `selected_title varchar(500)`、`profile jsonb not null`、`research_plan jsonb`、`default_source_strategy varchar(32)`、`status varchar(20)`、`lock_version integer default 0`、timestamps |
| Constraints | enum-like checks；`lock_version >= 0` |
| Indexes | `(user_id,status,updated_at desc)` |
| Mutability | mutable root value objects；version increment per update |
| Delete | archive only |

### 8.2 `paper_outline_nodes`

| Item | Design |
|---|---|
| Purpose | Stable editable hierarchy |
| PK | `id uuid` |
| Relation | composite FK `(project_id,user_id)` → projects；self parent must share project/owner |
| Important columns | `parent_id`、`node_type`、`title`、`position`、`target_words`、`generation_notes`、`status`、timestamps |
| Constraints | active sibling position unique via `(project_id,parent_id,position)` strategy; positive target words; writing-unit leaf validated in service |
| Indexes | `(user_id,project_id,status,parent_id,position)` |
| Mutability | title/order/notes/status mutable; ID stable |
| Revision behavior | tree changes do not update section revisions |

Add unique `(id,project_id,user_id)` to support the owner/project-scoped self FK. PostgreSQL null semantics make root sibling uniqueness require either a normalized `parent_key` or two partial unique indexes (`parent_id IS NULL` and `parent_id IS NOT NULL`). Prefer partial indexes in migration.

### 8.3 `paper_sections`

| Item | Design |
|---|---|
| Purpose | Stable writing-unit identity and current revision sequence |
| PK | `id uuid` |
| Relation | composite FK to project; `outline_node_id` references same project/owner |
| Important columns | `outline_node_id`、`status`、`current_revision_number integer default 0`、timestamps |
| Constraints | one section per `(project_id,outline_node_id)` while bound; non-negative revision number |
| Indexes | `(user_id,project_id,status)` |
| Mutability | binding/status/current sequence only |
| Revision behavior | increment under row lock; content never stored here |

Add unique `(id,user_id)` for the owner-scoped revision FK. The service must verify that `outline_node_id` is an active writing-unit in the same project before binding or remapping.

### 8.4 `paper_section_revisions`

| Item | Design |
|---|---|
| Purpose | Immutable content + authoring/provenance snapshot |
| PK | `id uuid` |
| Relation | composite FK `(section_id,user_id)` → section; `base_revision_id` optional self reference |
| Important columns | `revision_number`、`content text`、`content_hash`、`origin`、`source_strategy`、`actual_support_mode`、`support_state`、`citations jsonb`、`bibliography jsonb`、`evidence_trace jsonb`、`generation_metadata jsonb`、`warnings jsonb`、`rewrite_instruction text`、`created_at` |
| Constraints | unique `(section_id,user_id,revision_number)`；non-empty content；valid enum-like checks |
| Indexes | `(user_id,section_id,revision_number desc)` |
| Mutability | immutable |
| Revision behavior | latest number named by section is canonical; revert creates a new revision |

Add unique `(id,section_id,user_id)` so `base_revision_id` can be constrained to the same section/owner. `generation_metadata` 保存 provider/model/usage、retrieval selectedVersionIds/profile、request context fingerprint 和 generation operation，不保存 prompt 中的 secrets。`evidence_trace` 保存 E6 result snapshot；它引用 chunk/document/version IDs 与 locators，但不复制 chunk text、embedding 或整份 Knowledge document。

### 8.5 `paper_project_sources`

| Item | Design |
|---|---|
| Purpose | Current project source selection, including metadata-only degraded records |
| PK | `id uuid` |
| Relation | composite owner FK to project；nullable owner-scoped FKs to `knowledge_source_records`、`knowledge_documents`、`knowledge_document_versions` |
| Important columns | `origin_class`、`source_record_id`、`document_id`、`document_version_id`、`selection_status`、timestamps |
| Constraints | at least one referenced identity；version requires document；unique project/source and project/version partial indexes |
| Indexes | `(user_id,project_id,selection_status)`、referenced IDs |
| Mutability | selection/status mutable; readiness computed from live Knowledge state |
| Delete | unbind current selection only; revision snapshots survive |

### 8.6 JSONB vs relational decision

- JSONB: `ProjectProfile`、`ResearchPlan` 是小型、schema-versioned、原子编辑的 value objects；revision citation/evidence/generation data 是 immutable snapshot。
- Relational: outline hierarchy、section identity、revision ordering、owner boundaries 和 source bindings 需要 FK、unique、index 与独立生命周期。
- Not copied: Knowledge text/chunks/embeddings/source metadata canonical record。

## 9. API Design

所有 endpoint 必须 `@NeedLogin()`，从 `req.userContext.userId` 取 owner；客户端提供的 `userId` 一律拒绝或忽略。DTO 使用 strict Zod validation，未知字段拒绝。

### 9.1 Projects and planning

| Method | Path | Purpose | Important request | Important response |
|---|---|---|---|---|
| `POST` | `/api/paper-projects` | create project | `profile`, optional `selectedTitle` | project summary + `lockVersion` |
| `GET` | `/api/paper-projects` | list owned active/archived projects | `status`, cursor/page | summaries |
| `GET` | `/api/paper-projects/:projectId` | workspace bootstrap | — | project, plan, outline summary, sections, sources |
| `PATCH` | `/api/paper-projects/:projectId` | update profile/title/default strategy | `expectedLockVersion`, patch | updated root |
| `DELETE` | `/api/paper-projects/:projectId` | archive | `expectedLockVersion` | archived summary |
| `POST` | `/api/paper-projects/:projectId/topics/generate` | reuse topic generator | profile-derived fields, optional count | candidates + provider/model metadata; no automatic selection |
| `PUT` | `/api/paper-projects/:projectId/topic-selection` | select/manual title | `expectedLockVersion`, `title`, optional candidate fingerprint | updated title/version |
| `GET` | `/api/paper-projects/:projectId/research-plan` | read plan | — | structured plan + version |
| `POST` | `/api/paper-projects/:projectId/research-plan/generate` | generate draft plan | `expectedLockVersion`, optional instructions | validated plan + generation metadata, not saved until PUT unless `save=true` is explicitly designed; recommended response-only |
| `PUT` | `/api/paper-projects/:projectId/research-plan` | save/edit plan | `expectedLockVersion`, full `ResearchPlanV1` | saved plan + version |

Generation endpoint returns a proposal; explicit `PUT` makes it canonical. This avoids accidental overwrite when the user wants to inspect/regenerate.

### 9.2 Outline

| Method | Path | Purpose | Important request | Important response |
|---|---|---|---|---|
| `GET` | `/api/paper-projects/:projectId/outline` | read active + relevant archived nodes | — | tree + section mapping + project version |
| `POST` | `/api/paper-projects/:projectId/outline/generate` | production LLM outline proposal | `expectedLockVersion`, optional requirements | validated proposal with temporary client keys |
| `PUT` | `/api/paper-projects/:projectId/outline` | atomic edit/reorder | `expectedLockVersion`, flattened nodes with stable IDs/new client keys | persisted tree, orphan/remap diagnostics, new version |
| `POST` | `/api/paper-projects/:projectId/sections/:sectionId/remap` | explicit orphan remap | `expectedLockVersion`, `targetOutlineNodeId` | section mapping |

One bulk resource update is preferred over add/move/delete RPC endpoints. Missing existing nodes are archived, not destroyed.

### 9.3 Sources

| Method | Path | Purpose | Important request | Important response |
|---|---|---|---|---|
| `GET` | `/api/paper-projects/:projectId/sources` | project source state | — | bindings + live availability/index state |
| `PUT` | `/api/paper-projects/:projectId/sources` | replace current selection | `expectedLockVersion`, bindings using accepted IDs | validated bindings + derived origin/availability |

Search/import/index continue to use existing `/api/academic-search/*` and `/api/knowledge/*`. P4 does not add proxy RPCs for them.

### 9.4 Sections and revisions

| Method | Path | Purpose | Important request | Important response |
|---|---|---|---|---|
| `GET` | `/api/paper-projects/:projectId/sections/:sectionId` | read editor context/current revision | — | section, outline context, current revision summary, support state |
| `GET` | `/api/paper-projects/:projectId/sections/:sectionId/revisions` | revision history | cursor/page | summaries; large trace omitted |
| `GET` | `/api/paper-projects/:projectId/sections/:sectionId/revisions/:revisionId` | full revision | — | content + provenance snapshot |
| `POST` | `/api/paper-projects/:projectId/sections/:sectionId/revisions` | explicit user save | `expectedCurrentRevisionNumber`, `baseRevisionId`, `content` | new `USER_EDIT` revision |
| `POST` | `/api/paper-projects/:projectId/sections/:sectionId/generations` | initial AI generate or rewrite | `operation: GENERATE|REWRITE`, `sourceStrategy`, expected/current base, instructions, targetWords | new revision or structured degraded result |
| `GET` | `/api/paper-projects/:projectId/sections/:sectionId/revisions/:revisionId/evidence` | evidence/citation view | — | citations, bibliography, trace, support state, warnings |

`GENERATE` 可基于空 section；`REWRITE` 必须指定 `baseRevisionId`。二者共用一个 generation resource，避免 endpoint explosion。

### 9.5 Error/degraded contract

建议新增稳定 error codes：

```text
PAPER_PROJECT_NOT_FOUND
PAPER_PROJECT_VERSION_CONFLICT
PAPER_PROJECT_INVALID_REQUEST
PAPER_OUTLINE_INVALID_TREE
PAPER_SECTION_REVISION_CONFLICT
PAPER_SOURCE_OWNERSHIP_MISMATCH
PAPER_SOURCE_METADATA_ONLY
PAPER_SOURCE_NOT_INDEXED
PAPER_SOURCE_INDEXING
PAPER_SOURCE_INDEX_FAILED
PAPER_EVIDENCE_INSUFFICIENT
PAPER_GENERATION_INVALID_RESPONSE
PAPER_INTEGRITY_VALIDATION_FAILED
PAPER_GENERATION_PROVIDER_UNAVAILABLE
PAPER_GENERATION_TIMEOUT
```

Degraded response includes `evidenceAvailability`, affected source IDs, safe user action and `revisionCreated: false`。

## 10. LLM Orchestration

### 10.1 Common context builder

New `PaperWritingContextBuilder` constructs a bounded context from:

- Project Profile and selected title;
- Research Plan summary;
- complete outline titles/IDs, but not all section bodies;
- selected node path, generation notes and target words;
- current section/base revision for rewrite;
- at most configurable neighboring section excerpts when continuity is requested;
- user instruction;
- evidence only through the existing grounded-generation path.

Context budgeting order:

1. mandatory selected section + user instruction;
2. project/research-plan compact summary;
3. outline path and sibling titles;
4. base revision for rewrite;
5. bounded neighboring excerpts;
6. optional context dropped with a warning before mandatory context is truncated.

Do not send the entire paper by default. Record a context fingerprint and included section IDs in generation metadata.

### 10.2 `MODEL_ONLY`

```text
Paper context
→ PaperSectionModelGenerator (LlmService, JSON mode)
→ strict structured-output parse + one corrective retry
→ AcademicIntegrityValidator
→ AI_GENERATION / AI_REWRITE revision
→ ActualSupportMode=AI_DRAFT, SupportState=NOT_CLAIMED
```

Prompt and validator rules:

- no bibliography/citation/DOI fields in output;
- no invented sample, measurement, coefficient, p-value, confidence interval or experimental finding stated as fact;
- unknown empirical/results content must use explicit placeholders such as `【待实证结果补充】`;
- prospective relations are labelled hypothesis/expectation, not findings;
- output schema includes `integrityWarnings[]`; server rejects prohibited citation/result patterns instead of silently saving them.

### 10.3 `USER_KNOWLEDGE`

```text
project sources classified USER_KNOWLEDGE
→ require bound indexed documentVersionIds
→ GroundedGenerationService.generate(
     retrieval.selection = explicit versions,
     grounding.onUnbound = block)
→ existing E6 claim/citation/trace semantics
→ classify actual evidence origins
→ immutable revision snapshot
```

No P4 code may construct evidence items from UI text or metadata.

### 10.4 `WEB_RETRIEVED`

```text
research context
→ existing Academic Search
→ explicit user selection
→ existing Academic Search Import
→ metadata-only OR full-text Knowledge document
→ explicit index / readiness check
→ project source binding
→ explicit-version retrieval
→ existing grounded generation
```

Degraded behavior:

- `metadata-only`: block grounded generation; show “摘要/元数据不是全文证据” and upload/import next action.
- PDF unavailable/invalid/processing failed: retain source record for discovery, `revisionCreated=false`.
- not indexed/indexing: return readiness state; never call grounded generation prematurely.
- index failed/stale: expose retry/re-index action.
- empty/insufficient EvidenceSet: no grounded revision; offer query/source adjustment or explicit MODEL_ONLY switch.

### 10.5 `MIXED`

```text
project-selected user Knowledge versions
+ web-imported indexed Knowledge versions
→ one explicit documentVersionIds selection
→ one KnowledgeEvidenceService / GroundedGeneration path
→ inspect actual cited evidenceTrace origins
→ USER_EVIDENCE | WEB_EVIDENCE | MIXED_EVIDENCE
```

MIXED does not concatenate a separate web prompt or build another vector store. If only one origin appears in actual citations, badge reflects that origin and warning explains the requested mixed strategy was only partially realized.

### 10.6 Research Plan and Outline generators

- Both use `LlmService` JSON mode, strict Zod schemas, one corrective retry, provider/model/usage metadata.
- Research Plan prompt branches by `paperType` and never requires hypotheses for incompatible designs.
- Outline generator consumes profile + Research Plan; server assigns stable UUIDs only when proposal is explicitly saved.
- Legacy `server/modules/ai-tools/generators/outline.generator.ts` remains unchanged and continues to be shown as `preview/legacy` in `product-capability.catalog.ts`.

## 11. Frontend Paper Workspace

### 11.1 Routes

```text
/papers                    project list
/papers/new                project creation + idea/profile
/papers/:projectId         Paper Workspace
```

All routes remain behind `RequireAuth`. Add “论文项目” to `Navbar`; do not remove `/knowledge`、`/academic-search`、`/grounded-writing` because they remain reusable standalone capabilities.

### 11.2 Workspace layout

- **Left (240px):** outline tree, drag/reorder, active/orphan markers, section selection.
- **Center:** selected section context, plain textarea/Markdown editing for MVP, dirty state, Generate/Rewrite/Save, revision history.
- **Right (280px):** source strategy, selected sources/readiness, support badge, citations/evidence trace, generation controls.
- **Project header/settings:** title, profile, Research Plan.

Do not adopt the existing Tiptap stack merely because dependencies exist. MVP uses a controlled textarea/Markdown preview; rich-text semantics and document export remain later work.

### 11.3 State ownership

- Server owns canonical project, tree, source bindings and revisions.
- Route-level loader/hook owns workspace bootstrap and mutation refresh.
- Editor component owns unsaved buffer + dirty flag only.
- Source panel calls existing Academic Search/Knowledge APIs and then persists accepted IDs through project source API.
- Revision selection is view-only until user chooses “restore as new revision.”

### 11.4 Visible states

- Project/outline: loading, empty, invalid tree, 409 conflict, archived/orphaned.
- Source: metadata-only, full text not indexed, indexing, indexed, failed/stale, no evidence.
- Generation: generating, provider unavailable, timeout, blocked binding, invalid model output.
- Support badges:
  - `AI_DRAFT`: 模型草稿
  - `WEB_EVIDENCE + VALID`: 有真实文献证据
  - `USER_EVIDENCE + VALID`: 来自用户资料
  - `MIXED_EVIDENCE + VALID`: 混合证据
  - any `STALE_AFTER_EDIT`: 已编辑，证据需复核

Badge data comes from persisted actual support fields, never inferred from the selected strategy in the browser.

## 12. Academic Integrity Invariants

1. `MODEL_ONLY` cannot emit or persist fake citations, bibliography entries or DOI.
2. `MODEL_ONLY` cannot state fabricated measured/experimental/statistical results as facts.
3. Unknown result content uses a placeholder or prospective language.
4. Academic Search metadata/abstract is discovery material, not grounded evidence.
5. Evidence badge is derived from actual cited `EvidenceSet` trace, not requested strategy or selected cards.
6. A claim cannot be marked supported without a valid E6 binding.
7. Evidence strategies use `grounding.onUnbound='block'` in P4 default orchestration.
8. User-edited grounded text creates `STALE_AFTER_EDIT`; it cannot silently inherit valid support.
9. AI rewrite always re-evaluates provenance/support; it never copies `VALID` from the base revision.
10. Deleted/unbound project sources do not erase immutable historical snapshots.
11. Cross-user project/source/document/version/section IDs fail closed without revealing existence.
12. Metadata-only and index-not-ready paths create no grounded revision.
13. Generation provider/model/usage and warnings are stored as provenance, not presented as evidence.
14. No actual external LLM call occurs in automated tests; fake providers supply deterministic responses.

## 13. Work Packages / Implementation Sequence

Each WP is independently reviewable and follows test-first slices after `PHASE_P4_IMPLEMENTATION_AUTHORIZED`.

### WP1 — Domain, persistence and project CRUD

**Objective:** establish PaperProject ownership, five-table schema, repository and CRUD without any LLM behavior.

**Expected files/modules:**

- Create `shared/paper-project.interface.ts`.
- Create `server/modules/paper-project/domain/*`, `paper-project.repository.ts`, `paper-project.service.ts`, `paper-project.controller.ts`, `paper-project.module.ts`.
- Modify `server/database/schema.ts`, `server/database/local-development.database.ts`, `server/app.module.ts`.
- Create `drizzle/migrations/0005_p4_paper_projects.sql` and P4 repository/HTTP/PostgreSQL tests.

**APIs:** project CRUD/bootstrap only.

**DB changes:** all five tables, constraints, indexes; no accepted migration edits.

**Tests:** contracts/DTOs, owner isolation, archive behavior, optimistic concurrency, migration order/idempotency, real PostgreSQL FK/rollback, local pg-mem startup.

**Acceptance criteria:** user A cannot discover or mutate user B project; create/list/get/patch/archive persist correctly; only new 0005 migration changes schema.

**Frozen boundaries:** Tasks, Knowledge, retrieval, Grounded Generation unchanged.

**Dependencies:** none beyond accepted baseline.

### WP2 — Topic selection and Research Plan

**Objective:** complete idea → topic → structured plan without files.

**Expected files/modules:** additive `TopicGenerationGenerator` export from `AiToolsModule`; new planning DTO/generator/service tests under PaperProject module; shared contract additions.

**APIs:** topic generation, topic selection, Research Plan generate/get/put.

**DB changes:** none beyond WP1 root JSONB/columns.

**Tests:** reuse delegation, JSON schema validation/retry, all six paper types, optional hypothesis/proposition, no fabricated results, provider failure mapping, version conflicts.

**Acceptance criteria:** zero-upload project can persist a selected title and an editable valid ResearchPlanV1.

**Frozen boundaries:** existing topic prompt/output remains compatible; `/api/ai-tools/submit` unchanged.

**Dependencies:** WP1.

### WP3 — Production Paper Outline

**Objective:** generate, validate, save, reorder and edit stable hierarchical outline nodes.

**Expected files/modules:** new `paper-outline.generator.ts`, outline validator/service/repository methods, HTTP DTO, tests.

**APIs:** outline get/generate/put and explicit orphan remap.

**DB changes:** use WP1 outline/section tables.

**Tests:** valid trees, cycles, duplicate IDs/positions, writing-unit leaf rule, target words, stable IDs, reorder, omission→archive/orphan, remap, concurrency.

**Acceptance criteria:** saved writing units have stable PaperSection IDs; outline changes never delete revision data; legacy outline generator remains untouched and preview-only.

**Frozen boundaries:** `outline.generator.ts` and capability catalog semantics unchanged.

**Dependencies:** WP1–WP2.

### WP4 — MODEL_ONLY section writing and revisions

**Objective:** deliver the full zero-file section generate/edit/save/rewrite loop.

**Expected files/modules:** `paper-writing-context.builder.ts`, `paper-section-model.generator.ts`, `academic-integrity.validator.ts`, section/revision service/controller paths, tests.

**APIs:** section read, revisions list/read/create, generations with `MODEL_ONLY`.

**DB changes:** use WP1 revision table.

**Tests:** context budgeting, JSON retry, placeholder behavior, fake citation/DOI/result rejection, explicit-save revision semantics, no-op save, rewrite from base, 409 concurrency, immutable history.

**Acceptance criteria:** E2E A passes without upload; every model-only revision is `AI_DRAFT/NOT_CLAIMED`; no fake evidence fields are persisted.

**Frozen boundaries:** no Tasks/queue; `LlmService` provider semantics unchanged.

**Dependencies:** WP1–WP3.

### WP5 — Project source binding and USER_KNOWLEDGE

**Objective:** bind existing indexed Knowledge versions and persist E6 grounded results as revisions.

**Expected files/modules:** source service/DTOs, readiness resolver, P4 grounded orchestrator/support classifier, PaperProjectModule imports, integration tests.

**APIs:** project sources get/put; section generations with `USER_KNOWLEDGE`; evidence view.

**DB changes:** none beyond WP1 source/revision tables.

**Tests:** owner-scoped binding, index readiness, explicit version routing, GroundedGenerationService delegation, actual evidence classification, citation/trace snapshot, empty evidence fail-closed.

**Acceptance criteria:** E2E B passes; only actual E6 trace yields `USER_EVIDENCE/VALID`.

**Frozen boundaries:** E3/E6 internals unchanged; no duplicate retrieval or citation code.

**Dependencies:** WP1, WP3, WP4.

### WP6 — WEB_RETRIEVED and MIXED

**Objective:** integrate existing discovery/import/index flow into project source selection and route all ready versions through the unified evidence path.

**Expected files/modules:** strategy router/support classifier extensions; Paper source panel integration helpers; focused integration tests. Existing academic-search/import modules should require no semantic change.

**APIs:** existing search/import/index plus project source binding and section generation.

**DB changes:** none.

**Tests:** metadata-only, PDF unavailable/invalid, not indexed/indexing/failed, web-only grounding, mixed actual-origin classification, one-origin-only mixed warning.

**Acceptance criteria:** E2E C and D pass; metadata-only never becomes `WEB_EVIDENCE`; mixed retrieval uses one Knowledge/Evidence pipeline.

**Frozen boundaries:** OpenAlex normalization/fetch security、Knowledge import/index、E3/E6 semantics unchanged.

**Dependencies:** WP5.

### WP7 — Paper Workspace, support UX and rewrite UX

**Objective:** ship the authenticated three-pane product flow and make support truth visible.

**Expected files/modules:**

- Create `client/src/pages/Papers/PapersPage.tsx`, `NewPaperPage.tsx`, `PaperWorkspacePage.tsx`.
- Create focused components under `client/src/components/papers/*` and state helpers under `client/src/lib/paper-*`.
- Create `client/src/api/paper-projects.ts` and export from API index.
- Modify `client/src/app.tsx` and `client/src/components/Navbar.tsx`.

**APIs:** all P4 APIs plus existing academic search/knowledge APIs.

**DB changes:** none.

**Tests:** route/auth, loading/error/degraded states, dirty editor warning, explicit save, revision switching, source readiness, support badge truth table, stale-after-edit, generation/rewrite conflict handling.

**Acceptance criteria:** a user can complete all four strategies from Paper Workspace; badge never mirrors strategy blindly; no complex rich-text editor is introduced.

**Frozen boundaries:** existing standalone pages remain usable; design system values retained.

**Dependencies:** WP1–WP6.

### WP8 — Integration, production-like E2E and acceptance hardening

**Objective:** verify the whole workflow, frozen contracts and production gates.

**Expected files/modules:** P4 API integration tests, PostgreSQL integration tests, Playwright/production-like E2E fixtures, static boundary tests, documentation updates only after review-candidate rules authorize them.

**APIs/DB:** no new behavior; close gaps only.

**Tests:** E2E A–D, auth/isolation, restart persistence, strict DTOs, no external LLM calls, regression/lint/type/build/bootstrap, production schema migration in disposable PostgreSQL.

**Acceptance criteria:** all gates in section 14 pass; frozen paths have no unapproved semantic diff; Controller receives reproducible evidence.

**Frozen boundaries:** no feature expansion during hardening.

**Dependencies:** WP1–WP7.

## 14. Testing / Acceptance Gates

### 14.1 Test layers

| Layer | Required evidence |
|---|---|
| Domain/unit | lifecycle, tree rules, revision/support classification, content hashes |
| DTO/validation | strict unknown-key rejection, limits, enum/version contracts |
| Repository/PostgreSQL | owner FKs, unique/partial indexes, transactions, migration 0005 |
| Service orchestration | source readiness and four-strategy routing |
| Ownership/isolation | every project/source/section/revision route cross-user denial |
| LLM structured output | fake provider, valid parse, one retry, invalid response |
| Anti-fabrication | citation/DOI/statistical result rejection and placeholders |
| Grounded integration | exact E6 delegation, evidence trace snapshot, no semantic rewrite |
| Frontend component/state | dirty state, conflict, degraded state, support badge truth |
| API integration | authenticated resource flow and safe errors |
| Production-like E2E | zero-file/user/web/mixed workflows with persistence |

### 14.2 Required E2E

**E2E A — zero files**

```text
new user → create paper → topic → Research Plan → outline
→ MODEL_ONLY section draft → user save → AI rewrite → history survives reload
```

Assertions: no upload/Knowledge/retrieval call; no citation/DOI; result badge is 模型草稿。

**E2E B — user knowledge**

```text
paper → bind existing indexed Knowledge document version
→ USER_KNOWLEDGE generate → evidence trace → user edit
```

Assertions: initial `USER_EVIDENCE/VALID`; user edit becomes `STALE_AFTER_EDIT`; old snapshot remains viewable。

**E2E C — web discovery**

```text
paper → Academic Search → select/import
→ full-text path: index → grounded section
→ metadata-only path: degraded UI, no grounded revision
```

**E2E D — mixed**

```text
user Knowledge version + web-imported indexed version
→ one explicit retrieval selection → grounded generation
```

Assertions: actual citations from both origins produce `MIXED_EVIDENCE`; one-origin result is labelled as actual origin with warning。

### 14.3 Review Candidate commands

Implementation phase must derive exact targeted paths as files are created, then run at minimum:

```text
npx jest server/modules/paper-project test/unit/*paper* --runInBand
npm run test:integration:postgres
npm test -- --runInBand
npm run lint
npm run type:check
npm run build:server
npm run build:client
npm run test:app-bootstrap
npm run test:e2e -- --runInBand
```

Real external LLM/OpenAlex calls are prohibited in routine automated verification; use fake providers/fixtures. Production-like E2E may use an explicitly controlled fixture service, not live scholarly data.

## 15. Explicit Out-of-Scope

- full-document consistency checker
- automatic journal formatting/submission templates
- DOCX/LaTeX full export pipeline
- collaborative or real-time multi-user editing
- comments/review workflow
- plagiarism integration
- advanced citation styles/reference manager replacement
- automatic experiment execution or fabricated result generation
- auto-ingestion of arbitrary web pages
- Redis, BullMQ, distributed queue/background worker
- complex agent framework/workflow DSL/autonomous researcher
- automatic final submission
- rich-text editor migration
- project sharing/permissions beyond single owner
- pricing/points changes unless separately authorized
- changes to Phase F (`PLANNED / NOT AUTHORIZED`)

## 16. Risks / Open Decisions

| Item | Risk | Recommended P4 decision | Controller gate |
|---|---|---|---|
| P4 pricing | Reusing Tasks would couple canonical state to billing | no P4 point deduction in MVP; authorize pricing separately | confirm |
| Partial grounding | UI could overstate support | P4 always sends `onUnbound=block`; no partial support badge | approve |
| Research/outline proposal autosave | Generated output could overwrite edits | generation returns proposal; explicit PUT saves | approve |
| Metadata-only fallback | silent AI draft may look grounded | fail closed; explicit strategy switch to MODEL_ONLY | approve |
| User edits grounded text | bindings become stale | persist new USER_EDIT revision with `STALE_AFTER_EDIT` | approve |
| Outline removal | content loss | archive node + orphan section; explicit remap | approve |
| Optimistic concurrency | without it multi-tab saves can overwrite | project lock version + section revision number | approve |
| Actual mixed classification | selected sources may not be cited | classify only actual `evidenceTrace` documentVersionIds | approve |
| Long synchronous generation | provider timeouts affect UX | retain bounded synchronous MVP and visible retry; no queue | accept for MVP |
| Evidence snapshot size | large JSONB growth | store cited trace only, no chunk text/embeddings; paginate history | approve |

No open item above requires speculative infrastructure. The recommended defaults form a coherent implementable MVP; Controller may approve them together or request a design delta before authorization.

## 17. Expected File Touch Map

Expected implementation scope after authorization; exact new spec/test filenames may be refined without changing boundaries.

```text
Create
  shared/paper-project.interface.ts
  server/modules/paper-project/**
  client/src/api/paper-projects.ts
  client/src/pages/Papers/**
  client/src/components/papers/**
  client/src/lib/paper-*.ts
  drizzle/migrations/0005_p4_paper_projects.sql
  test/unit/paper-*.spec.ts
  test/e2e/p4-paper-workflow.spec.ts

Modify (additive)
  server/database/schema.ts
  server/database/local-development.database.ts
  server/app.module.ts
  server/modules/ai-tools/ai-tools.module.ts        # export TopicGenerationGenerator only
  client/src/api/index.ts
  client/src/app.tsx
  client/src/components/Navbar.tsx
  test/unit/postgres-schema.integration.spec.ts
  package test configuration/scripts only if an exact P4 test entry is required

Reuse without semantic change
  server/modules/knowledge/**
  server/modules/knowledge-product/**
  server/modules/academic-search/**
  server/modules/academic-search-import/**
  server/modules/grounded-generation/**
  server/modules/ai-tools/llm/**
  server/modules/ai-tools/generators/topic-generation.generator.ts
  shared/knowledge-product.interface.ts
  shared/academic-search.interface.ts
  client/src/pages/Knowledge/**
  client/src/pages/AcademicSearch/**
  client/src/pages/GroundedWriting/**

Must remain unchanged unless Controller approves a reviewed delta
  server/modules/ai-tools/generators/outline.generator.ts
  server/modules/tasks/**
  accepted migrations 0001-0004
  accepted/frozen reports
  PROJECT_STATE.md / ROADMAP.md during this design-only turn
  production configuration/deployment files
```

If implementation discovers a need to modify a “reuse without semantic change” module, the change must be limited to export/wiring or an adapter seam, tested as backward-compatible, and called out explicitly in review.

## 18. Recommendation for `IMPLEMENTATION_AUTHORIZED` Gate

**Recommendation:** approve this plan for implementation only after Controller confirms the decision matrix in section 16, especially:

```text
PaperProject first-class aggregate: YES
five-table minimal model: YES
Tasks as canonical state: NO
P4 implicit point billing: NO
MODEL_ONLY zero-upload workflow: REQUIRED
evidence strategies fail closed when no usable EvidenceSet: YES
user edits mark prior support stale: YES
synchronous orchestration: YES
Redis/BullMQ/Phase F: NOT AUTHORIZED
```

The authorization should be explicit:

```text
PHASE_P4_IMPLEMENTATION_AUTHORIZED
approved plan path: docs/plans/PHASE_P4_IMPLEMENTATION_PLAN_DRAFT.md
approved plan commit: the exact reviewed commit SHA recorded by the Controller
```

Until that gate is granted:

```text
BUSINESS_CODE_CHANGE = NO
DATABASE_MIGRATION = NO
SCHEMA_CHANGE = NO
FRONTEND_IMPLEMENTATION = NO
BACKEND_IMPLEMENTATION = NO
IMPLEMENTATION_AUTHORIZED = NO
PR = NO
MERGE = NO
TAG = NO
```
