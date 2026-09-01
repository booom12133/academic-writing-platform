# DeepSeek Phase A 设计

## 目标

在不改变其他 AI 工具行为的前提下，把“智能拟题”从本地模板/前端 mock 迁移到真实 DeepSeek API，打通现有前端表单、任务、结果页链路。

## 已确认现状

- 前端 `TopicGenerationTool` 当前直接展示 `MOCK_TOPICS`，没有提交任务。
- 后端已有 `AiToolsService -> TasksService -> generator` 的异步任务流程。
- `topic-generation.generator.ts` 当前返回模板生成的 `topics`。
- 任务详情页已经支持 `topics`、`titles` 和 `topicList` 结果结构。
- `axios` 与 `zod` 已存在于项目依赖中。
- 任务表只有 `resultData` JSON 字段，因此调试 metadata 放在智能拟题的 `resultData.metadata` 中，不修改数据库结构。

## 架构

```text
TopicGenerationGenerator
          ↓
      LlmService
          ↓
   DeepSeekProvider
          ↓
   DeepSeek V4 Flash
          ↓
       JSON.parse
          ↓
       Zod 校验
          ↓
      resultData
          ↓
    现有任务详情页
```

`DeepSeekProvider` 只负责供应商协议，不包含拟题业务。`LlmService` 提供后续可替换供应商的最小抽象。只有 `topic-generation` 走新链路，其他 generator 保持原调用方式。

## 配置与安全

- 使用 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_DEFAULT_MODEL` 和 `DEEPSEEK_PREMIUM_MODEL`。
- 缺少 Key 不阻止应用启动；执行真实拟题时返回明确配置错误。
- 不把 Key 放入客户端、数据库或日志。
- API 请求 timeout 为 90 秒。
- 统一处理未配置、401/403、429、billing、timeout 和非 2xx 错误。

## 拟题输出

保持现有业务结构：

```ts
{
  topics: Array<{
    title: string;
    researchDirection: string;
    innovation: string;
    difficulty: string;
    keyIdeas: string[];
  }>;
  metadata: {
    provider: 'deepseek';
    model: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    generationTimeMs: number;
  };
}
```

使用 JSON Output 和 `thinking: { type: 'disabled' }`。解析或 schema 校验失败最多重试 1 次，仍失败则任务标记为 failed，不回退到旧模板结果。

## 健康检查

增加 `GET /api/ai-tools/llm/health`，调用 DeepSeek `/models`。响应只包含 configured、provider、reachable、defaultModel 和安全错误摘要，不返回密钥。

## 前端范围

将智能拟题表单改为调用现有 `/api/ai-tools/submit`，提交成功后跳转任务详情页。保留现有表单字段和结果页，不增加模型选择 UI，不扩展其他工具。

## 测试

- DeepSeekProvider：请求参数、认证 header、未配置 Key、正常响应/usage、非 2xx 错误。
- TopicGenerationGenerator：真实字段进入 prompt、空字段自然省略、JSON 解析和 Zod 校验、一次重试。
- `npm run test:deepseek`：只在配置 Key 时执行一次短真实请求，未配置时输出 skipped。
- 最终执行项目已有 build、test、lint，并执行 health/smoke 检查。
