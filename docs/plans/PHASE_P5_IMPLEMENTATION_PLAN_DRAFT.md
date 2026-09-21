# Phase P5 — Whole-paper Manuscript Assembly & Export Implementation Plan Draft

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** `REVISED DRAFT / CONTROLLER RE-REVIEW REQUIRED / IMPLEMENTATION NOT AUTHORIZED`
>
> **Goal:** 将 P4 的项目、活动大纲、稳定章节与当前不可变修订确定性装配为整篇论文，生成可追踪的摘要/关键词，统一真实引用与参考文献，并导出可继续编辑的 DOCX。
>
> **Architecture:** `PaperSectionRevision` 继续是正文唯一 canonical truth；`ManuscriptProjectionV1` 在读取时由活动大纲和精确 current revision 指针确定性派生。P5 只持久化 derived section role 与不可变 export artifact manifest，不保存第二份整篇正文。
>
> **Tech stack:** NestJS 10、Drizzle ORM 0.44/PostgreSQL、Zod 3、React 19、React Router 6、Jest、Node.js 22、`docx@9.7.1`；DOCX test inspection 使用 direct devDependency `jszip@3.10.1`。
>
> **Spec:** Controller 提供的 “Phase P5 — Whole-paper Manuscript Assembly & Export” Architecture Proposal；本文件第 1–16 节将其映射到 GitHub baseline `c13013d79e09f130693e94e71fd69f58c623787a` 的真实代码。
>
> **Execution gate:** Controller 审查本文并明确给出 `PHASE_P5_IMPLEMENTATION_AUTHORIZED` 前，不得执行任何工作包，不得创建 implementation branch、migration、依赖变更、API、前端、PR、merge、tag 或部署。

## Global Constraints

- 本轮唯一允许写入的文件是 `docs/plans/PHASE_P5_IMPLEMENTATION_PLAN_DRAFT.md`；`BUSINESS_CODE_CHANGE = NO`、`MIGRATION_CREATED = NO`、`DEPENDENCY_CHANGED = NO`。
- GitHub Source of Truth baseline 是 `origin/main@c13013d79e09f130693e94e71fd69f58c623787a`；远端 annotated tag `phase-p4-accepted^{}` 指向同一 commit，因此 `PHASE_P4_ACCEPTED_CLOSED` 已成立。
- P4 的 `PaperProject`、Outline、`PaperSection`、immutable `PaperSectionRevision`、Knowledge、Retrieval、`EvidenceSet`、Grounded Generation、citation、bibliography 与 provenance 语义全部复用；不得建立第二套对应系统。
- Whole Manuscript 是 runtime derived projection，不得新增 `manuscripts.full_content`、正文镜像表或可变整篇正文。
- `MODEL_ONLY` 必须支持 zero-upload `Idea → Paper → DOCX`；不得伪造 citation、DOI、实验结果、统计数字或 bibliography。
- Grounded 路径继续 fail closed；metadata-only source 不得成为 evidence，`STALE_AFTER_EDIT` 不得伪装为当前有效支持。
- P5 MVP 同步执行；不得引入 Redis、BullMQ、Queue、worker 或 Phase F。
- DOCX 是唯一 acceptance-blocking production export；PDF 与 LaTeX 只保留 renderer extension point，不实现 renderer。
- 每次 manuscript load 必须来自一个 PostgreSQL database-consistent snapshot；多条 SELECT 不得依赖默认 `READ COMMITTED` 拼成 projection/fingerprint。
- 每个实现工作包遵循测试先行、最小实现、受影响测试、完整 gate、独立 commit；不得修改已验收 migrations `0001`–`0005`。

## Review Focus

以下五类最可能造成真实数据错误的输入必须由所属工作包的测试锁定：

1. project/outline/section/revision 在多个 SELECT 之间并发变化：`REPEATABLE READ` snapshot 只能产生 mutation 前或后的完整 fingerprint，不得产生 mixed-state；精确 revision 缺失仍 fail closed。
2. 10k/50k/100k manuscript 的 Abstract/Keywords/Conclusion context：每个 section 获得确定性覆盖，长 section 使用首/中/尾窗口，不得静默只保留论文开头；无法满足最小真实覆盖时不调用 LLM。
3. 正文中用户自己输入的 `[1]` 与 legacy P4 citation marker 混合：不得 regex 替换；缺 placement metadata 时产生 `CITATION_RENUMBER_UNSAFE`。
4. 新增 ABSTRACT/KEYWORDS 后旧 Workspace/list/outline/remap/section routes：只看 `sectionRole='OUTLINE'`，derived sections 不得进入 P4 payload 或被 P4 section mutation routes 操作。
5. export manifest 属于用户 A、artifact path 被篡改或对象缺失：用户 B 得到 404；路径逃逸被拒绝；owner 合法但对象缺失得到 sanitized 410。

---

## 1. Executive Summary

### 1.1 P5 解决的问题

P4 已能完成单章节写作与不可变修订，但没有一个整篇论文的确定性读取模型，也没有整篇预览、全局 citation numbering、全局 bibliography、derived Abstract/Keywords 生命周期和生产 DOCX export。P5 将现有 canonical 数据装配为：

```text
PaperProject
+ active Outline tree
+ active OUTLINE PaperSections
+ exact current PaperSectionRevisions
+ ABSTRACT / KEYWORDS current revisions
        ↓ deterministic read model
ManuscriptProjectionV1
        ↓ renderer
immutable DOCX ExportArtifact
```

### 1.2 直接复用的 P4 能力

- `paper_projects.selected_title/profile/research_plan/default_source_strategy`。
- `paper_outline_nodes` 的 stable ID、parent、node type、sibling position 与 lifecycle。
- `paper_sections.current_revision_number` 与 `paper_section_revisions` immutable history。
- `SourceStrategy`、`ActualSupportMode`、`SupportState`。
- `GroundedGenerationService` 产出的 `CitationReference[]`、`BibliographyEntry[]`、`EvidenceTrace[]` 与 provenance snapshot。
- P4 remap：orphan 只提示并排除，恢复仍由 Workspace 完成。
- 现有 auth、owner-scoped repository、PostgreSQL migration/backup/restore gates 与 document storage adapters。

### 1.3 Canonical / derived 边界

- Canonical body：每个 active OUTLINE section 由 `paper_sections.current_revision_number` 指向的 immutable revision。
- Derived read model：`ManuscriptProjectionV1`、readiness、warnings、word count、global citation mapping、bibliography、fingerprints；每次读取重建，不入库。
- Derived authored content：Abstract/Keywords 仍是 `PaperSection` + immutable `PaperSectionRevision`，通过 `section_role` 区分；只有 revision 与生成时 fingerprint 持久化。
- Immutable output：DOCX binary 存 object storage；`paper_exports` 保存 owner、renderer/template versions、fingerprint、artifact ref 与 revision manifest，不保存 manuscript body。

### 1.4 不引入 Phase F

Assembly 是有界数据库读取与纯转换；DOCX 是单进程有界 render；Abstract/Keywords 是与 P4 相同形态的一次 LLM 调用。当前代码或验收证据没有证明同步方式在 10k/50k/100k words 下不可接受。WP7 先形成 benchmark 证据；只有另行决策通过，才可提出 Phase F。

## 2. Current-State Audit

### 2.1 Baseline 与治理事实

| Item | GitHub fact |
|---|---|
| Repository | `https://github.com/booom12133/academic-writing-platform.git` |
| Baseline | `c13013d79e09f130693e94e71fd69f58c623787a` |
| P4 tag | annotated `phase-p4-accepted`, peeled target = baseline |
| P4 report | `docs/reviews/PHASE_P4_FINAL_ACCEPTANCE_REPORT.md` |
| P4 migration | `drizzle/migrations/0005_p4_paper_projects.sql` |
| P4 schema totals | 5 migrations / 19 required restored tables |
| P5 branch | not present on origin at audit time |

`PROJECT_STATE.md` 与 P4 Final Acceptance Report 在该 commit 中保留“tag pending”的标签创建前文字；远端 tag 是随后发生且无需 commit 的 GitHub 事实。P5 不重写历史报告。

### 2.2 PaperProject / Outline / Section / Revision

- `shared/paper-project.interface.ts` 定义 `PaperProject`、`OutlineNode`、`PaperSection`、`PaperSectionRevision` 与 `PaperWorkspace`。`PaperSection` 当前没有 role，`outlineNodeId` 可空，`currentRevisionNumber` 是显式 current pointer。
- `server/database/schema.ts` 的 P4 schema 有五张 paper tables。`paper_section_revisions_number_key(section_id,user_id,revision_number)` 保证每个 revision number 唯一；revision 本身包含 content hash、support/citation/bibliography/evidence snapshots。
- `PaperProjectRepository.appendRevision()` 在 transaction 中比较并递增 `currentRevisionNumber` 后 append immutable row，提供 optimistic concurrency。
- `PaperProjectRepository.listRevisions()` 按 `revisionNumber DESC` 排序；`PaperWorkflowController.section()` 和 `PaperWorkflowService.saveUserRevision()` 当前读取 `[0]`。这对 P4 正常 append 路径成立，但不能成为 P5 assembly 的选择规则。
- `replaceOutline()` 先 archive 旧 active outline、把 active sections 标为 orphaned，再恢复 retained stable nodes/sections；`remapSection()` 只允许把 orphan 恢复到没有 revision history 的 active writing-unit。
- `listOutline()` 仅按数据库返回的 `position` 排序，未建立整树 DFS；不同 parent 的相同 position 合法，因此不能直接作为整篇顺序。
- P5 加入 derived sections 后，P4 Workspace contract 必须保持 outline-only：existing `PaperProjectController.get()`、`PaperProjectRepository.listSections()`、outline replace/remap、section detail/history/save/generate routes 只能返回或接受 `sectionRole='OUTLINE'`。Manuscript loader 通过独立 repository method 读取 all roles；不得让 ABSTRACT/KEYWORDS 因复用 `listSections()` 意外进入 `PaperWorkspace.sections`。

