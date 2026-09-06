# Phase E5 Academic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 E1/E2/E3/E4/D4 行为的前提下，实现无持久化、需登录、基于 OpenAlex 的外部学术发现接口，输出独立的 AcademicDiscoverySet。

**Architecture:** 新增隔离模块 server/modules/academic-search/。AcademicSearchService 负责请求校验、queryFingerprint 计算和平台 opaque cursor 校验，并委托 ACADEMIC_SEARCH_PROVIDER；OpenAlexProvider 调用注入式 OpenAlexClient，完成字段归一化、DOI 归一化、保守去重和 provenance 组装。OpenAlex cursor 只在 provider/client 内部出现。模块只接入 AppModule，不得依赖 knowledge/retrieval/Zotero/数据库。

**Tech Stack:** NestJS 10、TypeScript 5.9、原生 fetch/AbortController、Jest/ts-jest、现有 @NeedLogin 鉴权机制和注入式 fake。

**Spec:** 以用户已批准的 Phase E5 Design Freeze 及本次 ChatGPT Plan Review 修复项为唯一功能规格。仓库当前没有独立的 E5 design spec 文件。

## Global Constraints

- 仅实现 OpenAlex；不引入 Crossref、Semantic Scholar 或其他 provider。
- AcademicDiscoverySet != EvidenceSet；AcademicSearchResult != SourceRecord。
- 不做任何 persistence、schema 变更或 migration；不创建 SourceRecord，不自动导入 Zotero/knowledge。
- 不修改 E2 embedding/index、E3 retrieval/EvidenceSet、E4 Zotero、D4 TextGenerationProvider、legacy literature.generator.ts。
- 不做 generation/citation、reranking、Redis/BullMQ、frontend overhaul、deployment/auth repair。
- API key 只从服务端配置读取，使用 Authorization Bearer header；不得出现在 URL、日志、响应或错误消息中。
- 外部 REST contract 固定为 POST /api/academic-search/search。
- API 暴露平台 opaque AcademicSearchCursor；不得直接暴露 OpenAlex cursor。cursor 必须绑定并校验不含 cursor 的规范化 queryFingerprint。
- 每次请求最多向 OpenAlex 请求一个 bounded page；默认/最大 per_page 明确固定在不超过 100。
- 所有外部调用测试必须使用 fake fetch/client；测试不得依赖网络。
- 所有 provider/client/service/controller 错误都必须映射为以下稳定错误码：ACADEMIC_SEARCH_INVALID_QUERY、ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE、ACADEMIC_SEARCH_TIMEOUT、ACADEMIC_SEARCH_RATE_LIMITED、ACADEMIC_SEARCH_INVALID_RESPONSE、ACADEMIC_SEARCH_CURSOR_INVALID。
- HTTP 响应不得泄漏 stack、cause、上游原始 body 或密钥。
- dedup 只允许 normalized DOI exact、same provider + externalRecordId exact、或 strong normalized title + year + first-author fingerprint；不得使用 fuzzy、LLM 或 embedding dedup。

## Repository baseline and conflict conclusion

- GitHub origin/main 当前为 44765c777addc7e65b9da0a616ea2b709ce81bf7。
- GitHub phase-e4-accepted 当前存在，且解析到 44765c777addc7e65b9da0a616ea2b709ce81bf7；因此 E5 可以在 E4 accepted 代码基线上规划。
- PROJECT_STATE.md、E4 Final Acceptance Report 仍记录“accepted tag pending”，与远端实际 tag 状态存在文档漂移；本计划不修正文档漂移。
- PROJECT_STATE.md 底部仍有“Next Phase E3”的历史段落，与顶部 E5 未授权状态不一致；本计划不修正历史文档。
- E1/E3/E4 现有边界与 E5 设计没有架构冲突：E1 的 SourceRecord、E3 的 EvidenceSet、E4 的 Zotero import 均可保持不变。
- 当前仓库没有通用 academic-search 模块或 OpenAlex 客户端，也没有 E5 数据库迁移。

