# Phase B1 Test B Diagnostic V2

## 1. Raw Structured Output

本次真实调用仅执行 1 次。以下是 DeepSeek 返回的完整业务 JSON；未包含 System Prompt 或 API Key。

~~~json
{
  "revisedContent": "Our model achieves 92.4% mAP on the DvXray dataset, confirming its effectiveness in the evaluated setting. However, several limitations must be acknowledged. First, the model's performance was assessed on a single dataset, which may limit the generalizability of the findings to other domains or imaging conditions. Second, the architecture's sensitivity to hyperparameters and potential overfitting on DvXray were not fully explored. Third, the computational cost and inference speed, which are critical for real-world deployment, were not analyzed in detail. To address these limitations, future work should include validation on external datasets, such as publicly available X-ray benchmarks, to assess cross-domain robustness. Unfortunately, we do not have access to such external datasets at this time, and therefore cannot provide quantitative comparisons. We emphasize that no external validation results are reported here, and any such metrics would require dedicated experiments.",
  "changeSummary": [
    "Removed repetitive restatement of results and vague claims of practical applicability.",
    "Added a detailed discussion of model limitations, including single-dataset evaluation, hyperparameter sensitivity, overfitting risk, and lack of computational cost analysis.",
    "Added a discussion on the need for external dataset validation, explicitly stating that no external results are available and no metrics are fabricated."
  ],
  "unresolvedIssues": [
    "External dataset validation results are not provided; the author should supply such data if available."
  ],
  "authorInputNeeded": true,
  "warnings": []
}
~~~

实际捕获的原始 response content 与上述业务 JSON 一致。

## 2. LLM Metadata

- Model: deepseek-v4-flash
- Prompt tokens: 438
- Completion tokens: 297
- Total tokens: 735
- Latency: 3797 ms

## 3. Structured Output Validation

- JSON parse: PASS
- Zod: PASS
- authorInputNeeded: true
- unresolvedIssues:
  - External dataset validation results are not provided; the author should supply such data if available.
- warnings: []

模型正确识别出没有提供外部数据集实验结果，并要求作者补充；没有生成外部实验指标。

## 4. Extracted Invariants

以下是同一 InvariantExtractor 实例的实际输出。每个列表值已经是 Extractor 返回的规范化值。

### Original

~~~text
numbers: []
percentages:
- 92.4%
pValues: []
citations: []
dois: []
units: []
figures: []
tables: []
technicalIdentifiers:
- mAP
- DvXray
formulaFragments: []
~~~

### User Requirements

~~~text
numbers: []
percentages: []
pValues: []
citations: []
dois: []
units: []
figures: []
tables: []
technicalIdentifiers: []
formulaFragments: []
~~~

### Revised Content

~~~text
numbers: []
percentages:
- 92.4%
pValues: []
citations: []
dois: []
units: []
figures: []
tables: []
technicalIdentifiers:
- mAP
- DvXray
- DvXray
- real-world
- X-ray
- cross-domain
formulaFragments: []
~~~

DvXray 在改写内容中出现两次，但已存在于原文 allowed set；本轮没有因重复 DvXray 产生 ERROR，说明上一轮确认的 Validator multiset false positive 已不再触发。

## 5. Allowed Set

revision-conservative 实际执行的是：

~~~text
allowed facts = original invariants + user-requirement invariants
~~~

按类型展示规范化后的实际 allowed set：

~~~text
percentage:
- 92.4%

technical-identifier:
- mAP
- DvXray
~~~

其他类型没有 allowed values：

~~~text
number: []
p-value: []
citation: []
doi: []
unit: []
figure/table: []
formula: []
~~~

Validator 的实际输入范围为：

~~~text
original = originalContent
revised = parsed structuredOutput.revisedContent
userRequirements = 原始用户 requirements
~~~

changeSummary、unresolvedIssues、authorInputNeeded、warnings 和整个 JSON stringify 均未送入 Extractor/Validator 的 revised 字段。

## 6. Violations

本次真实输出实际产生 3 个 ERROR，而不是此前报告中的 2 个。以下逐条记录 Validator 返回的完整字段；Validator 当前接口没有独立的 normalizedValue 或 source 字段，normalizedValue 根据同一 Extractor token 记录，source 根据产生 violation 的参数确定。

### Violation 1

- Type: technical-identifier
- Severity: ERROR
- Value: real-world
- Normalized: real-world
- Reason: UNSUPPORTED_NEW_VALUE: real-world is not supported by the source or user requirements
- Source: revisedContent
- Classification: FALSE_POSITIVE_EXTRACTOR
- Evidence: real-world 只是普通连字符描述语；它不表示新的模型、数据集、指标、结果、样本量或引用。当前 Extractor 的 isTechnicalIdentifier 通过 value.includes('-') 直接将其识别为 technical-identifier，因此 Validator 才将它视为新增事实。该值不在 allowed set，但“被提取成受保护技术标识符”这一步是 false positive。
- Raw violation:

~~~json
{
  "type": "technical-identifier",
  "severity": "ERROR",
  "revisedValue": "real-world",
  "message": "UNSUPPORTED_NEW_VALUE: real-world is not supported by the source or user requirements"
}
~~~

### Violation 2

- Type: technical-identifier
- Severity: ERROR
- Value: X-ray
- Normalized: X-ray
- Reason: UNSUPPORTED_NEW_VALUE: X-ray is not supported by the source or user requirements
- Source: revisedContent
- Classification: FALSE_POSITIVE_EXTRACTOR
- Evidence: X-ray 在这里是普通成像领域描述词，不是本次原文中提供的新模型名、数据集名、指标或实验结果。当前 Extractor 的 value.includes('-') 规则将其识别为 technical-identifier。即使它是领域术语，也不能据此当作不可新增的命名技术标识符。
- Raw violation:

~~~json
{
  "type": "technical-identifier",
  "severity": "ERROR",
  "revisedValue": "X-ray",
  "message": "UNSUPPORTED_NEW_VALUE: X-ray is not supported by the source or user requirements"
}
~~~

### Violation 3

- Type: technical-identifier
- Severity: ERROR
- Value: cross-domain
- Normalized: cross-domain
- Reason: UNSUPPORTED_NEW_VALUE: cross-domain is not supported by the source or user requirements
- Source: revisedContent
- Classification: FALSE_POSITIVE_EXTRACTOR
- Evidence: cross-domain 是普通学术描述语，表示跨域鲁棒性，不是新的模型、数据集、指标、结果、样本量或引用。当前 Extractor 的 value.includes('-') 规则将其识别为 technical-identifier，导致 Validator 报告新增事实。
- Raw violation:

~~~json
{
  "type": "technical-identifier",
  "severity": "ERROR",
  "revisedValue": "cross-domain",
  "message": "UNSUPPORTED_NEW_VALUE: cross-domain is not supported by the source or user requirements"
}
~~~

## 7. Technical Identifier Heuristic Review

当前规则为：

~~~text
value.includes('-')
或 value.includes('_')
或包含数字
或 camelCase
或全大写
或 /^[A-Z]{2,}[a-z]+$/
~~~

本次 3 个 ERROR 均由第一条 value.includes('-') 触发：

| 词 | 当前识别原因 | 实际性质 | 结论 |
|---|---|---|---|
| real-world | 含连字符 | 普通描述语 | Extractor false positive |
| X-ray | 含连字符 | 成像领域普通术语/描述语，不是本次新增命名实体 | Extractor false positive |
| cross-domain | 含连字符 | 普通学术描述语 | Extractor false positive |

上一轮为识别 PIDray 增加的规则是 /^[A-Z]{2,}[a-z]+$/。本次 3 个 ERROR 均不是该规则产生的；它们也不是 PIDray 类形式。因此，本次 false positive 有证据支持的直接来源是原有的“所有连字符词均视为技术标识符”规则，而不是上一轮新增的 PIDray 规则。

## 8. Root Cause

已被本次真实调用和本地数据流共同证明的原因如下：

1. DeepSeek 返回了合法且符合 Zod schema 的业务 JSON。
2. DeepSeek 正确设置 authorInputNeeded: true，并在 unresolvedIssues 中说明缺少外部数据集结果。
3. 92.4%、mAP、DvXray 均被正确提取并保留；重复 DvXray 没有再触发 Validator ERROR。
4. Validator 的 allowed set 正确只包含原文事实和用户要求事实；本次错误值确实不在该 set 中。
5. 3 个错误值均是普通连字符表达，被 Extractor 的 value.includes('-') 启发式错误标为 technical-identifier。

因此，本次真实 Test B 的 3 个 ERROR 均分类为 FALSE_POSITIVE_EXTRACTOR。没有证据支持 TRUE_POSITIVE 或 FALSE_POSITIVE_VALIDATOR。

## 9. Minimal Fix Recommendation

只建议在 Extractor 层收窄连字符技术标识符启发式：不要把所有普通连字符词自动视为不可新增的技术标识符，同时保留对明确命名实体（例如 PIDray）的识别。应先补充覆盖 real-world、X-ray、cross-domain 与 PIDray 的回归测试，再实施最小规则调整。

本轮未实施该建议，也未修改 Validator、Extractor、Prompt、Skill 或生产 Generator。

## 10. Files Potentially Requiring Modification

仅基于本次证据，后续若实施最小修复，可能需要修改：

- D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.extractor.ts
- D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.extractor.spec.ts