### 2.3 Current citation / bibliography / Grounded Generation

- `server/modules/grounded-generation/grounded-generation.types.ts` 定义 `CitationReference { citationId, evidenceIds }`、`BibliographyEntry { citationId, fields }` 与 `EvidenceTrace`。trace 保留 `citationLocator`、chunk provenance 和可选 `sourceRecord`。
- `CitationSemanticsService.create()` 当前按 EvidenceSet 顺序建立 section-local `citation-1...n`。
- `BibliographyBuilder.build()` 只输出 `canonicalMetadata.*.resolutionStatus === 'resolved'` 的字段；无法解析的 metadata 进入 diagnostic，不猜测字段。
- `CitationRenderer.render()` 将 local marker `[1]` 直接写入字符串并只返回 `{content,bibliography}`，没有 marker offset/placement。这是 legacy P4 revision 无法安全全局 renumber 的根因。
- `PaperGenerationService.generate()` 对 grounded result 保存 content、citations、bibliography、evidenceTrace 与 generation metadata；对 `MODEL_ONLY` 保存空 citation/evidence，`supportState=NOT_CLAIMED`。
- 用户编辑由 `PaperWorkflowService.saveUserRevision()` 创建新 revision；曾经 `VALID` 的内容变为 `STALE_AFTER_EDIT`，且新 revision 清空 citations/bibliography/evidenceTrace。restore 会复制旧 snapshot，但把 `VALID` 降为 `STALE_AFTER_EDIT`。

### 2.4 Document storage

- `DocumentStoragePort` 提供 provider、bucket、upload/download/remove，filesystem 与 platform adapters 已具备 no-overwrite upload。
- `SelfHostedFilesystemDocumentStorageAdapter` 的 key validation 固定为上传语义：`academic-writing/users/<sha256-user>/<uuid>/<filename>`。它不接受 `exports` namespace。
- `DocumentInputService` 同时承担上传文件类型验证、owner scope hash、descriptor validation、integrity read 与 parsing orchestration；不能直接复用其 upload DTO 保存 DOCX artifact。
- `DOCUMENT_STORAGE_ROOT` 已保证 absolute 且在 public web root 外；生产物理 root 可复用，不能再建独立 storage infrastructure。

### 2.5 Frontend 缺口

- `client/src/pages/Papers/PaperWorkspacePage.tsx` 已承担 profile、title、Research Plan、outline edit、section editor、history、source binding、evidence JSON 与 orphan remap。
- `client/src/app.tsx` 只有 `/papers`、`/papers/new`、`/papers/:projectId`；没有 manuscript route。
- `client/src/api/paper-projects.ts` 没有 manuscript、derived、export、download client。
- 当前 UI 没有整篇阅读顺序、章节导航、readiness、missing/orphan summary、derived freshness、global references、export/history。

### 2.6 Export dependency 缺口

- `package.json` 没有 server-side DOCX authoring dependency。`mammoth` 是 DOCX 读取/转换依赖，不能生成 production DOCX；`jspdf`/`html2canvas` 是前端/PDF 工具，也不构成 DOCX export。
- P5 implementation 新增唯一 production dependency `docx@9.7.1`。官方包提供 TypeScript API 与 `Packer.toBuffer()`，输出 OOXML `.docx` ZIP。结构测试显式声明 direct devDependency `jszip@3.10.1`，不依赖 transitive import；两项依赖都只能在授权后通过 npm 修改 `package.json` 与 `package-lock.json`，不能在本轮安装。

## 3. Domain Invariants

1. `PaperSectionRevision` remains canonical body truth；current body 只能由 `current_revision_number` 精确解析。
2. Whole Manuscript is a derived projection；数据库不得保存第二份 assembled body。
3. Export artifact is immutable output；同一 export ID 的 binary、hash、manifest 不可覆盖。
4. Export manifest points to source revisions；manifest 记录 IDs/fingerprints/mapping/warnings，不复制正文。
5. No fabricated citation/evidence；只处理 revision snapshot 中真实 `VALID` evidence chain。
6. No silent evidence fallback；grounded/derived 失败不能自动转 `MODEL_ONLY`。
7. No orphan content in manuscript；orphan 永远排除并发出 warning。
8. Missing section is explicit；保留 heading + `【本节尚未完成】`，readiness 至少为 `INCOMPLETE`。
9. Derived stale state is fingerprint-based；不增加 mutable `is_stale` 列。
10. Archived outline nodes/sections 不进入 projection；archived project 可读、可列出/下载既有 export，但不可生成 derived content 或新 export。
11. Citation text 不做 regex 猜测；placement 不可验证时 clean export fail closed。
12. Ownership 在 project row、export row、storage key 三层重新验证；客户端提供的 artifactRef 永远不可信。
13. P4 Workspace remains outline-only；ABSTRACT/KEYWORDS 只能由 Manuscript domain 加载/变更，不能进入现有 Workspace payload 或 P4 section routes。

## 4. Proposed Domain Model

### 4.1 Runtime-only shared contracts

在 `shared/manuscript.interface.ts` 新增下列 versioned contracts；这些类型不对应 manuscript table：

```ts
export type SectionRole = 'OUTLINE' | 'ABSTRACT' | 'KEYWORDS';
export type ManuscriptReadiness = 'READY' | 'INCOMPLETE' | 'BLOCKED';
export type DerivedContentState = 'MISSING' | 'CURRENT' | 'STALE';
export type ManuscriptWarningCode =
  | 'TITLE_MISSING'
  | 'RESEARCH_PLAN_MISSING'
  | 'MISSING_SECTION'
  | 'ORPHANED_SECTION_EXCLUDED'
  | 'DERIVED_CONTENT_MISSING'
  | 'DERIVED_CONTENT_STALE'
  | 'CONCLUSION_REFRESH_STALE'
  | 'STALE_AFTER_EDIT'
  | 'CITATION_RENUMBER_UNSAFE'
  | 'CITATION_IDENTITY_CONFLICT'
  | 'BIBLIOGRAPHY_METADATA_UNRESOLVED';

export type ManuscriptBlock =
  | { kind: 'heading'; nodeId: string; sectionId?: string; level: number; title: string }
  | { kind: 'paragraph'; sectionId: string; revisionId: string; text: string }
  | { kind: 'missing-section'; nodeId: string; sectionId?: string; text: '【本节尚未完成】' }
  | { kind: 'references'; entries: ManuscriptBibliographyEntry[] };

export interface ManuscriptSupportSummary {
  validSections: number;
  staleSections: number;
  notClaimedSections: number;
  missingSections: number;
  managedCitationCount: number;
  bibliographyEntryCount: number;
  bibliographyState: 'NONE' | 'COMPLETE' | 'INCOMPLETE';
}

export interface ManuscriptProjectionV1 {
  schemaVersion: 1;
  projectId: string;
  title: string | null;
  language: 'zh-CN' | 'en';
  bodyFingerprint: string;
  manuscriptFingerprint: string;
  readiness: ManuscriptReadiness;
  wordCount: number;
  blocks: ManuscriptBlock[];
  derived: {
    abstract: DerivedContentProjection;
    keywords: DerivedContentProjection;
  };
  supportSummary: ManuscriptSupportSummary;
  citations: ManuscriptCitation[];
  bibliography: ManuscriptBibliographyEntry[];
  warnings: ManuscriptWarning[];
  exportPolicy: { cleanAllowed: boolean; draftAllowed: boolean; acknowledgementCodes: ManuscriptWarningCode[] };
}
```

`ManuscriptWarning` 必须包含 `code`、`severity`、sanitized message，以及可选 `nodeId/sectionId/revisionId`；不得包含 storage path、跨用户 ID 或 prompt 内容。

### 4.2 Persistence-backed contracts

- `PaperSection.sectionRole` 持久化；Abstract/Keywords 使用现有 section/revision lifecycle。
- `PaperExport` 持久化；只读 immutable row。
- `ExportManifestV1` 作为 schema-versioned JSONB：

```ts
interface ExportManifestV1 {
  schemaVersion: 1;
  exportId: string;
  createdAt: string;
  mode: 'DRAFT' | 'CLEAN';
  projectId: string;
  bodyFingerprint: string;
  manuscriptFingerprint: string;
  outline: { nodeIdsInPreorder: string[] };
  bodyRevisions: Array<{ sectionId: string; revisionId: string; revisionNumber: number; contentHash: string }>;
  abstractRevisionId?: string;
  keywordsRevisionId?: string;
  citationMapping: Array<{ sectionId: string; localCitationId: string; globalNumbers: number[] }>;
  warnings: Array<{ code: ManuscriptWarningCode; sectionId?: string; revisionId?: string }>;
  template: { key: 'generic-academic-v1'; version: '1' };
  renderer: { key: 'docx'; version: '1' };
}
```

### 4.3 Fingerprints

