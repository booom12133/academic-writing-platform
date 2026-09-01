# Codex / Work GitHub Phase Workflow

本文件是项目的完整协作 SOP。`AGENTS.md` 只保留入口与硬规则；本文件记录执行细节。

## Source of truth and roles

- ChatGPT：负责总体路线、架构决策、阶段审查、`FIX_REQUIRED` / `ACCEPTED` 决策，以及生成 Codex/Work 实施提示词。
- Codex / Work：负责实现、测试、commit、push Phase branch、PR、按审查意见修复，以及最终收尾 Git 操作。
- GitHub：保存唯一可信版本、PR/diff、CI 测试历史、Phase 历史和 Acceptance Reports。

聊天内容不能替代仓库状态。每次任务开始先读取 `PROJECT_STATE.md`、`ROADMAP.md`、本文件、最近 Final Acceptance Report 和任务相关文档。

## Lifecycle

```text
START
  → IMPLEMENT
  → SELF CHECK
  → REVIEW CANDIDATE
  → CHATGPT REVIEW
  → FIX
  → RE-REVIEW
  → PHASE ACCEPTED
  → FINAL CLOSEOUT
  → MERGE MAIN
  → TAG
  → STOP
```

### START

1. 确认当前 `main`、当前 Phase、Phase branch、Phase status 和冻结边界。
2. 确认没有其他 Codex/Work 任务正在修改同一分支。
3. 从最新 accepted `main` 创建一个 Phase 分支；推荐命名 `phase/<phase-id>-<short-name>`。
4. 不得从聊天记忆推断状态；缺失信息写 `UNKNOWN` / `NOT YET CREATED` 并报告。

### IMPLEMENT

- 只实现当前 Phase 的批准目标，不提前实现下一 Phase。
- 遵循项目既有技术栈、测试方法和冻结接口。
- 新行为采用测试先行；每个独立可验证单元完成一个小步后保持测试通过。
- 不修改与当前 Phase 无关的业务功能、历史报告或冻结组件。

### Commit rules

- commit 必须落在当前 Phase branch，不能直接提交到 `main`。
- 每个 commit 只表达一个可审查目的，使用清晰的动词式消息，例如 `feat(c1): add document parser foundation`、`test(c1): cover parser error mapping`。
- 不提交 secrets、`.env`、`node_modules`、`dist`、coverage 或临时文件。
- commit 前检查 `git diff`、`git status`、文件范围和测试输出。

### SELF CHECK

实施者必须自行验证：

1. 需求与 scope 没有遗漏或越界。
2. 新增测试覆盖成功路径、错误路径、冻结边界和安全边界。
3. 项目规定的 tests、lint、type-check、build 均按真实 npm scripts 执行。
4. 没有 LLM/API/外部服务的非授权调用。
5. 工作树仅包含当前 Phase 和协作基础设施允许的文件。

将结果写入 `PROJECT_STATE.md` 的 Current Test Results，并记录已知非阻塞问题。

### REVIEW CANDIDATE

达到以下条件后，才可标记 `REVIEW_CANDIDATE`：

- 当前 Phase 的实现范围完成；
- targeted tests、full regression、lint、type-check、build 通过；
- 冻结文件未被越界修改；
- 当前 branch 有可复现的 commit；
- `PROJECT_STATE.md` 已记录 candidate commit。

此时 Codex/Work 才能 push 当前 Phase branch 并创建或更新 PR。没有 GitHub remote 时，不得伪造 push/PR；应记录 `NOT CONFIGURED`。

### CHATGPT REVIEW

ChatGPT 审查 branch/PR diff、CI、测试结果、scope、冻结契约和安全边界。审查结论只能是：

- `PHASE_x_REVIEW_PASS`：没有阻塞问题，可以进入验收判断；
- `PHASE_x_FIX_REQUIRED`：必须修复后再审查；
- `PHASE_x_ACCEPTED`：满足最终验收门槛。

`FIX_REQUIRED` 的问题按以下级别记录：

- Blocking：阻止验收或 merge，必须修复；
- Important：当前 Phase 的重要缺陷，默认必须修复；
- Optional：不阻止当前 Phase 验收，记录后续处理。

未得到明确 `PHASE_x_ACCEPTED` 前，禁止 merge `main`。

### FIX / RE-REVIEW

Codex/Work 只修复当前 Phase 所需的最小问题：

1. 先为 Blocking/Important 问题补充或确认回归测试；
2. 实施最小修复，不顺手重构无关代码；
3. 重新运行受影响的 targeted tests 和完整规定检查；
4. commit、push 同一 Phase branch，更新 PR；
5. ChatGPT 复审，直到 PASS 或明确 ACCEPTED。

### PHASE ACCEPTED

只有 ChatGPT 明确写出 `PHASE_x_ACCEPTED`，并且 CI/本地证据满足 Acceptance Gate，Phase 才是 accepted。Accepted commit、测试、冻结接口和非阻塞问题必须进入 Final Acceptance Report。

### FINAL CLOSEOUT

在 Phase accepted 后：

1. 创建 `docs/reviews/PHASE_<ID>_FINAL_ACCEPTANCE_REPORT.md`；
2. 写入 Phase goal、implemented scope、key decisions、tests、frozen interfaces、known non-blocking issues、accepted commit、final status 和 next Phase（仅记录）；
3. 更新 `PROJECT_STATE.md`：稳定 Phase、stable main commit、completed phases、最新报告、冻结项和下一 Phase；
4. 更新 `ROADMAP.md` 状态；
5. 将 closeout 文档提交到 Phase branch 并更新 PR。

### MERGE MAIN / TAG / STOP

仅在 `PHASE_x_ACCEPTED` 后：

1. 按 PR 规则 merge Phase branch 到 `main`；
2. 更新 `PROJECT_STATE.md` 中的 stable main commit；
3. 创建不可移动的 accepted tag，例如 `phase-c1-accepted`；
4. 验证 `main`、tag、报告和 CI 一致；
5. 立即 STOP，不自行进入下一 Phase。

## PR minimum contract

每个 PR 必须说明 Phase、目标、实现范围、测试、冻结契约、已知问题、审查范围和明确 out-of-scope，并明确写出 `Do not merge before acceptance`。模板见 `.github/PULL_REQUEST_TEMPLATE.md`。

## Reports and state

历史报告不得删除。当前根目录已有的 B1 报告保留原路径，由 `docs/reviews/README.md` 索引；新的正式报告统一放在 `docs/reviews/PHASE_<ID>_FINAL_ACCEPTANCE_REPORT.md`。`PROJECT_STATE.md` 是动态状态文件，Review Candidate、FIX_REQUIRED、Accepted 和 Final Closeout 时都必须更新。
