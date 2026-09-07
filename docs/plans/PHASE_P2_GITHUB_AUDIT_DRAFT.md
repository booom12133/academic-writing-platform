# P2 GitHub 技术审计草案

> 审计状态：仅完成技术审计，不构成 P2 架构批准或实现授权。
> 审计范围：P1 accepted baseline 之上的产品集成、前端 UX、端到端连线和后端能力可用性。
> 本轮约束：不修改业务代码、测试、CI；不创建 P2 分支；不 commit、push 或创建 PR。

## 1. Accepted Baseline

### 1.1 仓库与实际 Git 状态

| 项目 | 审计结果 |
|---|---|
| Repository | `booom12133/academic-writing-platform` |
| 本地工作区 | `D:\学术写作辅助平台` |
| 当前分支 | `main` |
| `origin/main` | `862b0548943fb09913c524b5d0178151524bf946` |
| `phase-p1-accepted` | 已存在的 annotated tag，peeled commit 为 `862b0548943fb09913c524b5d0178151524bf946` |
| `origin` | `https://github.com/booom12133/academic-writing-platform.git` |
| `http.version` | `HTTP/1.1`，符合项目网络规则 |
| 审计开始时工作区 | clean |

本报告以已 fetch 的 `origin/main` 与 `phase-p1-accepted` 实际引用为代码基线。P1 接受报告中确认的范围包括：生产运行时配置与 fail-closed、独立认证适配、PostgreSQL/pgvector/readiness/migration、文件系统存储、外部 provider 配置、安全/CORS/body/rate/proxy、健康检查、关闭与失败处理、CI 和 artifact gates。

### 1.2 基线文档漂移

`PROJECT_STATE.md`、`ROADMAP.md` 以及 `docs/reviews/PHASE_P1_FINAL_ACCEPTANCE_REPORT.md` 的部分文字仍显示 P1 tag / final closeout 尚未完成，并保留 `P1_ACCEPTED_CLOSED=NO` 一类状态描述；但实际 Git refs 已显示 `phase-p1-accepted` 存在且指向 `origin/main` 的同一 commit `862b054...`。

这属于治理文档与仓库实际状态的漂移，本轮不修改这些文件，因为本轮唯一允许的工作区变化是本审计草案。该漂移应在 ChatGPT 的 P2 架构审查或正式 closeout 中单独处理。它不改变当前结论：P2 尚未获得实现授权。

### 1.3 P1 边界对 P2 的直接影响

P1 明确未交付 durable queue/worker、崩溃恢复、任务 replay、object storage、自动 cleanup、部署 rehearsal 和完整支付/灾备能力。因此本审计把“已有 HTTP API 能否形成产品闭环”和“必须先做基础设施才能可靠交付”分开，不把 P1 未承诺的能力默认算作 P2 前端工作。

## 2. Current Product Architecture

### 2.1 前端

- React + Vite + React Router 6，入口为 `client/src/index.tsx` 与 `client/src/app.tsx`。
- `Layout` 提供 Navbar、Footer、Toast 和主内容框架；工具页采用 240px 工具侧栏、主内容区和 280px helper 区。
- 工具配置集中在 `shared/api.interface.ts` 的 `TOOL_CONFIGS`，当前注册 23 个工具；Home、Tools 页和任务结果页均依赖这些类型/配置。
- API 包装集中在 `client/src/api/`，主要为 axios 直连；虽然依赖中有 `@tanstack/react-query`，当前主业务路径未形成统一 query/cache/auth store。
- 认证状态主要依赖 `localStorage.aw_user_token` 与请求期间获取的 profile，没有稳定的会话上下文、路由 guard 或统一用户缓存。
- 任务详情页承担了几乎所有 23 种结果的 renderer，形成一个约 2900 行的高耦合结果分发点；后端 `resultData` 与前端 renderer 之间没有共享的严格结果 schema。

### 2.2 后端