- 使用 `sha256(canonicalJson(value))`，canonical JSON 递归排序 object keys，保留 array order，以 UTF-8 编码。
- `bodyFingerprint` input version `manuscript-body-v1`：selected title/null、ResearchPlan/null、active outline preorder 中每个 node 的 id/parentId/nodeType/title/position、每个 writing-unit 的 sectionId/null、exact current revision id/number/contentHash/null。
- `manuscriptFingerprint` input version `manuscript-v1`：bodyFingerprint、Abstract exact revision id/contentHash/null、Keywords exact revision id/contentHash/null、normalized global citation mapping、template key/version、renderer key/version。
- `conclusionBasisFingerprintV1(targetSectionId)` 使用同一 canonical serializer，但把 target OUTLINE section 表示为 `{sectionId, excluded:true}`，不含其 current revision；它包含 title、Research Plan、完整 active outline identity/order/title 与其他 OUTLINE sections 的 exact revision identity/contentHash。
- derived state 动态比较 revision `generationMetadata.derivedFromBodyFingerprint` 与 current bodyFingerprint；相等为 `CURRENT`，缺失为 `MISSING`，不等或 metadata 无效为 `STALE`。
- word count 不参与 fingerprint。`countManuscriptWordsV1()` 对每个 CJK code point 计 1，对连续 Unicode letter/number token 计 1，忽略 heading/reference metadata；规则写 unit test 固定。

## 5. Database Proposal

授权后按可独立构建的 WP 边界新增两份 append-only migrations：WP3 的 `0006_p5_section_roles.sql` 只增加 `section_role`，WP5 的 `0007_p5_paper_exports.sql` 只增加 `paper_exports`。不得改 `0001`–`0005`；拆分避免 WP1/WP2 依赖 WP3 schema，也避免 WP3 提前创建 WP5 table。

### 5.1 `paper_sections.section_role`

```sql
ALTER TABLE paper_sections
  ADD COLUMN section_role varchar(20) NOT NULL DEFAULT 'OUTLINE';

ALTER TABLE paper_sections
  ADD CONSTRAINT paper_sections_role_check
  CHECK (section_role IN ('OUTLINE','ABSTRACT','KEYWORDS'));

ALTER TABLE paper_sections
  ADD CONSTRAINT paper_sections_role_outline_check
  CHECK (
    (section_role = 'OUTLINE' AND outline_node_id IS NOT NULL)
    OR
    (section_role IN ('ABSTRACT','KEYWORDS') AND outline_node_id IS NULL AND status <> 'orphaned')
  );

CREATE UNIQUE INDEX paper_sections_active_derived_role_key
  ON paper_sections(project_id,user_id,section_role)
  WHERE section_role IN ('ABSTRACT','KEYWORDS') AND status='active';
```

- Existing rows 通过 constant default/backfill 成为 `OUTLINE`，不会重写 revision data。
- `replaceOutline()` 只 orphan `section_role='OUTLINE'`；不得影响 Abstract/Keywords。
- `remapSection()` 只接受 `OUTLINE` orphan。
- Existing P4 `listSections()` 增加 `section_role='OUTLINE'` filter 并保持返回 shape；新增 `listManuscriptSections()` 才能读取 all roles。`getOutlineSection()` 为 existing P4 section routes 强制 OUTLINE role，derived service 使用独立 role-aware methods。
- `PaperProjectController.get()` 继续调用 outline-only list；`PaperWorkspace.sections` 不增加 Abstract/Keywords。任何 derived section ID 传入 P4 detail/history/save/generate/remap route 均按 not found 处理。
- derived section 创建采用 transaction + partial unique index，重复并发请求读取 winning row。

### 5.2 `paper_exports`

建议列：

```text
id uuid PK
project_id uuid NOT NULL
user_id varchar(64) NOT NULL
format varchar(16) NOT NULL CHECK format='DOCX'
template_key varchar(64) NOT NULL CHECK template_key='generic-academic-v1'
template_version varchar(32) NOT NULL
renderer_version varchar(32) NOT NULL
manuscript_fingerprint varchar(64) NOT NULL
snapshot_manifest jsonb NOT NULL
artifact_ref jsonb NOT NULL
_created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
```

Constraints/indexes：

- `UNIQUE(id,project_id,user_id)`，owner FK `(project_id,user_id) → paper_projects(id,user_id)`。
- check fingerprint 是 64 位 lower-case hex。
- check `jsonb_typeof(snapshot_manifest)='object'` 与 `jsonb_typeof(artifact_ref)='object'`；完整 shape 仍由 Zod 在 write/read 时验证。
- index `(user_id,project_id,_created_at DESC)`；不对 fingerprint 建 unique，用户可显式导出相同 snapshot 多次。
- table 无 update API；repository 只公开 create/list/get，不公开 update/delete。

### 5.3 Compatibility / rollback / restore

- WP3 同步 `server/database/schema.ts`、`server/database/local-development.database.ts` 的 role/default/check/index，并在该 WP gate 固定为 6 migrations / 19 tables；WP5 再增加 export table，并在该 WP gate 固定为 7 migrations / 20 tables。
- `test/unit/db-migration-schema-contract.spec.ts` 依次纳入 0006/0007 append-only hashes；`postgres-p5-migration-order.spec.ts` 证明 0005 未变、0006 只加一列/role constraints、0007 只加一表。
- WP3 先把 `scripts/db-restore-verify.js` 与 tests 更新为中间 contract 6/19；WP5 再更新为最终 7/20，并把 `paper_exports` 加入 verify query。这样两个 WP 各自的完整 backup/restore gate 都可通过。
- rollback compatibility 只验证 application rollback：旧 P4 binary 忽略新 column/table，`section_role` 有 default，不依赖 destructive down migration。不得在生产执行 schema rollback。
- backup 包含 export manifest row，但 object binary 仍需 storage backup policy；restore 后 missing object 按 410 处理，不能伪造 artifact。

## 6. Deterministic Assembly Algorithm

新增 `server/modules/paper-project/manuscript/`，职责分离为 loader、tree assembler、fingerprint、citation normalization、projection service。

### 6.1 Repository snapshot load

`PaperProjectRepository.loadManuscriptSnapshot(userId, projectId)` 的 contract 是 **one database-consistent snapshot**，不是“把多条 SELECT 放进默认 transaction”。当前 `drizzle-orm@0.44.6` 的 node-postgres adapter 支持 `PgTransactionConfig`，实现必须使用：

```ts
return db.transaction(
  async (tx) => loadAllRowsThrough(tx, userId, projectId),
  { isolationLevel: 'repeatable read', accessMode: 'read only' },
);
```

所有 project / active outline / sections / exact revisions / revision maxima SELECT 都必须使用传入的 `tx`；transaction callback 内不得调用仍绑定 root `db` 的 repository helper。若实施时 concrete adapter 无法可靠发出该 isolation config，则只能改为一个 SQL statement/CTE 一次返回完整 snapshot，或把 `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` 作为 transaction 的第一条语句并以 real PostgreSQL test 证明；不得降级为多条 `READ COMMITTED` SELECT。

同一 snapshot 中按以下步骤读取：

1. owner-scope load project；不存在返回 404。
2. load active outline nodes。
3. load project sections（active/orphaned/archived）及 `sectionRole`。
4. 对所有 `currentRevisionNumber > 0` 以 `(sectionId,userId,revisionNumber)` 一次 query 精确加载 revisions。
5. 加载 derived role current revisions 与 export-independent data。
6. 如 exact revision 缺失、current=0 却存在 revision、或 max revision > pointer，抛 `PAPER_MANUSCRIPT_INTEGRITY_FAILURE`；不得 fallback。

Real PostgreSQL concurrency test 使用两个 connections 与 barrier：connection A 在 snapshot 内读 project/outline 后暂停，connection B commit title/outline/section revision mutation，A 再读 sections/revisions。A 的 projection/fingerprint 必须全部来自 mutation 前状态；下一次 load 必须全部来自 mutation 后状态，任何前后字段混合都失败。project-only 与 section-revision mutation 都各有 case；pg-mem unit test 不能替代该 isolation evidence。

### 6.2 Tree validation 与 DFS

1. 以 node id 建 map；验证 active node parent 要么 null、要么同属 active set。
2. 验证无 self-parent/cycle；所有 active nodes 必须从 root 可达。
3. 每个 sibling group 按 `position ASC`，再以 `id ASC` 仅作防御性稳定排序；duplicate active sibling position 本应由 DB 拒绝，如读到则 integrity failure。
4. 用 iterative DFS preorder 输出；保留 depth。DOCX heading level 使用 `min(depth+1,9)`，projection 保留真实 depth。

### 6.3 Block assembly

- `container`：输出 heading，不查 section。
- `writing-unit`：输出 heading；若无 active OUTLINE section 或 pointer=0，则输出 `missing-section` block、`MISSING_SECTION` warning、readiness 至少 `INCOMPLETE`。
- current revision 存在：输出 paragraph/content blocks，并交给 citation normalizer；Markdown block parser 只在 DOCX renderer 中处理 list/table，projection 保留原文和 citation spans。
- orphaned OUTLINE section：不输出正文；每个有 history 的 orphan 产生 `ORPHANED_SECTION_EXCLUDED`。无 history orphan 可只计 warning summary，不暴露空正文。
- archived outline node、archived section：完全排除，不产生正文；若 active node 指向 archived section，视为 missing。
- integrity failures 不返回部分 manuscript，也不允许任何 export。

### 6.4 Completion/readiness

- `READY`：标题存在、无 missing section、Abstract/Keywords CURRENT、无 stale support、citation/bibliography 完整、无 blocking warning。
- `INCOMPLETE`：缺标题/Research Plan、missing section、orphan warning、derived missing/stale、`CONCLUSION_REFRESH_STALE` 或 stale support，但 projection 仍安全可读。
- `BLOCKED`：citation placement/identity/bibliography 不能安全形成 clean document；preview 仍可返回，但 `cleanAllowed=false`。
- integrity failure 高于 `BLOCKED`：请求失败，不生成 projection。

## 7. Whole-paper Citation / Bibliography Plan

### 7.1 扩展现有 citation engine

不得在 Paper module 内建立独立 citation engine。修改现有 `server/modules/grounded-generation/citation/`：

