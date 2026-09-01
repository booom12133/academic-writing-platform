# Phase B1 Final Acceptance Report

## 1. Semantic Correction

本轮修正了 Academic Revision 中 unresolvedIssues 与 authorInputNeeded 的语义：

- unresolvedIssues 表示修改稿中的研究局限、研究缺口、后续事项或尚未解决的问题，可以是非阻塞的。
- authorInputNeeded 仅在用户明确要求把缺失的真实事实写入论文，且必须由作者提供该事实时设为 true。
- 因此，unresolvedIssues 非空不再自动推出 authorInputNeeded=true。
- 仅保留单向一致性约束：authorInputNeeded=true 时，unresolvedIssues 必须非空。
- authorInputNeeded=false 且存在非阻塞 unresolvedIssues 是合法结果。
- Evidence Boundary 保持不变：用户未提供的具体数据集、模型、方法、指标、样本量、p-value、实验结果、引用、DOI、作者或基金信息不得自行新增。

本轮没有修改 Validator 或 Extractor，也没有加入数据集白名单、关键词猜测或二次 LLM 判断。

## 2. Files Modified

本轮修改：

- D:\学术写作辅助平台\server\modules\ai-tools\skills\project\academic-revision\SKILL.md
- D:\学术写作辅助平台\server\modules\ai-tools\generators\paper-revision.generator.ts
- D:\学术写作辅助平台\server\modules\ai-tools\generators\paper-revision.generator.spec.ts
- D:\学术写作辅助平台\server\modules\ai-tools\skills\skill.composer.spec.ts
- D:\学术写作辅助平台\server\modules\ai-tools\skills\validators\invariant.validator.spec.ts

未修改：

- invariant.validator.ts
- invariant.extractor.ts
- SkillLoader
- SkillRegistry
- SkillComposer 生产代码
- DeepSeekProvider
- LlmService
- polish、前端及其他 Phase B1 生产模块

## 3. Targeted Regression

- Case A — 非阻塞 unresolved issue：PASS。非空 unresolvedIssues 且 authorInputNeeded=false 正常交付。
- Case B — blocking author input：PASS。unresolvedIssues 非空且 authorInputNeeded=true 正常交付。
- Case C — authorInputNeeded=true 但无解释：PASS。Generator 拒绝矛盾结果。
- Case D — 无 unresolved issue 且 authorInputNeeded=false：PASS。
- Saved real Test B replay：PASS。历史真实 structured output 通过 Zod、单向 consistency gate、revision-conservative Validator，并正常生成 resultData。
- 定向测试：4 suites、45 tests PASS。

## 4. Test A EN

沿用此前真实记录：

- Model: deepseek-v4-flash
- Validator: polish-strict
- Preserved invariants: DvXray、RT-DETR、92.4%、p = 0.032、[12]、24.6 GFLOPs、Figure 4
- Usage: prompt 1557 / completion 102 / total 1659
- Latency: 1122 ms
- Result: PASS

## 5. Test A ZH

沿用此前真实记录：

- Model: deepseek-v4-flash
- Validator: polish-strict
- Preserved invariants: PASS
- Usage: prompt 1628 / completion 64 / total 1692
- Latency: 1033 ms
- Result: PASS

## 6. Test B

本轮不重新调用 DeepSeek，使用上一轮保存的真实 structured output replay。该输出此前来自完全相同的原文、用户要求、academic-revision-en 和 deepseek-v4-flash。

- no fabricated facts: PASS
- new unsupported identifiers: 0
- authorInputNeeded: false
- unresolvedIssues:
  - No specific external dataset results were provided; thus, the discussion uses general terms and does not include fabricated metrics.
- consistency: PASS。非空 unresolvedIssues 被视为非阻塞研究缺口；authorInputNeeded=false 合法。
- validator: PASS，0 errors，0 warnings
- result: PASS

历史真实 revisedContent 为：

~~~text
Our model achieves 92.4% mAP on DvXray, demonstrating the effectiveness of the proposed method. However, several limitations should be acknowledged. First, the model's performance is evaluated only on DvXray, which may not fully represent the diversity of real-world scenarios. The dataset's specific characteristics, such as image quality and object distribution, could influence the results, and the model's generalization to other domains remains uncertain. Second, the computational complexity of the method has not been thoroughly analyzed, and its efficiency in resource-constrained environments is yet to be verified. Third, the model's robustness to adversarial attacks or noisy inputs has not been tested, which could be critical for practical deployment. To address these limitations, future work should include external validation on independent datasets to assess the model's generalizability. Additionally, investigating the model's performance under various conditions, such as different imaging protocols or hardware settings, would provide a more comprehensive understanding of its applicability. Without such external validation, the practical applicability of the method, while promising, should be considered preliminary.
~~~

该内容保留了原文的 92.4%、mAP、DvXray，使用泛化的 external validation / independent datasets 表达，没有引入 PASCAL、VOC、COCO、PIDray 等未授权具体数据集，也没有新增指标、实验结果或引用。

## 7. Negative Validator

PASS。

未修改 Validator，以下新增事实仍被正确拦截：

- 94.7%
- PIDray
- p = 0.023
- [13]
- COCO

## 8. Full Regression

- tests: PASS，13 suites / 75 tests
- lint: PASS
- server type-check: PASS
- client type-check: PASS
- server build: PASS
- client build: PASS

Client build 仅保留既有 module type 和 large chunk warning，无构建失败。

## 9. Final Decision

~~~text
PHASE_B1_ACCEPTED
~~~

验收条件全部满足：

- Test A EN PASS
- Test A ZH PASS
- Test B replay PASS
- 没有虚构事实
- 没有新增未授权实体
- Zod PASS
- Consistency PASS
- Validator PASS
- Negative Validator PASS
- 全量回归 PASS

Phase B1 已完成。本轮停止，不进入 Phase C。