- NestJS 模块化架构，`server/app.module.ts` 注册 Users、Tasks、Points、Orders、AiTools、DocumentInput、Knowledge、Zotero、AcademicSearch、GroundedGeneration、Health 等模块。
- 运行时可切换 local memory、platform 和 standalone/PostgreSQL；独立认证使用 JWT/JWKS guard。
- 通用 AI 工具提交会创建任务、扣积分、标记 processing，然后以进程内 `setTimeout` 异步执行并写回 completed/failed；没有 durable queue/worker。
- Polish 与 Paper Revision 走专用的文档准备、解析、上下文构建、切块、LLM 执行和聚合管线；其他通用 generator 大量仍是模板/模拟实现。
- Knowledge、retrieval、evidence、citation、Zotero、academic search 和 grounded generation 已有后端能力，但除现有的 HTTP controller 外没有被当前前端产品入口接入。

### 2.3 主要架构断点

1. “用户登录”前端是 mock token，而 standalone 后端要求真实 Bearer JWT；axios client 也没有把 `aw_user_token` 注入 Authorization。
2. 工具 UI 的文件选择大多停留在浏览器 File state；真正上传到 `/api/document-inputs` 的只有 Polish 和 Paper Revision。
3. 通用 `/api/ai-tools/submit` 传输层已连线，但大量 generator 不消费文件内容，甚至使用随机或硬编码结果。
4. E4/E5/E6 后端模块与 API 没有前端 route、API wrapper、导航入口或结果展示。
5. 任务列表支持的 keyword、结果下载、修改重提、错误呈现和一致的 result contract 不完整。

## 3. Frontend Route / Page Inventory

### 3.1 路由清单

| Route | 页面/用途 | 当前状态 |
|---|---|---|
| `/` | `HomePage` | 展示 23 个工具入口、产品宣传和快捷入口 |
| `/tools` | `ToolsPage` | 默认工具列表/第一个工具，侧栏切换 |
| `/tools/:toolType` | `ToolsPage` + 对应 tool component | 23 种工具表单统一承载 |
| `/tasks` | `TasksPage` | 任务列表、状态/类型筛选、搜索输入、轮询 |
| `/tasks/:taskId` | `TaskDetailPage` | 任务状态、结果 renderer、失败/重提入口 |
| `/profile` | `ProfilePage` | Dashboard、MyTasks、Orders、PointRecords、Settings 为内部 state tabs，不是深链接 |
| `/recharge` | `RechargePage` | 充值套餐、QR 展示、模拟支付 |
| `/login` | `LoginPage` | UI 登录表单，但实际调用 ensureUser 后写入 mock token |
| `/register` | `RegisterPage` | 本地校验 + 延迟模拟注册，无 server registration call |
| `*` | `NotFound` | 兜底页 |

没有专门的 `/documents`、`/knowledge`、`/search`、`/zotero`、`/grounded-generation`、`/citations`、`/settings` 或结果下载 route。`CLIENT_BASE_PATH` 由 app 入口配置，整体使用 BrowserRouter。

### 3.2 工具页清单

当前 `TOOL_CONFIGS` 注册 23 个工具，按产品配置分为 writing/planning、efficiency 和 extended tools，实际组件位于 `client/src/pages/Tools/tools/`：

`outline`、`literature`、`literature-review`、`thesis`、`graduation-design`、`proposal`、`practice-report`、`journal-paper`、`course-paper`、`paper-reverse`、`ai-ppt`、`polish`、`format`、`check`、`ai-reduce`、`comment-revision`、`data-analysis`、`chart`、`questionnaire-design`、`interview-design`、`task-assignment`、`research-plan`、`paper-revision`。

这些工具都有 UI submit handler，但“有 submit handler”不等于已具备真实业务能力；具体见第 6、7 节。

## 4. Existing User Flows

### 4.1 主页到工具提交

用户可从 Home 或 Tools 侧栏选择工具，填写表单并提交。工具组件通常调用 `aiToolsApi.submitTask()`，成功后跳转 `/tasks/:id`；Polish 和 Paper Revision 调用专用 typed helper。积分扣除、任务创建和异步状态更新由后端处理。