```ts
interface CitationPlacementV1 {
  schemaVersion: 1;
  citationId: string;
  localNumber: number;
  start: number;       // inclusive UTF-16 code-unit offset
  end: number;         // exclusive UTF-16 code-unit offset
  markerText: string;  // exact content.slice(start,end)
}

interface RenderedGroundedContent {
  content: string;
  bibliography: BibliographyEntry[];
  citationPlacements: CitationPlacementV1[];
}
```

`CitationRenderer` 在拼接字符串时记录 placement；`GroundedGenerationResult` additive 暴露 placements；`PaperGenerationService` 将其存为 `generationMetadata.citationPlacements`。写 revision 前验证每个 span non-overlap、按 start 排序、markerText 与 content slice 一致、citationId 存在。

### 7.2 Section-local → manuscript-global mapping

在 existing grounded-generation citation namespace 新增 `WholeDocumentCitationNormalizer`：

1. 只消费 current revision 且 `supportState='VALID'`。
2. 对每个 local citation 按 placement first occurrence 顺序处理。
3. citationId → evidenceIds → matching `EvidenceTrace`；未知/重复/conflicting trace fail closed。
4. 每个 evidence identity 优先 `sourceRecord.id`，再 `provenance.sourceRecordId`/`citationLocator.sourceRecordId`；若无 source record，fallback `documentVersionId`。
5. 同一 trace 中 sourceRecord/documentVersion fields 相互冲突时 `CITATION_IDENTITY_CONFLICT`，禁止 clean export。
6. 第一次出现的 global identity 分配下一个整数；之后复用。一个 local citation 若覆盖多个 global identities，输出排序去重后的 `[1,2]`。
7. replacement 按 placements 从字符串末尾向前应用；绝不扫描或 regex 替换其他 `[n]`。

示例：A:X/Y、B:X 映射为 A:`[1][2]`、B:`[1]`，References 只有 `[1] X`、`[2] Y`。

### 7.3 Bibliography dedup 与 provenance

- dedup key：`source:<sourceRecordId>`，fallback `version:<documentVersionId>`；title string 永远不是 identity。
- 每个 global entry 保留所有 contributing sectionId/revisionId/localCitationId/evidenceId/citationLocator，以便 UI trace。
- Bibliography 字段优先使用 revision 内 immutable `bibliography` snapshot；仅接受 P4 已标为 resolved 的 fields。不得在 assembly 时从 live metadata 悄悄“改善”历史 export。
- 同 identity 的多个 immutable snapshots 若 resolved fields 不同，产生 `CITATION_IDENTITY_CONFLICT`，clean export fail closed；不任意择一。
- 缺少可渲染字段产生 `BIBLIOGRAPHY_METADATA_UNRESOLVED`；preview 可展示“metadata unavailable”，clean export 禁止，draft export 需确认。

### 7.4 Support state handling

| State | Body | Managed citation | Global bibliography | Warning |
|---|---|---|---|---|
| `VALID` | include | normalize only with valid placements | include deduped resolved entry | metadata/placement gaps explicit |
| `STALE_AFTER_EDIT` | include | do not claim/renumber | exclude historical evidence | `STALE_AFTER_EDIT` |
| `NOT_CLAIMED` | include | none | none | none unless unexpected snapshot exists |

- MODEL_ONLY 必须保持 empty citations/bibliography/evidenceTrace；unexpected managed data 是 integrity warning，不能纳入 References。
- MIXED_EVIDENCE 不改变 identity/numbering；support summary 同时保留 actual mode 与每个 trace provenance。
- metadata-only source 没有 `VALID` evidence trace，不能进入 mapping。

### 7.5 Legacy compatibility / fail-closed cases

- Legacy P4 `VALID` revision 没有 placements：正文原样进入 preview，产生 `CITATION_RENUMBER_UNSAFE`，不猜 marker，不输出伪全局 mapping。
- CLEAN export 对 `CITATION_RENUMBER_UNSAFE`、identity conflict、unresolved cited bibliography、span mismatch 一律 409 fail closed。
- DRAFT export 可在 request 精确确认上述 warning code 后保留原 section text；DOCX 首页加“Draft—citation normalization incomplete”提示，受影响 revision 不进入 managed global References。
- user-authored `[1]` 没有 placement，永远保持普通文本。

## 8. Derived Content Plan

### 8.1 Whole-manuscript generation context

新增 `WholeManuscriptGenerationContextBuilder`；Abstract、Keywords、Conclusion refresh 必须共用它，不得把 unbounded `blocks.join()` 直接传给 LLM。`whole-manuscript-context-v1` contract：

```ts
interface WholeManuscriptGenerationContextV1 {
  version: 1;
  text: string;
  contextFingerprint: string;
  metadata: {
    budgetCodePoints: 60_000;
    sourceBodyCodePoints: number;
    includedSectionIds: string[];
    truncatedSections: Array<{
      sectionId: string;
      originalCodePoints: number;
      includedCodePoints: number;
      strategy: 'HEAD_MIDDLE_TAIL';
    }>;
    warnings: string[];
  };
}
```

Deterministic allocation：

1. 必选 envelope 完整保留 selected title、full canonical Research Plan、language、ordered outline headings、target operation/role 与 user instructions；不允许为了 body 静默删掉 title/Research Plan fields。
2. 总 budget 固定 60,000 Unicode code points。必选 envelope 先计费；如果它本身超过 budget，返回 `PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE`，不调用 LLM、不创建 revision。
3. 对所有有 current content 的 eligible OUTLINE sections 按 DFS order 建 coverage set；Abstract/Keywords 排除 derived/References，Conclusion refresh 另外排除 target Conclusion revision，但保留 target heading/operation instructions。
4. 剩余 budget 必须先给每个 eligible section 分配 heading + 最少 128 content code points。若无法覆盖每节最小 quota，fail closed 为 `PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE`；不得只保留前 N 节。
5. 余量用 deterministic water-filling 在 sections 间公平分配：每轮按 DFS order 给尚未完整覆盖的 section 同量 quota，最后不足一轮的余量按 DFS order 逐一分配。短 section 的未用 quota 继续重分配。
6. section 完整落入 quota 时原样保留；超长 section 使用 deterministic `HEAD_MIDDLE_TAIL` 三窗口，按 40%/20%/40% 分配，窗口间插入带 omitted code-point count 的非内容 delimiter。不得只截正文开头，也不得用额外 LLM 先行摘要。
7. builder 输出每节 allocation、truncation warning、source/body sizes 与 `sha256(canonicalJson(metadata + included exact excerpts))`。这些 metadata 写入 derived/conclusion revision `generationMetadata.generationContext`，UI 可展示“generation context truncated”，但不得将 truncation解释为论文正文缺失。

Builder unit tests覆盖 1/2/多节公平分配、短节 quota 回收、极长首节不能挤掉后续节、首/中/尾窗口、CJK/emoji code-point counting、必选 envelope overflow 与 10k/50k/100k deterministic fixtures。Performance benchmark 只测性能；无论结果如何都不授权 Queue/Redis/BullMQ。

### 8.2 Abstract / Keywords lifecycle

- `section_role='ABSTRACT'|'KEYWORDS'`，`outline_node_id=NULL`；仍使用 `current_revision_number` 与 immutable revisions。
- 初次生成在 transaction 中 get-or-create role section；后续生成 append revision，不覆盖历史。
- generator input 固定来自 `WholeManuscriptGenerationContextBuilder`，基于 selected title、Research Plan、当前 OUTLINE body（不含 Abstract/Keywords/References）及 language。Prompt 明确不得新增正文不存在的结果、统计、DOI 或 citation。
- Abstract 结构化输出 `{content:string}`；Keywords 输出 `{keywords:string[]}` 后以 deterministic `；`（zh-CN）或 `; `（en）保存为 non-empty content，同时在 generationMetadata 保存 normalized array。
- revision 使用 `sourceStrategy='MODEL_ONLY'`、`actualSupportMode='AI_DRAFT'`、`supportState='NOT_CLAIMED'`、empty evidence snapshots；它是对用户 canonical manuscript 的 summary，不声称外部 evidence。
- generationMetadata 至少保存 `{operation:'DERIVED_GENERATION', derivedRole, derivedFromBodyFingerprint, generationContext, provider, model, usage?}`。

### 8.3 Race / stale semantics

Request 同时提供 `expectedBodyFingerprint` 与 `expectedCurrentRevisionNumber`。服务在调用 LLM 前通过 `loadManuscriptSnapshot()` 的 `REPEATABLE READ READ ONLY` contract 取得一个内部一致 snapshot；LLM 返回后再通过同一 contract 取得另一个内部一致 snapshot 并比较 body fingerprint。pre/post snapshots 可以不同，但每个 snapshot 内不得 mixed-state。任一 fingerprint/revision 变化返回 409 `PAPER_MANUSCRIPT_CHANGED`，不保存已过期内容。Real PostgreSQL barrier test 覆盖 mutation 恰好发生在每个 multi-SELECT load 中，以及发生在 pre/post 两次 load 之间。

### 8.4 Conclusion refresh

Conclusion 不新增 role，也不脱离大纲。P5 提供显式：

```text
POST /api/paper-projects/:projectId/sections/:sectionId/conclusion-refresh
```

服务只接受 active `section_role='OUTLINE'` writing-unit，由用户明确选择目标；不通过标题字符串推断“结论”。上下文来自 `WholeManuscriptGenerationContextBuilder`，排除 target section content、保留 target heading/title/Research Plan；结果通过现有 `appendRevision()` 生成 `AI_REWRITE` revision，绝不自动覆盖用户修改。

