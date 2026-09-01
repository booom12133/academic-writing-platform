# AI Collaboration Entry Point

本项目的长期协作约定如下：ChatGPT 是项目总控、架构师、阶段审查者和验收者；Codex/Work 是实施工程师；GitHub 是唯一项目真相源。

开始任何任务前，必须依次读取 `PROJECT_STATE.md`、`ROADMAP.md`、`CODEX_WORKFLOW.md`、`PROJECT_STATE.md` 指向的最近 Final Acceptance Report，以及当前任务直接相关文档。

硬规则：

- `main` 只代表最新正式验收通过的稳定版本；新 Phase 不得直接在 `main` 开发。
- One Phase = One Branch；当前 Phase 未得到明确的 `PHASE_x_ACCEPTED` 前，不得 merge `main`。
- 不得自行进入下一 Phase，不得修改已冻结接口/行为，除非当前任务明确要求且上游审查者批准。
- 实施完成后必须运行项目规定的测试；达到 Review Candidate 后才能 push Phase 分支并创建/更新 PR。
- ChatGPT 要求修复时，只做当前 Phase 的最小必要修复，不做无关重构。
- 只有正式 ACCEPTED 后，才按 Final Acceptance Report → `PROJECT_STATE.md` → merge `main` → accepted tag → STOP 收尾。
- Codex 与 Work 不得同时修改同一开发分支。
- 若仓库与聊天上下文冲突，以最新 accepted `main`、`PROJECT_STATE.md` 和 Final Acceptance Report 为准，并报告冲突。

完整生命周期、审查状态、分支/提交/PR 规则见 [`CODEX_WORKFLOW.md`](CODEX_WORKFLOW.md)。

# 学术写作AI工具平台 - 研发规范

## 应用概览

专注于学术写作全流程辅助的AI工具平台，面向学生、研究者和学术写作者，提供从选题大纲到最终排版的一站式辅助服务。包含六大核心工具：智能大纲生成、文献素材推荐、语法润色、格式规范排版、查重参考、图表可视化。

## 技术架构

### 核心模块

| 模块 | 目录 | 职责 |
|------|------|------|
| 用户模块 | users | 注册/登录/个人信息 |
| 积分模块 | points | 积分余额/充值/流水/会员等级 |
| 任务模块 | tasks | 六大工具的异步任务管理 |
| 文件模块 | files | 文件上传下载管理 |
| AI工具 | ai-tools | 六大AI工具的调用与处理 |
| 订单模块 | orders | 充值订单管理 |

### 工具类型枚举

- `outline` - 智能大纲生成 (20积分)
- `literature` - 文献素材推荐 (30积分)
- `polish` - 语法润色 (按字数，最低10积分)
- `format` - 格式规范排版 (50积分)
- `check` - 查重参考 (40积分)
- `chart` - 图表可视化 (25积分)

### 任务状态

- `pending` - 等待中
- `processing` - 进行中
- `completed` - 已完成
- `failed` - 失败

### 会员等级

- `normal` - 普通用户（无折扣）
- `silver` - 白银会员（95折，累计充值≥100元）
- `gold` - 黄金会员（9折，累计充值≥500元）
- `diamond` - 钻石会员（8折，累计充值≥1000元）

## 设计规范

### 设计风格
- 简约实用、清晰直观
- 适当留白，视觉层级清晰
- 信息密度适中，避免过载
- 主色调：学术蓝 #2563eb
- 辅助色：成功绿 #10b981、警告橙 #f59e0b、错误红 #ef4444
- 中性色：以 slate 灰阶为主

### 布局规范
- 顶部导航栏高度：60px
- 左侧菜单栏宽度：240px
- 右侧辅助栏宽度：280px
- 内容区最大宽度：1200px
- 页面水平内边距：24px
- 卡片内边距：20px
- 组件间距：16px（同级）/ 24px（区块间）

### 排版层级
- 页面标题：text-2xl / font-semibold / leading-tight
- 区块标题：text-lg / font-semibold
- 正文：text-sm / leading-relaxed
- 辅助文字：text-xs / text-slate-500
- 按钮文字：text-sm / font-medium

### 色彩系统
- 主色 primary: #2563eb (blue-600)
- 主色浅: #dbeafe (blue-100)
- 成功 success: #10b981 (emerald-500)
- 警告 warning: #f59e0b (amber-500)
- 错误 danger: #ef4444 (red-500)
- 背景: #f8fafc (slate-50)
- 卡片背景: #ffffff
- 边框: #e2e8f0 (slate-200)
- 正文文字: #1e293b (slate-800)
- 次要文字: #64748b (slate-500)
