# Phase B1 Validator Fix Report

## 1. Root Cause

已确认的 Validator 根因是：`revision-conservative` 复用了面向 `polish-strict` 的多重集合（multiset/count）比较逻辑。

这会把“原文中已经允许的事实在改写结果中重复出现”误判为新增事实。例如 `DvXray` 或 `mAP` 在 `revisedContent` 中因讨论表达需要出现两次时，计数比较会产生 `UNSUPPORTED_NEW_VALUE`，尽管该值已经存在于原文允许集合中。

本次最小修复将 `revision-conservative` 的允许事实比较改为按类型进行规范化后的集合（set）成员判断：

```text
allowed facts = original invariants + user-requirement invariants
```

只要改写结果中的事实值已存在于该允许集合中，重复出现不再报 ERROR；原文中删除的事实仍报告 WARN；真正新增的事实仍报告 ERROR。

另外，回归测试证明 Extractor 还存在一个独立的 `PIDray` 识别缺口：原有技术标识符启发式没有识别该形式。为使“新增 PIDray”测试能够实际覆盖 Validator，补充了一个最小 Extractor 规则及对应测试。这不是放宽 Validator，也没有关闭任何检查。

## 2. Files Modified

本轮实际修改的文件：

- `server/modules/ai-tools/skills/validators/invariant.validator.ts`
- `server/modules/ai-tools/skills/validators/invariant.validator.spec.ts`
- `server/modules/ai-tools/skills/validators/invariant.extractor.ts`
- `server/modules/ai-tools/skills/validators/invariant.extractor.spec.ts`

未修改 `DeepSeekProvider`、`LlmService`、revision generator、其他 skill 或前端代码。

## 3. Semantic Change

### `revision-conservative`

- 原文事实和用户要求事实合并后按规范化值建立 allowed set。
- `revisedContent` 中重复的已允许事实：不报错。
- `revisedContent` 中真正新增的数字、技术标识符、引用等：继续报告 ERROR。
- 原文事实从改写结果中删除：报告 WARN，不报告 ERROR。

### `polish-strict`

保持原有 multiset/count 语义不变。润色模式下重复的事实仍会触发 ERROR，防止润色过程改变事实出现次数。

## 4. Regression Tests

新增并验证了以下回归场景：

1. `revision-conservative` 允许重复的 `DvXray`。
2. `revision-conservative` 允许重复的 `mAP`。
3. 新增 `PIDray` 继续报告 ERROR。
4. 新增 `94.7%` 继续报告 ERROR。
5. 删除原文事实只报告 WARN，不报告 ERROR。
6. `polish-strict` 对重复事实仍报告 ERROR。
7. Extractor 能识别 `PIDray` 技术标识符。

定向 Validator/Extractor 测试结果：`17/17 PASS`。

## 5. Real Test B

### Input

原文：

```text
Our model achieves 92.4% mAP on DvXray. These results demonstrate the effectiveness of the proposed method. The method performs well in our experiments and therefore has strong practical applicability.
```

用户要求：

```text
请重写这一段 Discussion。减少对结果的简单重复，增加对模型局限性的讨论，并补充外部数据集验证的讨论。如果没有提供真实的外部数据集实验结果，不要编造任何指标。
```

skill：`academic-revision-en`

### Result

```json
{
  "status": "FAIL",
  "stack": "academic-revision-en",
  "error": "Invariant validation failed for academic revision: 2 error(s)"
}
```

### Required diagnostic fields

- Model：配置模型为 `deepseek-v4-flash`；本次 generator 抛出异常前未返回可读取的响应元数据。
- `authorInputNeeded`：`NOT VERIFIED`。generator 在 Validator 返回 ERROR 后直接抛出，当前 runner 未保留原始 structured output，因此不能据此判断模型字段值。
- `unresolvedIssues`：`NOT AVAILABLE`，原因同上。
- Validator status：`FAIL`，并检测到 `2 error(s)`。
- Unsupported facts：检测到 2 个 ERROR，但本次 runner 没有保留 DeepSeek 原始 JSON 或逐条 violation payload，因此具体 `type`、`value`、`normalizedValue` 和 `reason` 无法由现有日志可靠还原。本报告不猜测其内容。
- API usage：`NOT AVAILABLE`。
- Latency：`NOT AVAILABLE`。
- API 调用次数：本轮真实 Test B 调用 1 次；未再次调用。

因此，Validator 的确定性回归行为已经修复并通过测试，但真实 Test B 仍未通过，且当前证据不足以把这两个真实 ERROR 进一步分类为 `TRUE_POSITIVE`、`FALSE_POSITIVE_EXTRACTOR` 或 `FALSE_POSITIVE_VALIDATOR`。

## 6. Negative Test

使用编译后的 Validator 运行负例，故意将原事实替换为：

- `92.4%` → `94.7%`
- `DvXray` → `PIDray`
- `p=0.032` → `p=0.023`
- `[12]` → `[13]`

`polish-strict` 正确返回 `ERROR`，并识别出新增事实以及对应的原事实删除；负例通过。

## 7. Full Regression

- `npm test -- --runInBand`：`13` suites，`53` tests，全部 PASS。
- `npm run lint`：PASS。
- `npm run type:check:server`：PASS。
- `npm run type:check:client`：PASS。
- 生产 Server build：PASS。
- 生产 Client build：PASS。

构建过程仅有既有的模块类型和 bundle size warning，没有失败。

## 8. Final Decision

```text
PHASE_B1_NOT_ACCEPTED
```

理由：已确认并修复 Validator 的重复事实 false positive，全部自动化回归通过；但真实 Test B 仍返回 2 个 invariant ERROR，且本轮没有保留原始 structured output，无法完成这两个 ERROR 的证据级分类。因此不能宣称 Phase B1 最终验收通过。

## 9. Minimal Fix Recommendation

下一步只需让 Test B runner 在 Validator 失败时保留并输出：

- DeepSeek 原始 structured output（不含 System Prompt 和 API Key）；
- 每条 violation 的 `type`、`severity`、`value`、`normalizedValue`、`reason`、`source`；
- `authorInputNeeded` 和 `unresolvedIssues`；
- usage 与 latency。

然后在不修改业务逻辑的前提下重新执行一次 Test B，才能判断剩余 2 个 ERROR 是模型真实新增事实，还是 Extractor/Validator 的另一处问题。