Conclusion refresh 使用独立 `conclusionBasisFingerprintV1(targetSectionId)`：从一个 consistent snapshot 计算 title、Research Plan、active outline identity/order/title，以及除 target section current revision 之外所有 OUTLINE section 的 exact revision id/number/contentHash；target section 只放 `{sectionId, excluded:true}`。Request 提供 `expectedConclusionBasisFingerprint`，pre/post LLM 均用 target-excluded basis 比较；创建新的 Conclusion revision 不会改变 basis，因此不会立即自 stale。

新 revision metadata 保存：

```ts
{
  operation: 'CONCLUSION_REFRESH';
  conclusionBasisFingerprint: string;
  conclusionTargetSectionId: string;
  generationContext: WholeManuscriptGenerationContextV1['metadata'];
}
```

Projection 只在 current target revision 仍带 `operation='CONCLUSION_REFRESH'` 时重算 target-excluded basis；不相等产生 `CONCLUSION_REFRESH_STALE` 并使 readiness 至少为 `INCOMPLETE`。后续普通 `USER_EDIT` revision 使用现有 `generationMetadata:{operation:'USER_SAVE'}`，自然移除/替换 tracking；不得把旧 refresh metadata 继承到用户编辑上。Tests 必须证明 refresh 后立即 CURRENT、其他 section/title/Research Plan/outline 变化后 STALE、只创建新的 target Conclusion revision 不自 stale、USER_EDIT 后不再声称 derived-refresh freshness。

## 9. Preview Architecture

### 9.1 Backend

新增 `ManuscriptController` / `ManuscriptProjectionService`，归属 `PaperProjectModule`，不扩充 `PaperWorkspacePage` 的后端 payload：

```text
GET /api/paper-projects/:projectId/manuscript
```

返回 `ManuscriptProjectionV1`。owner 不匹配与不存在统一 404；未认证 401；integrity failure 500 sanitized；合法 incomplete/blocking projection 仍为 200 并携带 warnings/exportPolicy。

### 9.2 Frontend

新增 route `/papers/:projectId/manuscript` 与 `ManuscriptPage.tsx`：

- 左栏：DFS chapter navigation、missing badge。
- 中栏：Title、Abstract、Keywords、heading/body、missing placeholder、global References 的 reading view。
- 右栏：word count、readiness、support summary、orphan/stale/derived/citation warnings、derived generation、export actions/history。
- warning 跳转回 Workspace 对应 section/remap；Workspace header 增加“整篇预览”链接；Manuscript 页保留“返回章节工作区”。
- 不增加 rich-text editor。正文编辑、history、sources/evidence、orphan remap 继续属于 `PaperWorkspacePage`；Manuscript 页只负责 whole-paper read/derive/export。

## 10. Export Architecture

### 10.1 Pipeline

```text
authenticated POST export
→ assemble current ManuscriptProjectionV1
→ validate expected fingerprint + mode policy
→ generate exportId + createdAt once
→ ManuscriptRenderer.render(projection, options)
→ DOCX Buffer + sha256
→ ObjectStoragePort.putImmutable()
→ insert paper_exports manifest/artifactRef
→ return ExportArtifact
```

`PaperExportService` 在 render 前生成 `exportId` 与 millisecond-precision UTC `createdAt`，同一 timestamp 传给 DOCX core properties、safe filename/manifest，并在 insert 时显式写入 `paper_exports._created_at`；不得让 renderer 和数据库各自调用 `new Date()`。storage upload 成功但 DB insert 失败时，立即 best-effort remove exact newly generated key；原错误不被 compensation 覆盖。DB row 只在 object 成功后创建，避免下载到半成品。

### 10.2 Renderer abstraction

```ts
interface ManuscriptRenderer<TOptions = unknown> {
  readonly format: 'DOCX';
  readonly rendererVersion: '1';
  render(projection: ManuscriptProjectionV1, options: TOptions): Promise<{
    buffer: Buffer;
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    extension: 'docx';
  }>;
}

interface DocxRenderOptions {
  exportId: string;
  createdAt: string;
  mode: 'DRAFT' | 'CLEAN';
  templateKey: 'generic-academic-v1';
}
```

`DocxManuscriptRenderer` 使用 `docx@9.7.1` 与 `Packer.toBuffer()`；不得通过 HTML screenshot、browser download 或 PDF library 伪装 DOCX。

### 10.3 `generic-academic-v1`

代码级 registry 固定 template key/version；version 1 支持：

- title、Abstract、Keywords、References；
- heading-derived static Table of Contents：位于 Abstract/Keywords 之后、正文之前，按相同 DFS heading order/level 输出缩进文本，不含页码、不写 Word TOC field、不依赖 Word 打开后更新；References 作为最后一项，title/Abstract/Keywords 不进入 TOC；
- Heading 1–9、paragraph；
- `-/*/+` unordered list、`1.` ordered list；
- basic pipe Markdown table（矩形化、纯文本 cell）；
- top-level outline node 前 page break（首个除外）；
- font strategy：zh-CN body 声明 `eastAsia=宋体`、`ascii/hAnsi=Times New Roman`，zh-CN headings 声明 `eastAsia=黑体`、`ascii/hAnsi=Times New Roman` 并 bold；en body/headings 声明 `Times New Roman`，headings bold；不嵌入、不打包、不再分发字体文件；
- host fallback：Word/LibreOffice 若宿主未安装声明字体，可按其自身 font substitution 回退；P5 只保证 OOXML declarations 稳定，不保证不同宿主的 glyph metrics/page pagination 一致，因此 static TOC 不含页码；
- Acknowledgements 与 Appendix 如由用户建成 container/writing-unit，按普通 outline node、相同 heading/paragraph 规则输出；P5 不为它们增加 role、table、API 或专门版式；
- core properties：title、subject、creator=`Academic Writing Platform`、createdAt=预先生成且与 `paper_exports._created_at` 相同的 UTC timestamp；
- safe filename `<sanitized-title>-<yyyyMMdd-HHmmss>-<8-char-export-id>.docx`。

Markdown parser 只识别上述有界语法；不解析 raw HTML，不加载 URL/image，不执行 template expression。公式、未知 Markdown 与复杂表格作为 plain text 保留。明确不支持 OMML、figure management/numbering、cross-reference fields、机构/期刊模板、复杂 header/footer 或高级页码。

### 10.4 Export modes

- `CLEAN`：只有 `projection.exportPolicy.cleanAllowed=true`；否则 409 并返回 blocking warning codes。
- `DRAFT`：允许 `INCOMPLETE/BLOCKED` projection，但 request 的 `acknowledgedWarningCodes` 必须覆盖 projection 要求的全部 code；DOCX 写入 draft notice 与 warnings summary。
- request 必须带 `expectedManuscriptFingerprint`，避免用户预览后内容已变仍导出旧认知；不匹配返回 409。

## 11. Artifact Storage

### 11.1 Abstraction extraction

把底层能力从 DocumentInput domain 抽到 `server/modules/storage/`：

```ts
interface ObjectStoragePort {
  getProvider(): 'platform-file' | 'self-hosted-filesystem';
  getDefaultBucketId(): Promise<string>;
  putImmutable(input:{bucketId:string;objectKey:string;buffer:Buffer;contentType:string}):Promise<void>;
  get(input:{bucketId:string;objectKey:string}):Promise<Buffer|null>;
  remove(input:{bucketId:string;objectKey:string}):Promise<void>;
}
```

现有 `DocumentStoragePort` 通过 adapter/facade 继续保持 P4 contract，DocumentInput tests 必须无行为变化。filesystem/platform 共享同一 provider、bucket、root 与 no-overwrite semantics。

### 11.2 Namespace / artifactRef

- object key：`academic-writing/users/<sha256-user>/exports/<projectId>/<exportId>/<safeFilename>`。
- 通用 adapter 验证 canonical segments、UUIDs、user scope、encoded separators、`..`、backslash、control chars 与 root containment；DocumentInput 继续使用 upload namespace validator。
- `ArtifactRefV1`：version/provider/bucketId/objectKey/fileName/mimeType/sizeBytes/sha256；所有字段由 server 生成。
- download 先以 `(exportId,projectId,userId)` 读 DB，再 Zod 校验 artifactRef、重新推导 user-scope/project/export path、读取 object、复核 size/hash，最后设置 `Content-Disposition: attachment` 与安全 filename。

### 11.3 Lifecycle

- artifact immutable，无 overwrite endpoint。
- project archive 不删除 object/row；list/download 继续可用，新 generate/export 返回 409 `PAPER_PROJECT_ARCHIVED`。
- P5 不提供 export delete；cleanup policy 是“保留直到未来显式 retention phase”。不得按文件系统扫描自动删除。
- owner 合法但 object 缺失：`PAPER_EXPORT_ARTIFACT_MISSING` / HTTP 410；hash/size 不符：`PAPER_EXPORT_ARTIFACT_CORRUPT` / HTTP 500，均不返回任意 bytes。

## 12. API Plan

所有 endpoint 使用 `@NeedLogin()`，userId 只来自 `req.userContext`，所有 IDs 用 UUID schema 严格验证，unknown body keys 被拒绝。

### 12.1 Manuscript

```text
GET /api/paper-projects/:projectId/manuscript
200 ManuscriptProjectionV1
401 unauthenticated
404 project not owned/not found
500 PAPER_MANUSCRIPT_INTEGRITY_FAILURE
```

### 12.2 Derived content

```text
POST /api/paper-projects/:projectId/derived/abstract/generate
POST /api/paper-projects/:projectId/derived/keywords/generate
body: {
  expectedBodyFingerprint: string;
  expectedCurrentRevisionNumber: number;
  instructions?: string; // max 10,000
}
response: { section: PaperSection; revision: PaperSectionRevision; derivedState:'CURRENT'; bodyFingerprint:string }
```

Failures：400 invalid request；404 owner/project；409 project archived、body changed 或 revision conflict；502/503 provider；504 deadline；任何失败不创建 revision。