这条路径在本地开发 profile middleware 下可以形成演示闭环，但对大多数工具而言，闭环的“结果”是模板或模拟数据，而不是基于用户上传材料的真实处理。

### 4.2 文本工具流

Topic generation、Polish text mode、Paper Revision text mode 等路径可以将文本/主题送入真实 LLM provider。Polish 与 Paper Revision 的文本模式不依赖文件上传；其任务完成后由 TaskDetail renderer 展示结果。

### 4.3 文档工具流

Polish 和 Paper Revision 是目前最完整的文档流：

1. 用户选择文件或输入文本。
2. 文件通过 multipart `POST /api/document-inputs` 上传并解析。
3. 前端取得 `DocumentInputRef`/descriptor。
4. 前端提交 typed AI task。
5. 后端执行 parser、context builder、chunker、LLM、aggregator。
6. 前端轮询任务并显示结果。

其他工具的 FileUploadZone 通常只保存浏览器 File，或者只把文件名、大小、数量发送给 server；未形成“文件字节/文档 ref → 处理管线”的闭环。

### 4.4 任务查看流

`TasksPage` 支持分页、状态/类型筛选、搜索输入和 active task 每 5 秒刷新；`TaskDetailPage` 对 pending/processing 每 3 秒刷新，并显示 completed、failed、loading 和空结果状态。

存在三个产品级缺口：keyword 参数未被后端消费；下载按钮没有 action/下载 API；“修改重提”把 inputData 放入 React Router state，但没有工具页消费该 state，因此不会真正预填表单。

### 4.5 账户、积分与充值流

Profile、余额、积分流水、任务/订单列表、套餐创建和订单状态接口均有部分前端接入。Recharge 页展示 QR 并允许点击“支付”后调用 pay API。

该流程当前是演示支付：订单 QR 使用 `picsum.photos`，pay API 由用户点击即标记 paid 并充值，没有真实支付 provider、webhook 或异步对账。

### 4.6 失败、空态与错误流

任务详情页有基础 failed/loading/empty rendering；任务列表和大多数工具表单的 catch 主要记录日志或忽略，API 校验失败、余额不足、上传失败和 provider failure 不能稳定地给用户可操作的反馈。部分空态因此可能把“请求失败”误呈现为“暂无任务/暂无结果”。

## 5. Backend Capability Inventory

| 模块 | HTTP capability | 业务能力 | 前端接入 |
|---|---|---|---|
| Users | `GET /api/users/profile`、`PATCH /api/users/profile`、`POST /api/users/ensure` | 用户资料、ensure 默认用户 | 部分；无真实登录/注册 |
| Tasks | `POST /api/tasks`、`GET /api/tasks`、`GET /api/tasks/stats/count`、`GET /api/tasks/:id`、`PATCH /api/tasks/:id/status`、`DELETE /api/tasks/:id` | 任务创建、列表、状态、删除、统计 | 已接入；keyword 未实现 |
| Points | `GET /api/points/records`、`GET /api/points/balance` | 余额和流水、任务扣积分 | 已接入 |
| Orders | `POST /api/orders`、`GET /api/orders`、`GET /api/orders/:id`、`POST /api/orders/:id/pay`、`POST /api/orders/:id/cancel` | 套餐订单、模拟支付、充值 | 已接入；支付为 mock |
| AI Tools | `POST /api/ai-tools/submit`、`GET /api/ai-tools/tools`、`GET /api/ai-tools/llm/health` | 通用工具提交、工具元数据、provider health | submit 已接入；tools/health 无 client callsite |
| Document Input | `POST /api/document-inputs` | multipart 上传、解析、文档 ref/context | 仅 Polish/Paper Revision |
| Academic Search | `POST /api/academic-search/search` | OpenAlex 搜索、cursor、provenance | 未接入 |
| Zotero | connection/health、items、item import/sync、attachment import | Zotero 连接与知识库导入 | 未接入 |
| Knowledge | 无 controller | source record、document import、tombstone、version | 无产品入口 |
| Retrieval/Evidence | 内部 service | 按 user/version/policy 检索并构建 evidence set | 无直接入口 |
| Grounded Generation | `POST /api/grounded-generation/generate` | 检索增强生成、claim binding、citation、bibliography、trace | 未接入 |
| Health | `/health/live`、`/health/ready`、`/health/providers` | 进程、依赖和 provider 健康检查 | 未接入产品 UX |

