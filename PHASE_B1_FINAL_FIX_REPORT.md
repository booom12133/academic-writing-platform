# Phase B1 Final Fix Report

## 1. Root Cause

本轮已确认并修复的根因是 Hyphen technical-identifier false positive。

旧规则把任何包含连字符的 token 都识别为 technical-identifier：

~~~ts
value.includes('-')
~~~

因此普通学术表达 real-world、X-ray、cross-domain、state-of-the-art、well-known、single-dataset 会被错误送入 revision-conservative 的事实保护比较。

## 2. Files Modified

本轮只修改了：

- D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.extractor.ts
- D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.extractor.spec.ts

未修改 Validator、Prompt、Skill、Skill Registry、Skill Composer、Generator、LlmService、DeepSeekProvider 或前端。

## 3. Extractor Rule Change

连字符 token 不再因为单纯包含连字符而被识别为技术标识符。

现在只有当至少一个 segment 满足以下强技术信号时，连字符 token 才会被识别：

- segment 是长度至少为 2 的全大写 acronym；
- segment 包含数字；
- segment 具有 camelCase 或 mixed technical casing。

保留了原有的 underscore、数字、camelCase、全大写 acronym 和 PIDray 类命名规则。

本轮未引入词典、NLP、LLM、embedding 或外部 API。

## 4. Extractor Regression

定向 Extractor 测试结果：17/17 PASS。

- real-world: 不识别为 technical-identifier
- X-ray: 不识别为 technical-identifier
- cross-domain: 不识别为 technical-identifier
- state-of-the-art: 不识别为 technical-identifier
- well-known: 不识别为 technical-identifier
- single-dataset: 不识别为 technical-identifier
- RT-DETR: 继续识别
- GPT-4: 继续识别
- BERT-base: 继续识别
- ResNet-50: 继续识别
- YOLO-v8: 继续识别
- PIDray: 继续识别
- DvXray: 继续识别
- mAP: 继续识别

Validator 定向回归也通过：与 Extractor 合计 31/31 PASS。此前确认的 revision set membership、polish multiset 和 PIDray negative test 均保持通过。

## 5. Real Test B

### Input

原文和用户要求与 Phase B1 Test B 完全一致，使用 stack academic-revision-en 和真实 LlmService → DeepSeekProvider。

### Structured output checks

- Model: deepseek-v4-flash
- JSON parse: PASS
- Zod: PASS
- authorInputNeeded: false
- unresolvedIssues:
  - No external dataset experimental results were provided; therefore, no specific metrics are mentioned for external validation.
- warnings: []

模型没有生成新的实验指标、外部实验结果或引用，但 authorInputNeeded 实际返回 false，与 unresolvedIssues 中明确存在缺失外部实验结果的内容不一致。

### Validator result

- Validator status: ERROR
- Violations: 3
- Unsupported facts generated:
  - PASCAL
  - VOC
  - COCO
- Usage: prompt 438 / completion 325 / total 763
- Latency: 3859 ms
- Result: FAIL

这 3 个值均不是连字符误报。它们通过保留的全大写 acronym 规则被正确识别为 technical-identifier，并且确实不在原文或用户要求的 allowed set 中。DeepSeek 将它们作为未来验证可使用的具体外部数据集名称提出，但用户没有提供这些数据集名称；本轮没有生成这些数据集的实验结果或指标。

### Actual violations

#### Violation 1

- Type: technical-identifier
- Severity: ERROR
- Value: PASCAL
- Reason: UNSUPPORTED_NEW_VALUE: PASCAL is not supported by the source or user requirements
- Source: revisedContent

#### Violation 2

- Type: technical-identifier
- Severity: ERROR
- Value: VOC
- Reason: UNSUPPORTED_NEW_VALUE: VOC is not supported by the source or user requirements
- Source: revisedContent

#### Violation 3

- Type: technical-identifier
- Severity: ERROR
- Value: COCO
- Reason: UNSUPPORTED_NEW_VALUE: COCO is not supported by the source or user requirements
- Source: revisedContent

## 6. Negative Validator

PASS。

真实新增事实负例仍被 revision-conservative / polish-strict 正确拦截，包括：

- 94.7%
- PIDray
- p = 0.023
- [13]

Extractor 收窄没有削弱真正技术标识符和实验事实的保护。

## 7. Full Regression

按本轮验收条件，只有真实 Test B 通过后才运行全量回归；由于真实 Test B 仍为 ERROR，本轮未重复执行全量测试、Lint、类型检查和构建。

- targeted: PASS，31/31
- full tests: NOT RUN in this turn
- lint: NOT RUN in this turn
- type-check: NOT RUN in this turn
- builds: NOT RUN in this turn

上一轮已确认的全量基线仍为 53/53 tests、Lint、Server/Client type-check 和 Server/Client build 全部 PASS；本轮未修改除 Extractor 及其测试之外的生产文件。

## 8. Final Decision

~~~text
PHASE_B1_NOT_ACCEPTED
~~~

原因：

1. 本轮已确认的连字符 false positive 已最小修复并通过定向回归。
2. 真实 Test B 不再因 real-world、X-ray、cross-domain 报错。
3. 真实 Test B 仍因新增且未在输入中提供的 PASCAL、VOC、COCO technical identifiers 返回 3 个 ERROR。
4. authorInputNeeded 实际为 false，未满足最终验收要求的 true 条件。

## 9. Minimal Fix Recommendation

本轮不继续修改。

后续应先明确产品策略：是否允许模型在“讨论外部数据集验证”时提出输入中未提供的具体数据集名称。如果不允许，应通过 revision skill 要求只使用 external datasets 等泛化表达；如果允许，则需单独定义用户要求对外部数据集名称的授权语义，并补充对应测试。两者都不是本轮已确认的连字符 Extractor blocker。