Conclusion refresh body：

```ts
{
  expectedConclusionBasisFingerprint: string;
  expectedCurrentRevisionNumber: number;
  baseRevisionId?: string;
  instructions?: string;
}
```

Conclusion refresh response 同时返回 `conclusionBasisFingerprint`；409 返回 current basis fingerprint，客户端必须 refresh 后重试，不能退回 ordinary body fingerprint。

### 12.3 Exports

```text
POST /api/paper-projects/:projectId/exports
body: {
  format: 'DOCX';
  mode: 'CLEAN'|'DRAFT';
  templateKey: 'generic-academic-v1';
  expectedManuscriptFingerprint: string;
  acknowledgedWarningCodes?: ManuscriptWarningCode[];
}
201 ExportArtifact

GET /api/paper-projects/:projectId/exports
200 ExportArtifactSummary[] // newest first, no raw storage path

GET /api/paper-projects/:projectId/exports/:exportId
200 ExportArtifact // manifest + safe metadata, no binary

GET /api/paper-projects/:projectId/exports/:exportId/download
200 binary attachment
```

`ExportArtifact` API projection 不暴露 bucketId/objectKey；返回 id/format/mode/template/renderer/fingerprint/size/hash/createdAt/download URL。POST 409 包含 current fingerprint 或 required warning codes，便于 UI refresh，不含正文。

## 13. Testing Plan

### 13.1 Unit

- `manuscript-tree-assembler.spec.ts`：跨 parent position、DFS preorder、container/writing unit、deep level clamp、missing parent、cycle、archived exclusion。
- `manuscript-snapshot.loader.spec.ts`：exact pointer、missing exact revision、pointer 0 with history、higher-than-pointer revision、owner scope、所有 SELECT 只使用 transaction-scoped handle。
- `manuscript-fingerprint.spec.ts`：stable key order；title/research plan/outline order/title/section/current revision/derived/template/renderer 任一变化改变相应 fingerprint。
- `manuscript-projection.service.spec.ts`：missing placeholder、orphan exclusion、readiness/support summary、word count、archived project read-only。
- `citation-renderer.spec.ts`：UTF-16 offsets、adjacent markers、多 citation marker、emoji/CJK、span validation。
- `whole-document-citation-normalizer.spec.ts`：local→global mapping、sourceRecord preferred、version fallback、dedup、mixed evidence、field conflict、MODEL_ONLY、STALE、user `[1]`、unsafe legacy。
- `whole-manuscript-generation-context.builder.spec.ts`：60k budget、title/full Research Plan preservation、section fair allocation、quota redistribution、HEAD/MIDDLE/TAIL、truncation metadata、required envelope/minimum coverage fail-closed、10k/50k/100k determinism。
- `derived-content.service.spec.ts`：get-or-create role、immutable revision、consistent-snapshot pre/post body race、stale/current/missing、no fabricated citation fields、Conclusion basis immediate-current/change-stale/USER_EDIT tracking removal。
- `docx-manuscript.renderer.spec.ts`：title/static TOC/headings/paragraph/list/table/references/page breaks/core createdAt/font declarations、ordinary Acknowledgements/Appendix、plain formula fallback、escaping。
- `object-storage` adapter tests：upload namespace regression、export namespace, traversal/encoded separator/backslash, containment, no-overwrite。
- `paper-export.service.spec.ts`：clean/draft policy、ack coverage、compensation on DB failure、fingerprint conflict、missing/corrupt artifact。

### 13.2 PostgreSQL integration

- migration 0006/0007 order/hash；old rows backfill `OUTLINE`；每个 migration WP 的中间 6/19 与最终 7/20 contract 都有对应测试。
- derived role check + at-most-one active Abstract/Keywords under concurrency。
- real PostgreSQL `REPEATABLE READ` barrier tests：并发 project/title/outline/section revision commit 不得产生 mixed-state snapshot/fingerprint；derived pre/post loads 各自内部一致。
- P4 Workspace compatibility：`PaperProjectController.get()`/list/outline/detail/history/save/generate/remap 不返回或接受 derived role sections。
- owner composite FK、cross-user export insert denial、format/fingerprint/json checks。
- export create/list/get persistence 与 immutable repository surface。
- backup/restore final verify 7 migrations/20 tables，`paper_exports` manifest survives；object absence separately returns 410。
- rollback compatibility：P4-shaped inserts omit `section_role` and receive default `OUTLINE`。

更新 `package.json#test:integration:postgres` 加入 P5 suite；CI `postgres-schema` 必须用 real PostgreSQL 验证 partial index/check/FK，不能只依赖 pg-mem。

### 13.3 HTTP E2E

**A Zero-upload → Whole Manuscript → DOCX**

创建 MODEL_ONLY project/outline/revisions，生成 Abstract/Keywords，GET projection，POST CLEAN export，下载并验证 OOXML；断言 citations/references empty 且无 fabricated metadata。

**B Grounded multi-section → global bibliography dedup**

两节引用同 sourceRecord + 不同 source，断言首次出现编号、跨节复用、References 去重、manifest mapping/provenance 完整。

**C Grounded section user edit → stale support**

先 VALID 后 USER_EDIT，断言 body 保留、support stale、旧 evidence 不进入 managed bibliography、clean export blocked 或 draft explicit ack。

**D Missing / orphan → explicit warnings**

活动 writing-unit 无 revision + orphan 有 history，断言 heading/placeholder、orphan excluded、readiness INCOMPLETE、未确认 draft export 409、确认后 DOCX 带 draft notice。

额外 E2E：用户 B 对 projection/export metadata/download 全部 404；未认证 401；archived project 只允许 read/list/download existing artifact；生成 Abstract/Keywords 后重新 GET P4 Workspace 仍只含 OUTLINE sections；derived section ID 访问 P4 mutation routes 返回 404；Conclusion refresh 后修改另一节会出现 `CONCLUSION_REFRESH_STALE`。

### 13.4 DOCX structural tests

DOCX 是 ZIP；用 direct devDependency `jszip@3.10.1` 读取，不依赖 `docx` 的 transitive dependency：

- `[Content_Types].xml`、`word/document.xml`、`word/styles.xml`、`docProps/core.xml` 存在；
- XML 可解析，正文 text/static TOC/heading styles/page break/table/reference order 正确；TOC 不含 page-number field；
- `word/styles.xml` 的 zh-CN/en body/heading `w:rFonts` declarations 符合 template contract；`docProps/core.xml` created timestamp 与 export API/DB fixture 完全一致；
- relationships 不含 external target；
- 不比较 whole binary hash，因为 ZIP timestamps/ordering 不是业务 contract。

### 13.5 Required commands

授权实现后每个 WP 跑 targeted Jest；WP7 最终必须跑：

```powershell
npm test -- --runInBand
npm run test:integration:postgres
npm run lint
npm run type:check
npm run build:server
npm run build:client
npm run test:app-bootstrap
npm run test:e2e -- --runInBand
```

## 14. Performance / Sync Benchmark

新增非默认 `scripts/benchmark-p5-manuscript.ts` 与 deterministic fixture generator；不得调用 LLM、network 或 production storage。

| Size | Measure | Record |
|---|---|---|
| 10k words | assembly + citation normalization + DOCX render | p50/p95 wall time, peak RSS delta, buffer bytes |
| 50k words | same | same |
| 100k words | same | same |

- 每种 size warm-up 1 次、测量 5 次；记录 Node/version/CPU/RAM/template/renderer version。
- Acceptance baseline：100k assembly 无 stack overflow，projection deterministic；context builder 在 budget 内保持逐节公平覆盖或明确 fail closed；100k DOCX 可生成并通过 ZIP/XML check；无 hard-coded Phase F trigger。
- 若 p95 超出现有 HTTP deadline、RSS 对单实例并发不安全或 render 无法完成，只生成 `PHASE_F_DECISION_REQUIRED` evidence；不得在 P5 自动引入 queue。

## 15. Security