OpenAlex 的实现约束依据官方文档：REST API 支持可选 API key/Bearer header，per_page 上限为 100，cursor 分页通过 meta.next_cursor 继续；429 可能表示限流或预算限制，应采用退避。参见 [OpenAlex authentication](https://help.openalex.org/api/authentication/)、[paging](https://help.openalex.org/api/paging/) 和 [filtering/searching](https://help.openalex.org/api/filtering/)。

## Proposed file map

### 新增模块文件

- server/modules/academic-search/academic-search.types.ts：查询、请求、结果、发现集、opaque cursor 和 provenance 的公开领域契约。
- server/modules/academic-search/academic-search.errors.ts：六个稳定错误码和领域异常。
- server/modules/academic-search/academic-search.config.ts：OpenAlex base URL、超时、重试、page-size、cursor secret 及可选 API key 配置。
- server/modules/academic-search/academic-search.provider.ts：AcademicSearchProvider 接口和 ACADEMIC_SEARCH_PROVIDER token。
- server/modules/academic-search/academic-search.cursor.ts：无状态、签名的 AcademicSearchCursor 编解码；只向 service 暴露 queryFingerprint 校验，providerCursor 解包逻辑保持模块内部。
- server/modules/academic-search/openalex.types.ts：最小 OpenAlex response DTO，不把上游 DTO 暴露给 controller。
- server/modules/academic-search/openalex.client.ts：OpenAlex REST transport、AbortController timeout、bounded retry/backoff、Retry-After 解析。
- server/modules/academic-search/academic-search.normalization.ts：字段映射、摘要重建、DOI 归一化、保守去重。
- server/modules/academic-search/openalex.provider.ts：OpenAlex DTO 到 AcademicSearchResult/AcademicDiscoverySet 的 provider 实现，并在内部处理 OpenAlex cursor。
- server/modules/academic-search/academic-search.service.ts：请求映射、查询校验、fingerprint/cursor 校验与 provider 委托。
- server/modules/academic-search/academic-search.controller.ts：authenticated REST transport。
- server/modules/academic-search/academic-search.exception-filter.ts：领域错误到 HTTP 400/429/502/504 的映射。
- server/modules/academic-search/academic-search.module.ts：模块 wiring；只导出 provider token/service。

### 新增测试文件

- server/modules/academic-search/academic-search.config.spec.ts
- server/modules/academic-search/academic-search.cursor.spec.ts
- server/modules/academic-search/academic-search.normalization.spec.ts
- server/modules/academic-search/openalex.client.spec.ts
- server/modules/academic-search/openalex.provider.spec.ts
- server/modules/academic-search/academic-search.service.spec.ts
- server/modules/academic-search/academic-search.controller.spec.ts
- server/modules/academic-search/academic-search.http.spec.ts
- server/modules/academic-search/academic-search.module.spec.ts
- test/unit/academic-search-frozen-boundary.spec.ts

### 允许修改的既有文件

- server/app.module.ts：仅增加 AcademicSearchModule import/wiring。
- PROJECT_STATE.md：仅在实现达到 Review Candidate 后记录 E5 candidate 事实与验证证据；不在本计划阶段修改。

### 明确禁止修改

ROADMAP.md、CODEX_WORKFLOW.md、E4 Final Acceptance Report、数据库 schema/migrations、E1 knowledge contracts/repository、E3 retrieval/EvidenceSet、E4 Zotero 模块、D4 provider、legacy literature generator、前端和部署/auth 修复文件。

## Frozen interfaces

以下契约在实现前冻结；如需改变，必须停止并取得上游审查者明确批准：

~~~ts
export type AcademicSearchCursor = string & {
  readonly __brand: 'AcademicSearchCursor';
};

export interface AcademicSearchRequest {
  q: string;
  fromPublicationDate?: string;
  toPublicationDate?: string;
  publicationYear?: number;
  workType?: string;
  isOpenAccess?: boolean;
  pageSize?: number;
  cursor?: AcademicSearchCursor;
}

export interface AcademicSearchQuery {
  text: string;
  filters?: {
    fromPublicationDate?: string;
    toPublicationDate?: string;
    publicationYear?: number;
    workType?: string;
    isOpenAccess?: boolean;
  };
  pageSize?: number;
  cursor?: AcademicSearchCursor;
}

export interface AcademicSearchResult {
  provider: 'openalex';
  externalRecordId: string;
  title: string;
  authors: Array<{
    name: string;
    orcid?: string;
    externalId?: string;
  }>;
  publicationDate?: string;
  publicationYear?: number;
  venue?: string;
  doi?: string;
  abstract?: string;
  workType?: string;
  citedByCount?: number;
  isOpenAccess?: boolean;
  landingPageUrl?: string;
  pdfUrl?: string;
  provenance: {
    provider: 'openalex';
    externalRecordId: string;
    canonicalUrl: string;
    retrievedAt: string;
    providerRank: number;
    queryFingerprint: string;
    verificationStatus: 'observed';
  };
}

export interface AcademicDiscoverySet {
  provider: 'openalex';
  status: 'complete' | 'partial' | 'empty';
  items: AcademicSearchResult[];
  totalCount?: number;
  nextCursor?: AcademicSearchCursor;
  diagnostics: Array<{
    code: 'invalid-result-skipped' | 'duplicate-result-removed';
    externalRecordId?: string;
  }>;
  provenance: {
    provider: 'openalex';
    queryFingerprint: string;
    retrievedAt: string;
  };
}

export const ACADEMIC_SEARCH_PROVIDER = Symbol('ACADEMIC_SEARCH_PROVIDER');

export interface AcademicSearchProvider {
  search(input: {
    query: AcademicSearchQuery;
    queryFingerprint: string;
  }): Promise<AcademicDiscoverySet>;
}
~~~

Cursor contract：

- AcademicSearchCursor 是平台对外唯一 cursor 类型；controller/request/response 只处理 opaque string，不出现 OpenAlex cursor、next_cursor 或 providerCursor 字段。
- academic-search.cursor.ts 使用无状态签名 token，至少绑定 provider=openalex、版本、queryFingerprint、内部 provider cursor；签名材料来自服务端 cursor secret。
- service 只调用 codec.validate(cursor, expectedQueryFingerprint)，验证 token 完整性、provider、版本、过期策略和 queryFingerprint exact match；失败统一抛出 ACADEMIC_SEARCH_CURSOR_INVALID。
- OpenAlexProvider 在 provider/client 内部调用 codec.decodeProviderCursor(cursor, expectedQueryFingerprint) 和 codec.encodeProviderCursor(providerCursor, queryFingerprint)；原始 OpenAlex cursor 不得从 provider/client 层泄漏到 controller、AcademicDiscoverySet 或日志。
- cursor 不参与 queryFingerprint 计算，因此同一规范化查询产生的 cursor 只能用于该查询；改变任一搜索字段后复用 cursor 必须失败。

REST contract：

- POST /api/academic-search/search。
- JSON body 为 AcademicSearchRequest；q 映射到 AcademicSearchQuery.text，其余字段映射为 filters/pageSize/cursor。
- 客户端不能指定 provider；provider 固定由服务端 module wiring 选择。
- req.userContext.userId 必须存在；controller 使用现有 @NeedLogin。
- 未知 body 字段、空文本、日期格式/顺序、年份、布尔值、page size、cursor 违反规则时，在调用 provider 前返回 400。
- 成功响应直接是领域 AcademicDiscoverySet；不返回 OpenAlex raw DTO，也不返回 OpenAlex cursor。
- 错误响应只包含稳定 status/code/message/request-safe details，不包含 stack/cause/raw upstream body/API key。

稳定错误码：

- ACADEMIC_SEARCH_INVALID_QUERY
- ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE
- ACADEMIC_SEARCH_TIMEOUT
- ACADEMIC_SEARCH_RATE_LIMITED
- ACADEMIC_SEARCH_INVALID_RESPONSE
- ACADEMIC_SEARCH_CURSOR_INVALID

建议 HTTP 映射：

- INVALID_QUERY、CURSOR_INVALID -> 400
- RATE_LIMITED -> 429
- TIMEOUT -> 504
- PROVIDER_UNAVAILABLE、INVALID_RESPONSE -> 502

## Work packages and TDD order

### WP1 — Contract/config/error seam

**Files:**

- Create: server/modules/academic-search/academic-search.types.ts
- Create: server/modules/academic-search/academic-search.errors.ts
- Create: server/modules/academic-search/academic-search.config.ts
- Create: server/modules/academic-search/academic-search.provider.ts
- Test: server/modules/academic-search/academic-search.config.spec.ts

**Interfaces:**

- Produces AcademicSearchRequest, AcademicSearchQuery, AcademicSearchCursor, AcademicSearchResult, AcademicDiscoverySet, AcademicSearchProvider and ACADEMIC_SEARCH_PROVIDER.
- Produces exactly the six frozen error codes.
- Config includes OpenAlex endpoint, timeout/retry/backoff/page-size bounds, optional OPENALEX_API_KEY and required cursor signing secret.

TDD：

1. 先写失败测试：默认 OpenAlex base URL、timeout/retry/backoff/page-size 有界；环境变量能覆盖允许项；API key 可选且不能被序列化到 URL；cursor secret 不进入公开响应；六个错误码稳定；provider token 可被替换。
2. 实现最小配置解析、领域错误和公开契约。
3. 运行：npx jest server/modules/academic-search/academic-search.config.spec.ts --runInBand。

### WP2 — Opaque cursor codec

**Files:**

- Create: server/modules/academic-search/academic-search.cursor.ts
- Test: server/modules/academic-search/academic-search.cursor.spec.ts

**Interfaces:**

- Consumes AcademicSearchCursor、cursor secret 和 expected queryFingerprint。
- Produces validate(cursor, expectedQueryFingerprint): void，以及仅供 OpenAlexProvider 使用的 decodeProviderCursor/encodeProviderCursor。
- Provider cursor 不得成为 AcademicSearchProvider 的公开输出字段。

TDD：

1. 先写失败测试：合法 token 可验证；篡改签名、错误 provider、错误版本、过期 token、错误 queryFingerprint、空 token、非法编码均返回 ACADEMIC_SEARCH_CURSOR_INVALID。
2. 测试 token payload 不含用户可依赖的公开 provider contract；service 只得到通过/失败，不得到 raw provider cursor。
3. 实现无状态签名 codec；使用 constant-time signature comparison；不引入数据库、缓存或持久化。
4. 运行：npx jest server/modules/academic-search/academic-search.cursor.spec.ts --runInBand。

### WP3 — Pure normalization, DOI and conservative dedup

**Files:**

- Create: server/modules/academic-search/academic-search.normalization.ts
- Test: server/modules/academic-search/academic-search.normalization.spec.ts

**Interfaces:**

- Produces normalizeDoi、rebuildOpenAlexAbstract、normalizeOpenAlexWork、deduplicateAcademicResults。
- normalizeOpenAlexWork 接收 raw OpenAlex work、providerRank、queryFingerprint、retrievedAt，输出带完整 discovery provenance 的 AcademicSearchResult 或 invalid。
- deduplicateAcademicResults 只使用以下 exact/strong keys：normalized DOI exact；provider + externalRecordId exact；strong normalized title + year + first-author fingerprint。

TDD：

1. 先写失败测试覆盖 OpenAlex work id/title/authors/date/year/venue/type/citations/open-access/landing-page/PDF 的最小映射。
2. 测试每个结果 provenance 均含 provider、externalRecordId、canonicalUrl、retrievedAt、providerRank、queryFingerprint 和 verificationStatus='observed'。
3. 测试 inverted-index abstract 重建：缺失片段安全返回 undefined；不因字段异常抛出未处理异常。
4. 测试 DOI 归一化：去除 doi:、https://doi.org/、http://dx.doi.org/ 前缀，转小写，去除末尾标点，并拒绝明显非法值。
5. 测试 dedup：
   - 相同 normalized DOI exact 时合并；
   - 相同 provider + externalRecordId exact 时合并；
   - title 使用 Unicode NFKC、大小写折叠、标点/空白规范化后，且 year exact、first-author fingerprint exact 时合并；
   - 任何一个 strong key 缺失时不按 title 合并；
   - 只同 title、只同作者、模糊相似的值均不得合并；
   - 不使用 fuzzy、LLM、embedding；
   - 保留稳定顺序和第一条有效记录。
6. 实现纯函数。
7. 运行：npx jest server/modules/academic-search/academic-search.normalization.spec.ts --runInBand。

DOI 规则固定为：去前缀/小写/尾部标点后，满足保守正则 ^10\.\d{4,9}/\S+$ 才接受；normalized DOI exact 可独立作为 dedup key，但不得将缺失/非法 DOI 视为相同。

### WP4 — OpenAlex DTO and transport client

**Files:**

- Create: server/modules/academic-search/openalex.types.ts
- Create: server/modules/academic-search/openalex.client.ts
- Test: server/modules/academic-search/openalex.client.spec.ts

**Interfaces:**

- OpenAlexClient.searchWorks(input: { text; filters; pageSize; providerCursor?: string }): Promise<OpenAlexPage>。
- OpenAlexPage 只在 openalex.types.ts/client/provider 内部存在，包含 meta.count、meta.next_cursor 和 raw results。
- client 不接受或返回 AcademicSearchCursor；它只处理 providerCursor string。

TDD：

1. 先写 fake-fetch 测试：正确生成 /works?search=...、filter、page-size、固定 select 字段；不把 key 放进 URL；可选 Bearer header。
2. 测试 OpenAlex cursor 只从 provider 内部传入 client，controller/http response 中不存在 next_cursor/providerCursor。
3. 测试 AbortController deadline/timeout，验证 timeout 映射为 ACADEMIC_SEARCH_TIMEOUT。
4. 测试 429/503 的有限重试；优先使用有限、可验证的 numeric Retry-After，否则使用 bounded exponential backoff；总耗时受 shared deadline 限制。
5. 测试最终 429 映射 ACADEMIC_SEARCH_RATE_LIMITED，其他连接/5xx 失败映射 ACADEMIC_SEARCH_PROVIDER_UNAVAILABLE。
6. 测试 malformed JSON、缺少 results 或错误字段类型映射 ACADEMIC_SEARCH_INVALID_RESPONSE。
7. 实现 searchWorks；client 每次最多请求一个 page，不负责领域去重、不生成平台 cursor。
8. 运行：npx jest server/modules/academic-search/openalex.client.spec.ts --runInBand。

Client 必须保证 per_page 不超过 100；OpenAlex 的 next_cursor 只作为内部 continuation，不能被响应序列化。

### WP5 — Provider and service

**Files:**

- Create: server/modules/academic-search/openalex.provider.ts
- Create: server/modules/academic-search/academic-search.service.ts
- Test: server/modules/academic-search/openalex.provider.spec.ts
- Test: server/modules/academic-search/academic-search.service.spec.ts

**Interfaces:**

- AcademicSearchService.search(request: AcademicSearchRequest, userId: string): Promise<AcademicDiscoverySet>。
- OpenAlexProvider.search(input: { query: AcademicSearchQuery; queryFingerprint: string }): Promise<AcademicDiscoverySet>。
- Provider 内部：验证 opaque cursor 后解出 providerCursor，调用 OpenAlexClient，再将内部 next_cursor 编码成 AcademicSearchCursor。
- Provider 输出只含 AcademicSearchResult/AcademicDiscoverySet；不得输出 OpenAlexPage。

TDD：

1. 先写 provider 测试：client fake 返回 raw page 时，输出只含冻结的 AcademicSearchResult 字段、完整 provenance、normalized DOI、providerRank、稳定顺序和 diagnostics。
2. 测试 provider 对首条结果 rank=1，按 OpenAlex 返回顺序递增；queryFingerprint 和 retrievedAt 传入所有 result provenance 与 discovery provenance。
3. 测试无效 raw item 被跳过并产生 invalid-result-skipped；重复 item 产生 duplicate-result-removed；状态分别为 empty/partial/complete。
4. 测试 provider 将 OpenAlex next_cursor 编码为 opaque AcademicSearchCursor；响应中不能出现 raw cursor；改变 queryFingerprint 后该 cursor 不能继续使用。
5. 测试 service 在 provider 调用前拒绝：trim 后空 q、超过 512 个 Unicode code points、非法日期/日期逆序、年份不在 1000–9999、非法 boolean、page size 不在 1–100、空/格式错误/被篡改/绑定其他 queryFingerprint 的 cursor、未知 body 字段。
6. 测试 service 只依赖 AcademicSearchProvider 和 cursor codec，不导入或构造 SourceRecord/EvidenceSet。
7. 实现请求映射、校验、queryFingerprint、cursor 校验、provider 委托和 response assembly；queryFingerprint 只使用规范化搜索字段，不包含 cursor、userId 或密钥。
8. 运行：
   - npx jest server/modules/academic-search/openalex.provider.spec.ts --runInBand
   - npx jest server/modules/academic-search/academic-search.service.spec.ts --runInBand

### WP6 — Authenticated REST transport and exception mapping

**Files:**

- Create: server/modules/academic-search/academic-search.controller.ts
- Create: server/modules/academic-search/academic-search.exception-filter.ts
- Test: server/modules/academic-search/academic-search.controller.spec.ts
- Test: server/modules/academic-search/academic-search.http.spec.ts

**Interfaces:**

- Controller route fixed as POST /api/academic-search/search.
- Controller accepts JSON AcademicSearchRequest and authenticated req.userContext.userId.
- Controller calls AcademicSearchService.search(request, userId) and returns AcademicDiscoverySet.
- Filter maps the six stable error codes to the frozen HTTP status mapping without exposing implementation details.

TDD：

1. 先写 controller unit test：POST route 与 @NeedLogin 存在；body 参数映射精确；authenticated user context 被要求；成功响应不含 raw provider DTO/OpenAlex cursor。
2. 写 transport test：valid request 为 200；invalid query/cursor 为 400；rate limit 为 429；timeout 为 504；provider unavailable/invalid response 为 502；错误体无 stack/cause/raw body/API key。
3. 测试未知 body 字段和其他 HTTP method 不成为 E5 contract。
4. 实现 controller 和 typed exception filter。
5. 运行：
   - npx jest server/modules/academic-search/academic-search.controller.spec.ts --runInBand
   - npx jest server/modules/academic-search/academic-search.http.spec.ts --runInBand

### WP7 — Module wiring and frozen-boundary tests

**Files:**

- Create: server/modules/academic-search/academic-search.module.ts
- Modify: server/app.module.ts
- Test: server/modules/academic-search/academic-search.module.spec.ts
- Test: test/unit/academic-search-frozen-boundary.spec.ts

**Interfaces:**

- Module providers：config、AcademicSearchCursorCodec、OpenAlexClient、OpenAlexProvider、ACADEMIC_SEARCH_PROVIDER、AcademicSearchService、controller。
- Module exports：仅 ACADEMIC_SEARCH_PROVIDER 和 AcademicSearchService（除非现有 Nest wiring 需要最小等价调整）。
- AppModule 只增加 AcademicSearchModule import/wiring。

TDD：

1. 先写 module test：provider token、OpenAlex client、cursor codec、service、controller、config 的 wiring 正确；module exports 只暴露约定 seam。
2. 写静态 frozen-boundary test：E5 模块不得 import knowledge/retrieval/Zotero/AI/DB/migrations；不得出现 SourceRecord/EvidenceSet 作为 E5 domain output；不得新增 migration 或 persistence adapter；不得出现 OpenAlex cursor 在 controller/http DTO。
3. 实现模块和 AppModule 单一接入点。
4. 运行：
   - npx jest server/modules/academic-search/academic-search.module.spec.ts --runInBand
   - npx jest test/unit/academic-search-frozen-boundary.spec.ts --runInBand

### WP8 — Candidate verification and PR preparation

仅在实施获得明确授权后执行：

1. 先保存当前工作树状态，确认只包含授权文件；禁止顺手修复既有文档漂移或其他基线问题。
2. 运行本计划的 targeted、full、build、lint、typecheck、bootstrap 验证命令。
3. 检查 git diff --check、变更文件清单、无密钥/无真实网络测试、无 migration、无 OpenAlex cursor 泄漏。
4. 根据 .github/PULL_REQUEST_TEMPLATE.md 准备 PR：明确 Phase E5、实现范围、测试证据、frozen contracts、known issues、review scope 和 out-of-scope。
5. Review Candidate 只表示实现完成且等待审查；不得在未得到 PHASE_E5_ACCEPTED 前 merge main、创建 accepted tag 或开始 E6。

## Test matrix

- Unit：config/error parsing、cursor codec/queryFingerprint、query validation、DOI、abstract、normalization、dedup、provenance、providerRank、status。
- Service：provider seam delegation、single-page bounded pagination、opaque cursor propagation、cursor binding/validation、no SourceRecord/EvidenceSet。
- Transport：auth guard、POST body mapping、stable success/error shape、typed status mapping、secret/raw cursor redaction。
- Client transport：fake fetch、headers/URL、timeout、retry/backoff、Retry-After、429/503、malformed response。
- Module/bootstrap：provider token wiring、AppModule bootstrap、no forbidden imports。
- Frozen boundary：无 schema/migration/persistence；不修改 E1/E2/E3/E4/D4/legacy files。
- Full regression：E1–E4 既有测试必须保持通过；任何预存失败要单独记录，不得归因给 E5。

## Final verification commands

在得到实现授权并完成代码后，使用仓库真实 npm/npx scripts；不绑定 multiview-xray Conda 环境。按以下顺序执行：

~~~powershell
npx jest server/modules/academic-search --runInBand
npx jest test/unit/academic-search-frozen-boundary.spec.ts --runInBand
npm test -- --runInBand
npm run test:integration:postgres
npm run lint
npm run type:check
npm run build:server
npm run build:client
npm run test:app-bootstrap
git diff --check
git status --short
git diff --name-only
~~~

若 package.json 的实际 script 名称与上述命令不一致，先读取 package.json 并使用仓库已有的等价 npm/npx script；不得新增 script，不得为了 E5 新增数据库 integration fixture 或迁移。所有命令都应在仓库默认 Node/npm 环境中执行，不添加 Conda 前缀。

## Branch / PR / Review Candidate preparation

本计划阶段不创建 branch。获得明确实施授权后：

~~~powershell
git switch main
git pull --ff-only origin main
git switch -c phase/e5-academic-search
~~~

实施阶段每次 push 前必须核对：

~~~powershell
git remote -v
git config --local --get http.version
git ls-remote origin refs/heads/main
~~~

http.version 必须为 HTTP/1.1；禁止 force push。PR 描述必须使用仓库模板并包含：

- Phase：E5
- Goal / Implemented：OpenAlex external scholarly discovery
- Changed scope：只列新增 E5 模块和必要 AppModule wiring
- Tests：逐条贴出实际 npm/npx 命令与结果
- Frozen contracts：列出 AcademicDiscoverySet、AcademicSearchResult、AcademicSearchCursor、provider token、POST route、错误码
- Known issues：只记录真实、可复现、非阻断事项
- Review scope：provider/client/normalization/cursor/service/transport/boundary
- Explicitly out of scope：SourceRecord import、EvidenceSet、generation/citation、其他 providers、persistence、frontend、queue、auth repair
- Merge gate：等待正式 PHASE_E5_ACCEPTED，不得自行 merge/tag。

## Stop conditions

出现以下任一情况应停止并报告，而不是改变设计：

- GitHub main 或 phase-e4-accepted 与本基线不一致，或 accepted tag 指向非预期 commit。
- 实现被迫引入 persistence、migration、SourceRecord import、EvidenceSet 适配或修改 frozen E1–E4/D4/legacy 行为。
- 测试需要真实 OpenAlex 网络、暴露 API key、绕过 @NeedLogin、返回 raw upstream body 或暴露 OpenAlex cursor。
- cursor 无法绑定 queryFingerprint，或 bounded page/retry/deadline 无法证明。
- full regression 暴露新增失败，且无法证明是预存失败。
- 需要修改本计划列出的禁止文件或改变冻结接口。

## Acceptance gate

Review Candidate 必须同时满足：

- E5 targeted tests、cursor/boundary tests、full regression、lint、typecheck、server/client build、bootstrap 均有命令和结果记录。
- 所有 OpenAlex 测试均为 deterministic fake，不依赖外部网络。
- 只新增/修改授权文件；无数据库变更、无 SourceRecord 写入、无 EvidenceSet 输出。
- POST /api/academic-search/search、opaque AcademicSearchCursor、queryFingerprint binding、六个错误码和 HTTP 映射均有测试覆盖。
- 每个 discovery result 的 provenance 均包含 provider、externalRecordId、canonicalUrl、retrievedAt、providerRank、queryFingerprint、verificationStatus='observed'。
- dedup 仅使用 normalized DOI exact、provider + externalRecordId exact、strong normalized title + year + first-author fingerprint；无 fuzzy/LLM/embedding。
- 错误脱敏、分页/重试/超时行为均有测试覆盖。
- PR 按仓库模板准备，等待审查者决定；本计划不授予 merge、tag 或 E6 权限。

**Final status:** PHASE_E5_PLAN_REVIEW_CANDIDATE