后端已有 capability 不自动等于已交付的用户功能；Knowledge/Retrieval 目前是内部基础能力，Grounded Generation 是独立的同步 HTTP 能力，尚未纳入任务与工作区体验。

## 6. Frontend ↔ Backend Wiring Matrix

| 用户能力 | 前端入口 | API/后端 | 连线结论 | 主要缺口 |
|---|---|---|---|---|
| 登录 | `/login` | 实际只调用 `/api/users/ensure` | 假连线 | 写入 `mock_token`；无真实认证、无 Authorization 注入 |
| 注册 | `/register` | 无注册 endpoint call | 未连线 | 仅本地校验和延迟 |
| 资料设置 | `/profile` Settings | profile GET/PATCH | 基本连线 | 密码修改仍为本地模拟；错误反馈弱 |
| 余额/流水 | Profile/Navbar | points GET | 基本连线 | 无统一缓存，Navbar mount 可能重复请求 |
| 充值 | `/recharge` | orders create/pay/cancel | 演示连线 | QR、支付确认、webhook 均为 mock |
| 通用工具提交 | `/tools/:toolType` | `POST /api/ai-tools/submit` | 传输连线，业务不完整 | 多数 generator 模板化，且不消费用户文件内容 |
| Polish 文本 | `/tools/polish` | prepared submit / LLM pipeline | 真实连线 | 需要统一错误、成本、结果 schema |
| Polish 文件 | `/tools/polish` | `/api/document-inputs` + typed submit | 目前最完整 | 仍缺文档库/历史 ref 选择与下载闭环 |
| Paper Revision 文本 | `/tools/paper-revision` | typed submit / LLM pipeline | 真实连线 | 同上 |
| Paper Revision 文件 | `/tools/paper-revision` | `/api/document-inputs` + typed submit | 目前最完整 | 同上 |
| 其他文件工具 | 多个 tool component | 通常只有 `/api/ai-tools/submit` | 表面连线 | 只传文件名/大小/count，未上传或传 ref |
| 任务列表/详情 | `/tasks`、`/tasks/:id` | tasks GET/GET/:id/DELETE | 基本连线 | keyword 后端忽略；无 cancel/retry/download contract |
| 任务重提 | TaskDetail | 路由 state | 断裂 | tool 页未读取 state，不能预填 |
| 学术搜索 | 无 route | `/api/academic-search/search` | 未连线 | 无搜索页、结果保存/导入/引用入口 |
| Zotero | 无 route | Zotero controllers | 未连线 | 无连接、选择、导入、同步 UX |
| 知识库/检索 | 无 route | Knowledge/Retrieval internal services | 未连线 | 无文档生命周期、索引状态、证据预览 |
| 有据生成 | 无 route | `/api/grounded-generation/generate` | 未连线 | 无输入编辑器、证据/引用展示、生成结果归档 |
| 文件下载 | TaskDetail buttons | 无 download API；format URL 为空 | 未连线 | 用户看见按钮但无法下载 |

### 6.1 已确认的前后端字段错配

- Check：UI 发送 `inputData.text`，`check.generator.ts` 读取 `input.content`；文本输入会被忽略，文件模式没有内容，因而可能回落到生成的 sample segments。
- AI Reduce：UI 使用 `inputMode: text/file`、`text`、`processType: ai-detection/similarity/both`；generator 期望 `upload/paste`、`textContent`、`reduce-ai/reduce-plagiarism/both`。核心输入和处理类型可能走默认分支。
- AI PPT：UI 使用 `keyPoints`、`scene`；generator 期望 `contentPoints`、`useCase`，关键用户输入未按预期消费。
- Literature：UI 使用 `major`；generator 期望 `field`，领域可能默认成“综合”。
- Format：UI 发送 `paperFileName`/`templateFileName` 等元数据，generator 期待 `paperFile`；同时生成器输出 `downloadUrl: ''`。