- 所有 reads/writes 用 authenticated `userId + projectId`；cross-user 统一 404，防止 UUID oracle。
- export download 从 DB owner lookup 开始，不能接受客户端 artifactRef/path。
- storage adapter 拒绝 absolute path、`..`、encoded `/`/`\`、backslash、NUL/control chars、scope/project/export mismatch，并在 resolve 后再次验证 root containment。
- filename 去除 path segments、control chars、Windows reserved characters/trailing dot-space，限制 160 code points；HTTP 使用安全 quoted/UTF-8 `Content-Disposition`。
- DOCX text 只通过 library text nodes 进入 OOXML；不拼 raw XML，不执行 Markdown HTML/template expression，不 fetch image/URL，不加载用户模板。
- rendered buffer 设置上限（建议 50 MiB）；超限 fail closed，不写 artifact row。
- manifest/artifactRef 在 write/read 双向 Zod validation；hash/size 下载复核。
- 错误不返回 filesystem root、bucket、object key、provider exception、prompt 或其他用户 identity。
- export content 可包含用户文本，因此响应使用 attachment、正确 MIME、`nosniff`；不在浏览器 inline 执行。

## 16. Work Packages / Implementation Sequence

依赖顺序：`WP1 → WP2 → WP3`；`WP4` 依赖 WP1/WP3；`WP5 → WP6` 依赖 WP1/WP2；`WP7` 汇总全部。WP1 只使用 P4 implicit OUTLINE rows，不修改 `PaperSection.sectionRole`；persisted role contract、shared `PaperSection` extension 与 P4 compatibility filters 同时在 WP3 落地。每个 WP 完成后必须独立通过 targeted tests、`npm run type:check`、`npm run build:server`、`npm run build:client` 与 AppModule bootstrap 后再 review；不得依赖后续 WP 才能编译，不得跨 WP 提前实现 deferred scope。

### WP1 — Manuscript Projection & Assembly

**Goal:** 建立 exact revision snapshot、tree DFS、fingerprints、readiness 与 runtime projection，不做 citation renumber/export。

**Scope:** runtime manuscript shared contracts；基于 P4 rows 全部视为 OUTLINE 的 snapshot loader；tree assembler；fingerprints；projection endpoint skeleton。WP1 不增加 persisted `section_role`、不修改 `PaperSection` shared contract、不创建 migration/table。

**Files/modules likely affected:**

- Create `shared/manuscript.interface.ts`
- Create `server/modules/paper-project/manuscript/manuscript-snapshot.loader.ts`
- Create `server/modules/paper-project/manuscript/manuscript-tree-assembler.ts`
- Create `server/modules/paper-project/manuscript/manuscript-fingerprint.ts`
- Create `server/modules/paper-project/manuscript/manuscript-projection.service.ts`
- Modify `server/modules/paper-project/paper-project.repository.ts`
- Modify `server/modules/paper-project/paper-project.errors.ts`
- Modify `server/modules/paper-project/paper-project.exception-filter.ts`
- Test corresponding `.spec.ts` files

**Interfaces:** produces `loadManuscriptSnapshot(userId,projectId)`（Drizzle `REPEATABLE READ READ ONLY`）、`assembleOutlineTree(nodes)`, `computeBodyFingerprint(snapshot)`, `getProjection(userId,projectId,options)`；WP1 snapshot adapter 将 baseline P4 sections 标成 runtime `'OUTLINE'`，但不把该字段加入 `PaperSection` API。

**Implementation steps:**

- [ ] Write failing tests for exact pointer, DFS, missing/orphan/archived, integrity failures, fingerprint mutations and transaction-scoped query usage.
- [ ] Add shared versioned manuscript types and `REPEATABLE READ READ ONLY` snapshot query without changing existing P4 interfaces/endpoints.
- [ ] Implement iterative tree validation/DFS and exact current selection.
- [ ] Implement canonical JSON SHA-256, word count, warnings/readiness base projection.
- [ ] Run real PostgreSQL barrier tests for concurrent project/section mutation plus targeted tests/type-check/server+client builds/AppModule bootstrap；commit `feat(p5): add deterministic manuscript projection`.

**Acceptance criteria:** each load is one consistent snapshot and concurrent mutation cannot create mixed-state fingerprint；same DB snapshot always yields byte-identical canonical fingerprint/projection order；missing explicit、orphan excluded、pointer/tree corruption fail closed；WP1 alone type-checks/builds。

**Explicit out-of-scope:** citation renumber, LLM calls, frontend, binary render/storage.

**Dependencies:** accepted P4 baseline only.

### WP2 — Whole-paper Citation & Bibliography

**Goal:** 在现有 citation engine 内增加 placements 与 whole-document normalization。

**Scope:** renderer placement extension；generation metadata persistence；legacy detection；global mapping/dedup/provenance/support summaries。

**Files/modules likely affected:**

- Modify `server/modules/grounded-generation/grounded-generation.types.ts`
- Modify `server/modules/grounded-generation/citation/citation-renderer.ts`
- Modify `server/modules/grounded-generation/grounded-generation.service.ts`
- Create `server/modules/grounded-generation/citation/whole-document-citation-normalizer.ts`
- Modify `server/modules/paper-project/paper-generation.service.ts`
- Modify P4/grounded generation fixtures to include placements for newly generated valid revisions

**Interfaces:** consumes WP1 ordered revision blocks; produces normalized content spans, `ManuscriptCitation[]`, bibliography, mapping manifest and blocking warnings.

**Implementation steps:**

- [ ] Write failing renderer tests for exact UTF-16 placements and unchanged rendered content.
- [ ] Extend grounded result additively and persist placements in generationMetadata.
- [ ] Write failing normalization tests for dedup, fallback identity, mixed/stale/MODEL_ONLY and legacy unsafe cases.
- [ ] Implement normalizer using placement-only replacement and immutable bibliography snapshots.
- [ ] Integrate support summary/readiness into WP1 projection; run grounded + P4 regression; commit `feat(p5): normalize manuscript citations safely`.

**Acceptance criteria:** no regex marker replacement; same source reuses first global number; stale/not-claimed sources never enter managed References; legacy gaps block clean export.

**Explicit out-of-scope:** new retrieval, new bibliography metadata resolver, citation style marketplace.

**Dependencies:** WP1.

### WP3 — Derived Front Matter

**Goal:** 使用 section roles 和 fingerprint lifecycle 生成 Abstract/Keywords，并提供 explicit Conclusion refresh。

**Scope:** complete migration `0006_p5_section_roles.sql`；shared `PaperSection.sectionRole` extension；P4 outline-only repository/API compatibility；derived repository/service/generators/controllers；bounded whole-manuscript context；race detection；Abstract/Keywords and Conclusion freshness projection。

**Files/modules likely affected:**

- Create `drizzle/migrations/0006_p5_section_roles.sql`（仅在 authorization 后）
- Modify `shared/paper-project.interface.ts` to add required `sectionRole`
- Modify `server/database/schema.ts`
- Modify `server/database/local-development.database.ts`
- Create `server/modules/paper-project/manuscript/derived-content.service.ts`
- Create `server/modules/paper-project/manuscript/whole-manuscript-generation-context.builder.ts`
- Create `server/modules/paper-project/generators/abstract.generator.ts`
- Create `server/modules/paper-project/generators/keywords.generator.ts`
- Create/modify manuscript controller/module wiring
- Modify existing repository/controller/workflow queries to keep all P4 flows OUTLINE-only
- Update restore contract/tests to the independently passing 6 migrations / 19 tables state
- Add migration, compatibility, context-builder, repository, generator, service and HTTP tests

**Interfaces:** produces role-aware manuscript-only repository methods、`WholeManuscriptGenerationContextBuilder.build()`、generate Abstract/Keywords APIs 与 target-excluded Conclusion refresh；consumes WP1 consistent snapshot/body fingerprint and existing `LlmService`/appendRevision.

**Implementation steps:**

- [ ] Write migration/role uniqueness/backfill and P4 Workspace outline-only compatibility tests before SQL/schema changes.
- [ ] Write failing context budget/fair coverage/truncation/fail-closed and consistent-snapshot pre/post race tests.
- [ ] Write failing get-or-create/current-stale and target-excluded Conclusion basis lifecycle tests.
- [ ] Add structured generators with no-citation/no-fabrication validation.
- [ ] Implement transactional role sections, OUTLINE-only P4 guards, bounded context builder and pre/post generation fingerprint/basis checks.
- [ ] Add authenticated endpoints/error mapping；run targeted + real PostgreSQL + full P4 compatibility tests/type-check/server+client builds/AppModule bootstrap；commit `feat(p5): add fingerprinted manuscript front matter`.

**Acceptance criteria:** exactly one active section per derived role/project；P4 Workspace payload/routes remain OUTLINE-only；all changes append revisions；long-paper context is bounded/fair/observable or fails safely；each pre/post load is internally consistent；Conclusion refresh does not self-stale but becomes stale after basis change；WP3 alone type-checks/builds。

**Explicit out-of-scope:** special Conclusion role, automatic rewrite after every body edit, whole-paper quality reviewer.

**Dependencies:** WP1; WP2 only for final projection completion state.

### WP4 — Manuscript Preview

**Goal:** 提供独立 whole-paper reading route/UX，并保持 Workspace 职责边界。

**Scope:** GET projection API complete；client API/helpers/page/routes；navigation/warnings/readiness/references/derived controls/export placeholders。

**Files/modules likely affected:**

- Create `client/src/pages/Papers/ManuscriptPage.tsx`
- Create `client/src/lib/manuscript.ts`
- Modify `client/src/api/paper-projects.ts`
- Modify `client/src/app.tsx`
- Modify `client/src/pages/Papers/PaperWorkspacePage.tsx`（仅链接/return navigation）
- Create `test/unit/manuscript-client.spec.ts`
- Extend HTTP E2E

**Interfaces:** consumes `ManuscriptProjectionV1`; produces user actions with current body/manuscript fingerprints.

**Implementation steps:**

- [ ] Add owner-scoped API client contract tests and warning/readiness helper tests.
- [ ] Add route and accessible reading layout with stable heading anchors.
- [ ] Add derived status/actions and conflict refresh behavior.
- [ ] Render support/bibliography without raw JSON or false validity claims.
- [ ] Run client tests/type-check/build; commit `feat(p5): add whole manuscript preview`.

**Acceptance criteria:** preview order matches server DFS；missing/orphan/stale/unsafe states visible；Workspace remains editor/source/remap owner；cross-user route unavailable。

**Explicit out-of-scope:** rich text editing, drag/drop manuscript layout, template editor.

**Dependencies:** WP1–WP3.

### WP5 — Export Artifact Foundation

**Goal:** 抽取通用 object storage、持久化 immutable export manifest，并实现 owner-safe list/get/download。

**Scope:** storage port/adapters；complete `0007_p5_paper_exports.sql` migration/repository；artifact service；download integrity；final restore contract。

**Files/modules likely affected:**

- Create `server/modules/storage/object-storage.port.ts`
- Create/refactor filesystem/platform object storage adapters and module
- Keep `server/modules/document-input/document-input.storage.ts` as compatibility facade
- Modify document storage provider/tests without semantic change
- Create `server/modules/paper-project/export/paper-export.repository.ts`
- Create `server/modules/paper-project/export/paper-export.service.ts`
- Create `drizzle/migrations/0007_p5_paper_exports.sql`（仅在 authorization 后）
- Modify schema/local DB/restore scripts/tests to final 7 migrations / 20 tables

**Interfaces:** produces `putImmutable/get/remove`, export create/list/get metadata and authenticated download; consumes finalized Buffer from WP6.

**Implementation steps:**

- [ ] Pin existing DocumentInput storage regression tests, then write export namespace/traversal/no-overwrite tests.
- [ ] Extract port/adapters while keeping DocumentInput public behavior and provider identifiers unchanged.
- [ ] Write 0007 migration/repository ownership/manifest validation tests; add `paper_exports` without changing 0006.
- [ ] Implement artifact write compensation and download hash/size verification.
- [ ] Update backup/restore counts/tests to 7/20；run real PostgreSQL tests/type-check/server+client builds/AppModule bootstrap；commit `feat(p5): persist immutable export artifacts`.

**Acceptance criteria:** one storage infrastructure；no path can escape root；row/object immutable；cross-user denied；missing/corrupt object fails safely；P4 upload tests unchanged。

**Explicit out-of-scope:** retention scheduler, object lifecycle service, export deletion, public share links.

**Dependencies:** WP1 for manifest/fingerprint types.

### WP6 — Generic DOCX Export

**Goal:** 将同一 projection 渲染为 editable `generic-academic-v1` DOCX，并连接 export pipeline。

**Scope:** authorized production dependency `docx@9.7.1` 与 test devDependency `jszip@3.10.1`；renderer registry/interface；Markdown subset mapper；export POST；draft/clean policy；download E2E/XML tests。

**Files/modules likely affected:**

- Modify `package.json` and lockfile only after authorization
- Create `server/modules/paper-project/export/manuscript-renderer.ts`
- Create `server/modules/paper-project/export/docx-manuscript.renderer.ts`
- Create `server/modules/paper-project/export/generic-academic-v1.template.ts`
- Create `server/modules/paper-project/export/markdown-block-parser.ts`
- Create export controller/DTO/tests
- Extend `client/src/api/paper-projects.ts` and `ManuscriptPage.tsx`

**Interfaces:** consumes `ManuscriptProjectionV1`/`ExportManifestV1`; produces DOCX Buffer and immutable `ExportArtifact`.

**Implementation steps:**

- [ ] Add exact production dependency through npm and verify lockfile contains no unrelated upgrades.
- [ ] Write failing parser/renderer OOXML structural tests for every supported block、static TOC order/no-page-field、zh-CN/en font declarations and core createdAt equality.
- [ ] Implement template registry + static heading-derived TOC + declared font strategy + DOCX renderer with no raw XML/external relationships/font embedding.
- [ ] Write failing clean/draft/fingerprint/ack endpoint tests, then connect renderer→storage→DB.
- [ ] Add UI export/history/download controls and zero-upload DOCX E2E；run targeted tests/type-check/server+client builds/AppModule bootstrap；commit `feat(p5): export generic academic docx`.

**Acceptance criteria:** downloaded file is valid OOXML ZIP and editable；static TOC order/no-page-number policy、fonts、createdAt contract and supported structure are correct；unsupported syntax preserved safely；clean/draft rules enforced；artifact fingerprint/manifest match projection；WP6 alone type-checks/builds。

**Explicit out-of-scope:** PDF/LaTeX renderer、OMML、figures、institution/journal templates、background job。

**Dependencies:** WP1–WP5.

### WP7 — Product Integration & Acceptance

**Goal:** 覆盖完整用户流程、安全/性能/恢复证据并形成 P5 review candidate，不进入 Phase F。

**Scope:** scenarios A–D；cross-user/archived/storage errors；10k/50k/100k benchmark；full regression；governance candidate update only after all gates pass。

**Files/modules likely affected:**

- Create/extend `test/e2e/p5-manuscript-export.e2e-spec.ts`
- Create `test/integration/p5-manuscript-export.integration.spec.ts`
- Create `scripts/benchmark-p5-manuscript.ts`
- Update `package.json` test script, restore verification and CI expectations as required
- Update `PROJECT_STATE.md` only at authorized Review Candidate stage

**Interfaces:** verifies all public P5 contracts; introduces no new product behavior.

**Implementation steps:**

- [ ] Complete A–D and ownership/archive/missing-artifact HTTP E2E.
- [ ] Run structural DOCX and real PostgreSQL migration/backup/restore suites.
- [ ] Run 10k/50k/100k benchmark and record evidence without authorizing queue.
- [ ] Run all required commands and inspect diff for scope/frozen migration violations.
- [ ] Update Review Candidate governance evidence, commit `test(p5): complete manuscript export acceptance coverage`, then follow `CODEX_WORKFLOW.md` for push/PR only if separately authorized.

**Acceptance criteria:** all specified tests/gates pass；zero-upload and grounded flows produce truthful output；no P4 regression；benchmark evidence recorded；business scope matches this plan。

**Explicit out-of-scope:** any deferred feature below, merge/tag/deployment before formal acceptance.

**Dependencies:** WP1–WP6.

## 17. Explicit Deferred / Out of Scope

P5 MVP 明确不包含：

- PDF production export；LaTeX production export。
- institution thesis templates；journal-specific templates；Springer/Elsevier/IEEE presets；user template editor/marketplace/template DB。
- full academic quality review；claim-evidence completeness audit；terminology/variable conflict scanning；numeric contradiction scanning；cross-section methodology contradiction review。
- research/evidence workspace replacement；reviewer response workflow。
- Redis；BullMQ；Queue；worker；Phase F。
- one-click background whole-paper generation。
- complex OMML、automatic figures/numbering、cross-reference fields、advanced headers/footers/page numbering。
- Acknowledgements/Appendix 的特殊 persistence、special role、dedicated API 或 institution-specific formatting；若存在，只按普通 outline nodes 渲染。
- export retention scheduler、public share links、export mutation/deletion。

这些项目不能因“未来可能有用”进入任何 WP。

## 18. Expected File Touch Map

```text
shared/
  manuscript.interface.ts                         NEW
  paper-project.interface.ts                      MODIFY in WP3 (sectionRole/additive typed metadata)

