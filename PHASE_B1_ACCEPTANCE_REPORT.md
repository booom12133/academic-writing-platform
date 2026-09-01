# Phase B1 Acceptance Report

## 1. Final Fix

本轮为 Academic Revision 增加了 Evidence Boundary：

- 可以讨论 external validation、additional independent datasets、generalizability、robustness 等泛化概念。
- 用户未提供时，不得自行引入具体 dataset name、model name、method name、metric value、sample size、p-value、experimental result、reference、DOI、author 或 funding information。
- 即使只是 future-work recommendation，也不得自行选择并命名具体数据集。
- 缺少实验结果、外部验证结果或其他作者真实信息时，必须设置 authorInputNeeded 为 true，并在 unresolvedIssues 中说明缺失内容。

同时保留现有 string[] schema，未进行大规模结构重构；在 Zod parse 后增加确定性一致性检查：

~~~text
unresolvedIssues 非空 + authorInputNeeded=false
→ 拒绝该矛盾 Structured Output
~~~

本轮未放宽 Validator，未加入数据集白名单，未删除 technical-identifier 检查。

## 2. Files Modified

本轮修改：

- D:\学术写作辅助平台\server\modules\ai-tools\skills\project\academic-revision\SKILL.md
- D:\学术写作辅助平台\server\modules\ai-tools\generators\paper-revision.generator.ts
- D:\学术写作辅助平台\server\modules\ai-tools\generators\paper-revision.generator.spec.ts
- D:\学术写作辅助平台\server\modules\ai-tools\skills\skill.composer.spec.ts
- D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.validator.spec.ts

未修改 Validator、Extractor、SkillLoader、SkillRegistry、SkillComposer 生产代码、DeepSeekProvider、LlmService、polish、前端或其他 Skill。

## 3. Regression Tests

TDD 结果：

- 修改前，新增 Skill 规则测试失败。
- 修改前，矛盾 Structured Output 测试失败，旧 Generator 会错误地正常返回。
- 修改后，定向测试 4 suites、42 tests 全部 PASS。

覆盖内容包括：

- 普通 external datasets 泛化表达可以正常处理。
- unresolvedIssues 非空且 authorInputNeeded=false 会被拒绝。
- COCO 等未在 source/requirements 中提供的具体数据集名称仍被 Validator 拦截。
- 用户明确提供 PIDray 时，revision-conservative 允许该值。
- 原有 Extractor 和 Validator 回归保持通过。

## 4. Real Test A EN

沿用此前已通过的真实验收结果：

- Model: deepseek-v4-flash
- Validator: polish-strict
- Preserved invariants: DvXray、RT-DETR、92.4%、p = 0.032、[12]、24.6 GFLOPs、Figure 4
- Usage: prompt 1557 / completion 102 / total 1659
- Latency: 1122 ms
- Result: PASS

## 5. Real Test A ZH

沿用此前已通过的真实验收结果：

- Model: deepseek-v4-flash
- Validator: polish-strict
- Preserved invariants: PASS
- Usage: prompt 1628 / completion 64 / total 1692
- Latency: 1033 ms
- Result: PASS

## 6. Real Test B

输入保持不变，使用 academic-revision-en、deepseek-v4-flash 和真实 LlmService → DeepSeekProvider。

### Raw Structured Output

~~~json
{
  "revisedContent": "Our model achieves 92.4% mAP on DvXray, demonstrating the effectiveness of the proposed method. However, several limitations should be acknowledged. First, the model's performance is evaluated only on DvXray, which may not fully represent the diversity of real-world scenarios. The dataset's specific characteristics, such as image quality and object distribution, could influence the results, and the model's generalization to other domains remains uncertain. Second, the computational complexity of the method has not been thoroughly analyzed, and its efficiency in resource-constrained environments is yet to be verified. Third, the model's robustness to adversarial attacks or noisy inputs has not been tested, which could be critical for practical deployment. To address these limitations, future work should include external validation on independent datasets to assess the model's generalizability. Additionally, investigating the model's performance under various conditions, such as different imaging protocols or hardware settings, would provide a more comprehensive understanding of its applicability. Without such external validation, the practical applicability of the method, while promising, should be considered preliminary.",
  "changeSummary": [
    "Rewrote the discussion to avoid simple repetition of results, focusing instead on limitations and future work.",
    "Added discussion of model limitations, including dataset-specific evaluation, computational complexity, and robustness to adversarial inputs.",
    "Added discussion of external dataset validation without fabricating specific metrics or datasets, using general wording.",
    "Clarified that practical applicability is preliminary pending external validation."
  ],
  "unresolvedIssues": [
    "No specific external dataset results were provided; thus, the discussion uses general terms and does not include fabricated metrics."
  ],
  "authorInputNeeded": false,
  "warnings": []
}
~~~

### Result fields

- JSON parse: PASS
- Zod: PASS
- authorInputNeeded: false
- unresolvedIssues:
  - No specific external dataset results were provided; thus, the discussion uses general terms and does not include fabricated metrics.
- warnings: []

### Validator

- Validator status: PASS
- Violations: 0
- New unsupported identifiers: none
- Usage: prompt 724 / completion 339 / total 1063
- Latency: 4507 ms
- Result: Validator PASS, but overall Test B FAILS at the Structured Output consistency gate because unresolvedIssues is non-empty while authorInputNeeded is false.

这次改写没有引入新的实验指标、外部实验结果、引用或具体外部数据集名称；原文中的 92.4%、mAP、DvXray 均保留，重复 DvXray 也没有触发 Validator ERROR。

## 7. Negative Validator

PASS。

此前的 negative case 仍能拦截：

- 94.7%
- PIDray
- p = 0.023
- [13]

本轮未修改 Validator。

## 8. Full Regression

由于真实 Test B 未满足 authorInputNeeded=true，本轮不满足“Test B 通过后再运行全量回归”的条件，因此没有重复运行全量命令。

- targeted: PASS，4 suites / 42 tests
- full tests: NOT RUN in this turn
- lint: NOT RUN in this turn
- server type-check: NOT RUN in this turn
- client type-check: NOT RUN in this turn
- server build: NOT RUN in this turn
- client build: NOT RUN in this turn

此前已确认的基线为 full tests 53/53、Lint、Server/Client type-check 和 Server/Client build 全部 PASS；本轮未修改 Validator、Extractor 或构建相关代码。

## 9. Final Decision

~~~text
PHASE_B1_NOT_ACCEPTED
~~~

Test A EN、Test A ZH 和 Validator 均通过，具体外部数据集名称误报也已消失。但真实 Test B 的模型输出仍存在：

~~~text
unresolvedIssues 非空
authorInputNeeded=false
~~~

生产 Generator 的一致性校验会拒绝该矛盾结果，因此尚未达到最终验收条件 authorInputNeeded=true。根据本轮“真实 Test B 无 ERROR 且 authorInputNeeded=true”标准，不能写 PHASE_B1_ACCEPTED。