这些不是单纯 UX 文字问题，而是会造成用户输入被静默丢弃的契约风险，应在 P2 设计阶段先冻结 canonical input schema。

## 7. Mock / Placeholder / Dead Flow Audit

### 7.1 高风险 mock/placeholder

| 区域 | 证据 | 用户影响 | 建议归属 |
|---|---|---|---|
| Login | `localStorage.setItem('aw_user_token', 'mock_token')` | 看似登录，无法代表 standalone 真实认证 | P2 前置决策；实现可分 P2/P3 |
| Register | 注释“模拟注册成功”，无 API | 注册数据不会进入后端 | P2/P3，取决于认证方案 |
| SMS/code | 按钮 disabled | 无替代验证路径 | P2 或明确移除 |
| Password change | Settings 中本地延迟“模拟修改密码” | 用户以为密码已更新 | P2/P3 |
| Payment | `picsum.photos` QR；点击 pay 即充值 | 非真实支付，不能上线 | P4/商业化发布边界 |
| Generic generators | 多文件含 TODO/模拟逻辑/模板输出 | 结果不能证明来自用户输入或真实 AI | P2 需明确产品能力矩阵；真实实现多为后续 |
| Check/Data analysis/AI Reduce | random scores、demo data、默认 sample segments | 结果不稳定且不可审计 | 不应以真实功能宣传 |
| Format | `downloadUrl: ''`，结果为模拟 | 用户无法取回排版文件 | P2 下载链 + 后续真实排版能力 |
| FileUploadZone | 只保留 File，不上传 | 多个“上传”按钮没有业务效果 | P2 |
| TaskDetail download | 按钮无 handler/link | 死交互 | P2 |
| Resubmit | 只写 Router state，无消费端 | 修改重提不能预填 | P2 |
| Tasks keyword | client 发 keyword，server 忽略 | 搜索看似可用但实际无效 | P2 |

### 7.2 真实 LLM / 真实管线边界

已确认调用 `LlmService` 的非测试生产路径主要是 topic generation、Polish 和 Paper Revision；Grounded Generation 也具备真实 LLM + evidence/citation 管线，但没有前端入口。其余通用 generators 多数为模板、随机数、固定示例或占位逻辑。

这意味着当前产品不能把 23 个入口统一描述为 23 个已具备同等真实能力的 AI 工具。P2 必须把“UI 已存在”“API 可提交”“真实内容处理”“可导出结果”四种状态分开。

### 7.3 Dead/unwired flows

- `GET /api/ai-tools/tools` 有 wrapper 但无前端调用。
- Academic Search、Zotero、Grounded Generation、Knowledge、Retrieval、Evidence、Citation 在 client 中没有对应引用或 route。
- 独立认证 adapter/guard 存在，但 client 登录及 Authorization 链路未完成。
- 通用 `taskApi.createTask()` wrapper 存在，但未找到前端 callsite；实际由 AI submit 触发任务。
- 文件 bucket `uploadFile()` 仅被编辑器附件/图片扩展使用，不等于学术文档上传管线。

## 8. Missing Product Flows

按用户可以完成的闭环，当前缺少以下能力：