server/modules/paper-project/manuscript/
  manuscript-snapshot.loader.ts                   NEW
  manuscript-tree-assembler.ts                    NEW
  manuscript-fingerprint.ts                       NEW
  manuscript-projection.service.ts                NEW
  derived-content.service.ts                      NEW
  whole-manuscript-generation-context.builder.ts  NEW

server/modules/paper-project/export/
  manuscript-renderer.ts                          NEW
  docx-manuscript.renderer.ts                     NEW
  generic-academic-v1.template.ts                 NEW
  markdown-block-parser.ts                        NEW
  paper-export.repository.ts                      NEW
  paper-export.service.ts                         NEW

server/modules/storage/                           NEW shared storage capability
server/modules/document-input/*storage*            MINIMAL REFACTOR + REGRESSION TESTS
server/modules/grounded-generation/citation/*      ADDITIVE placement/normalizer extension
server/modules/paper-project/*                     controller/repository/module/error wiring
server/database/schema.ts                          MODIFY after authorization
server/database/local-development.database.ts      MODIFY after authorization
drizzle/migrations/0006_p5_section_roles.sql       NEW in WP3 after authorization
drizzle/migrations/0007_p5_paper_exports.sql       NEW in WP5 after authorization
scripts/db-restore-verify.js                       MODIFY 6/19 in WP3, 7/20 in WP5

client/src/pages/Papers/ManuscriptPage.tsx         NEW
client/src/lib/manuscript.ts                       NEW
client/src/api/paper-projects.ts                   MODIFY
client/src/app.tsx                                 MODIFY
client/src/pages/Papers/PaperWorkspacePage.tsx     LINK-ONLY MINIMAL MODIFY

test/unit/*p5*                                     NEW/MODIFY
test/integration/p5-*                              NEW
test/e2e/p5-*                                      NEW
package.json + package-lock.json                   docx/jszip dependency + test script after authorization
```

## 19. Plan Self-Review / Authorization Boundary

### Coverage check

- Executive summary, current-state audit, domain invariants, runtime/persisted model、database、assembly、citation、derived content、preview、export、storage、API、tests、benchmark、security 与 WP decomposition 已覆盖。
- Controller 指定的 A–D E2E、consistent snapshot concurrency、bounded/fair LLM context、Conclusion basis lifecycle、P4 role compatibility、DOCX static TOC/fonts/createdAt、ZIP/XML tests、10k/50k/100k benchmark 与所有 deferred items 已绑定到具体 WP。
- WP1 不引用 persisted `section_role`；WP3 原子引入 0006 + shared/repository/P4 compatibility，WP5 原子引入 0007；每个 WP 可独立 type-check/build/test，不依赖后续 WP 才能编译。

### OPEN_DECISIONS

`OPEN_DECISIONS: NONE`

当前代码差异均可由 additive/minimal extension 解决：Drizzle node-postgres adapter 支持 `PgTransactionConfig` 的 repeatable-read/read-only contract；legacy citation 由 fail-closed compatibility 处理；storage path mismatch 由共用底层 port + namespace-specific validator 处理；current revision 隐式 `[0]` 不用于 P5 assembly。

### Gate

```text
P5_PLAN_REVISION_READY_FOR_CONTROLLER_REVIEW
PHASE_P5_IMPLEMENTATION_AUTHORIZED = NO
BUSINESS_CODE_CHANGED = NO
MIGRATION_CREATED = NO
DEPENDENCY_CHANGED = NO
IMPLEMENTATION_BRANCH_CREATED = NO
```

Controller 应先审查 canonical/derived 边界、citation legacy policy、draft/clean export policy、storage extraction 与 WP 顺序。只有明确授权后，实施者才按 `CODEX_WORKFLOW.md` 从 accepted main 创建 P5 Phase branch，并从 WP1 开始；不得提前进入 WP2–WP7 或 Phase F。