1. **真实身份闭环**：注册、登录、登出后的 token/session 生命周期、刷新/失效、路由保护、401 处理和 standalone OIDC/JWT 对齐。
2. **统一文档闭环**：上传进度、解析状态、错误原因、文档 ref、历史文档选择、版本和删除/tombstone；让所有需要文件的工具都消费同一个 ref。
3. **真实工具能力闭环**：每个工具明确输入来源、是否真实 LLM、是否文档感知、输出类型、积分成本和失败条件；不再用数量宣传掩盖模拟实现。
4. **任务闭环**：统一创建、排队/处理中、完成、失败、重试/重提、取消、幂等、余额不足、provider error、超时和可恢复反馈。
5. **结果闭环**：强类型 result schema、版本化 renderer、预览、文件生成、下载、来源/引用/证据展示和结果保存。
6. **任务检索闭环**：keyword 后端过滤或明确移除搜索 UI；分页、筛选、状态统计和失败请求要有稳定的错误态。
7. **知识库闭环**：文档/版本导入、解析/索引进度、可检索状态、来源元数据、用户隔离和删除语义。
8. **学术搜索闭环**：搜索、分页/cursor、provenance 展示、保存/导入知识库、引用到写作工具。
9. **Zotero 闭环**：连接、健康状态、item/attachment 选择、导入/同步、去重、失败重试和来源追踪。
10. **有据生成闭环**：从知识库/搜索/Zotero 选证据，生成内容，展示 claim-to-evidence/citation，保存为任务或文档，并支持导出。
11. **账户商业闭环**：真实订单状态、支付确认、退款/取消、积分流水与任务扣费的可解释性。
12. **一致 UX 闭环**：统一 loading、empty、error、success、toast、禁用条件、权限提示和可访问性；特别是不能把网络失败显示为空数据。

## 9. P2 Candidate Scope

P2 建议定义为“Product Integration / UX Completion”：优先把已有能力连成可验证用户旅程，并收紧契约与状态；不要在未批准前默认重写所有 generator 或扩张到支付/生产基础设施。

### 建议纳入 P2 的候选范围

- 建立真实 auth/session 适配的产品方案，并至少完成前端 API client 的 session/401/route guard 契约；若真实身份 provider 需要 P3 基础设施，应先做明确的 feature gate 和不可误导的本地模式。
- 为文档输入建立统一的上传/解析/ref 组件与 API wrapper；把工具能力矩阵标记为 `text`、`documentRef`、`metadata-only`，禁止 metadata-only 工具伪装成已处理文件。
- 冻结 canonical tool input/result schema，修复已确认的字段错配；建立前后端共享或可生成的 contract。
- 将 Tasks/TaskDetail 重构为可演进的状态、结果、下载、重提和错误模型；打通 keyword 语义或删除搜索入口。
- 接入已有 Academic Search、Zotero、Knowledge、Grounded Generation 后端，形成最小的搜索/导入/证据生成旅程。
- 增加统一的 loading/error/empty/success UX 和产品能力标识；对尚未真实实现的工具显示 beta/preview/disabled，而不是返回随机或固定结果。
- 为上述关键旅程补充前端 API contract、组件/集成和端到端验收测试设计；是否实现测试需待 P2 架构审查授权。

### 不应在本审计中默认纳入 P2

- 全量把 23 个 generator 改成生产级模型、查重引擎、排版引擎或真实数据分析服务。
- 引入 durable queue、跨节点 worker、crash replay、object storage、备份/灾备和部署 rehearsal。
- 接入真实支付 provider、资金对账、退款和商业合规流程。

这些事项应由 P3/P4 边界明确归属，或由 ChatGPT 在 P2 架构审查中显式调整。

## 10. Proposed Work Packages

以下是供 ChatGPT 审查的候选工作包，不是实现计划授权。

### P2-WP1：产品能力矩阵与契约冻结

产出：每个 tool 的 input source、document requirement、真实处理状态、积分、result kind、downloadability、failure semantics；统一 DTO/result schema 和错误 envelope；修复并测试已确认字段错配。

依赖：ChatGPT 确认 23 工具中哪些继续作为 preview，哪些进入 P2 可验收范围。

### P2-WP2：Auth/session 与请求上下文

产出：明确 local/platform/standalone 的用户身份语义；前端 token/session 注入、401/403、登录后回跳、路由保护、logout 清理和用户缓存策略；移除或隔离误导性的 mock login/register 文案。

依赖：认证 provider 与 P1 standalone adapter 的接口决策；真实 provider 配置可能属于 P3。

### P2-WP3：Document Input / Document Selection

产出：统一上传、解析进度、错误、文档 ref、已有文档选择和版本显示；将 Polish/Paper Revision 现有路径抽象为可复用能力；对未支持 documentRef 的工具明确限制。

依赖：文件存储生命周期、parser 支持范围、P1 single-node filesystem 约束。

### P2-WP4：Task UX 与结果交付

产出：任务列表/详情契约、keyword/filter 语义、状态轮询策略、失败/重试/重提、取消边界、结果 renderer registry、文件下载 API/链接、任务结果保存策略。

依赖：是否保留进程内 async；如果要求可靠重试/跨实例恢复，应升级为 P3 queue/worker 设计。

### P2-WP5：Search / Knowledge / Zotero / Grounded Generation 最小闭环

产出：最小 route/navigation、academic search 结果列表与 provenance、导入 knowledge、Zotero connect/items/import、证据选择、grounded generation 结果和 citation/evidence 展示。

依赖：OpenAlex/Zotero 凭据、embedding/index provider、Knowledge 数据模型和 grounded request schema；需确认最小用户旅程是“搜索→导入→有据生成”还是“Zotero→知识库→有据生成”。

### P2-WP6：Cross-cutting UX quality gate

产出：统一 loading/empty/error/success 组件、toast 和可访问性；前端请求日志/trace 关联；关键路径防重复提交、幂等提示、积分不足提示；为尚未真实实现的工具提供能力标签。

依赖：P2-WP1 的状态枚举和错误 envelope。

### 建议依赖顺序

`P2-WP1 → P2-WP2/P2-WP3 → P2-WP4 → P2-WP5 → P2-WP6`。
WP2 与 WP3 可在契约冻结后并行；WP5 不应在 auth、document ownership、result/citation contract 未冻结前大规模展开。

## 11. P3 / P4 Boundaries

### P3：可靠性、部署与外部生产依赖

建议放入 P3：

- durable queue/worker、任务持久恢复、crash replay、跨实例一致性、取消/重试的服务端语义。
- object storage、生命周期 cleanup、共享卷/多节点部署、备份恢复、灾备和 deployment rehearsal。
- standalone/OIDC/JWKS 生产 provider 的完整接入、密钥轮换、生产级审计与权限模型。
- AI provider 限流、成本控制、配额、熔断、长任务超时和可观测性闭环。
- Knowledge indexing/embedding 的生产规模、异步 ingestion、重建索引和数据迁移。

### P4：商业化与发布级真实能力

建议放入 P4：

- 真实支付 provider、webhook、退款/对账、订单争议和商业合规。
- 生产级查重来源/引擎、格式排版和可下载文档生成；包括版权、引用和导出质量要求。
- 23 个工具全部从 preview 到 production 的模型/数据源/质量评估、SLA 与成本治理。
- 发布准备、运营后台、用户支持、隐私/保留策略、营销数字核验和规模化性能压测。

P2 可以消费已有 E4/E5/E6 HTTP capability，但不能把“后端已有 controller”误当成生产级 SLA 或已完成的外部集成。P3/P4 的边界需在架构评审中明确后再进入对应 phase。

## 12. Risks / Dependencies

| 风险/依赖 | 影响 | 审计判断 |
|---|---|---|
| 治理文档与实际 tag/main 漂移 | 基线、phase 状态和后续授权判断可能不一致 | P2 审查前应明确 source of truth 与 closeout 修复责任 |
| Auth 语义不一致 | standalone 下所有受保护产品流可能失败 | P2 最高优先级前置决策 |
| 进程内 setTimeout 任务 | 进程退出、扩容、重复提交、恢复和可靠重试不可保证 | P2 可做 UX 边界；可靠性归 P3 |
| 文件上传不统一 | 大多数工具无法基于真实文档处理 | P2 核心产品断点 |
| resultData 无强契约 | renderer 静默显示空结果或错字段 | P2 必须冻结 schema |
| keyword 后端不消费 | 任务搜索是死功能 | 低成本 P2 修复候选 |
| 下载 API 缺失 | 已完成任务不能交付文件 | P2 核心闭环 |
| Knowledge/index provider | 搜索、导入、检索和 grounded 结果可能受 provider/embedding 配置阻塞 | 需要 P2 架构决策与环境矩阵 |
| Zotero/OpenAlex 外部配置 | 连接、限流、provenance、失败恢复受第三方影响 | P2 需要显式 mock/real 模式区分 |
| 模拟支付 | 余额与真实资金不等价 | P4 发布阻塞，不宜混入 P2 验收 |
| 23 工具质量不均 | 统一工具目录会产生能力误导和验收膨胀 | 需要 preview/production capability matrix |
| 错误 catch 弱 | 网络失败可能误显 empty，用户无法恢复 | P2 cross-cutting UX 质量门槛 |

## 13. Recommended P2 Architecture Inputs

在 ChatGPT 进行 P2 架构 review 前，建议先确认以下输入；本报告不替代这些决策：

### 13.1 冻结一条最小可验收用户旅程

推荐先选择：`登录/本地身份 → 上传文档 → 选择工具 → 提交任务 → 轮询 → 查看真实结果 → 下载/重提`。
若 P2 要覆盖 E4/E5/E6，则增加：`学术搜索或 Zotero → 导入知识库 → 证据检索 → 有据生成 → 查看引用/证据`。

### 13.2 冻结身份与运行模式矩阵

至少定义 local、platform、standalone 三种模式的：用户来源、token 位置、请求头、401 行为、数据隔离、开发 fallback、生产禁用项。`mock_token` 不应同时承担“演示用户”和“真实已登录用户”两种语义。

### 13.3 冻结 canonical domain contracts

建议至少有以下稳定对象：

- `ToolCapability`：输入类型、是否需文档、是否真实 provider、积分、输出类型、preview 状态。
- `DocumentInputRef`：owner、source、version、parse status、mime、size、error、retention。
- `TaskEnvelope`：idempotency、type、status、progress、failure code、cost、timestamps。
- `TaskResult`：version、kind、content/file refs、provenance、citations、renderer key。
- `EvidenceSet` / `CitationTrace`：source、document version、claim binding、display metadata。

### 13.4 冻结能力分层

产品目录应将工具分成至少三类：

1. 真实文本/文档管线（当前已确认 Polish、Paper Revision，以及具体审查后保留的 topic flow）。
2. 已有 API 但仍为模板/模拟结果的 preview 工具。
3. 后端已有 capability、尚无前端入口的 integration 工具（Search/Zotero/Knowledge/Grounded Generation）。

只有第一类和明确验收的第二类才能进入 P2 的“完成”指标；第三类需按最小旅程单独验收。

### 13.5 冻结服务端可靠性边界

P2 若继续使用进程内 async，前端必须明确“任务可能因进程退出而失败/丢失”的边界，并避免承诺可靠恢复；若产品要求可靠任务，则应先转为 P3 基础设施工作，而不是只在前端增加重试按钮。

### 13.6 建立验收矩阵

每个 P2 工作包应至少拥有：route、API、权限、输入、成功输出、loading、empty、error、重复提交、刷新/回访、下载/导出和数据隔离验收项。尤其要用真实非空文档验证“上传的字节确实进入 generator”，用断网/401/余额不足/provider failure 验证错误态，而不是只验证 HTTP 200。

## 结论

当前仓库已经具备 P1 accepted baseline 和若干可运行的用户演示路径，但尚未形成完整的学术写作产品闭环。P2 的核心不是继续增加入口数量，而是把身份、文档、任务、结果和已有检索/有据生成能力按统一契约连起来，并显式区分真实能力、preview 和未接入后端能力。

本文件仅为 `PHASE_P2_GITHUB_AUDIT_DRAFT`，不代表 `PHASE_P2_AUTHORIZED`、`PHASE_P2_REVIEW_CANDIDATE` 或任何实现批准。
