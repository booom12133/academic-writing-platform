# DeepSeek Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将智能拟题接入真实 DeepSeek V4 Flash，并复用现有任务与结果详情链路。

**Architecture:** 在 `server/modules/ai-tools/llm` 建立统一 LLM 类型、服务和 DeepSeek provider；智能拟题 generator 通过 `LlmService` 生成 JSON 并用 Zod 校验。其他 generator、数据库结构和任务队列保持原状。

**Tech Stack:** NestJS 10, TypeScript, axios, zod, Jest/ts-jest, React/Vite。

**Spec:** `docs/superpowers/specs/2026-08-31-deepseek-phase-a-design.md`

## Global Constraints

- 只迁移 `topic-generation`，其他 generator 保持原行为。
- 默认模型为 `deepseek-v4-flash`，不得使用 `deepseek-chat` 或 `deepseek-reasoner`。
- 缺少 API Key 时应用可启动，但真实拟题必须明确失败，不允许模板 fallback。
- API Key 不得进入前端 bundle、浏览器请求、数据库或日志。
- 不实现 Skills Engine、文件解析、RAG、正式任务队列、多模型路由或无关 UI 重构。
- 生产代码必须先有失败测试，再实现；最终必须运行 build、test、lint 和 health/smoke 检查。

---

### Task 1: 配置与统一 LLM 边界

**Files:**
- Create: `server/modules/ai-tools/llm/llm.types.ts`
- Create: `server/modules/ai-tools/llm/llm.service.ts`
- Create: `server/modules/ai-tools/llm/deepseek.provider.ts`
- Create: `server/modules/ai-tools/llm/deepseek.provider.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.module.ts`
- Modify: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- `LlmService.generate(options: LlmGenerateOptions): Promise<LlmGenerateResult>` delegates to `DeepSeekProvider.generate`.
- `DeepSeekProvider.checkConnectivity(): Promise<DeepSeekHealthResult>` requests `/models`.

- [ ] **Step 1: Write failing provider tests** covering default model/header/request body, missing key, normal content/usage, and safe non-2xx errors.
- [ ] **Step 2: Run `npm test -- --runInBand server/modules/ai-tools/llm/deepseek.provider.spec.ts` and confirm failure because the provider does not exist.**
- [ ] **Step 3: Implement the types, provider, service, Nest registration, `.env.example`, and secret ignore rules.** Use axios with a 90-second timeout, `Authorization: Bearer <key>`, JSON Output when requested, and safe error messages.
- [ ] **Step 4: Run the provider spec and confirm all cases pass.**

### Task 2: 智能拟题 generator 与任务元数据

**Files:**
- Modify: `server/modules/ai-tools/generators/topic-generation.generator.ts`
- Create: `server/modules/ai-tools/generators/topic-generation.generator.spec.ts`
- Modify: `server/modules/ai-tools/ai-tools.service.ts`

**Interfaces:**
- `TopicGenerationGenerator.generate(input: TopicGenerationInput): Promise<{ resultData: TopicGenerationOutput; metadata: GenerationMetadata }>`.
- `TopicGenerationOutput` retains `topics[]` with `title`, `researchDirection`, `innovation`, `difficulty`, and `keyIdeas`.

- [ ] **Step 1: Write failing generator tests** for prompt field mapping, omission of empty values, valid JSON/Zod output, and one retry after invalid structured output.
- [ ] **Step 2: Run the generator spec and confirm failure because the LLM-backed generator is not implemented.**
- [ ] **Step 3: Implement system/user prompts, JSON parsing, Zod validation, one retry, and metadata capture.** Do not retain the old template as a production fallback.
- [ ] **Step 4: Update `AiToolsService` so only `topic-generation` uses the new generator, with progress 30/60/85/100 and metadata merged into `resultData`.**
- [ ] **Step 5: Run provider and generator specs together and confirm they pass.**

### Task 3: Health endpoint and smoke command

**Files:**
- Modify: `server/modules/ai-tools/ai-tools.controller.ts`
- Create: `scripts/test-deepseek.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a focused controller/service test or use the provider connectivity test to lock the health response shape.**
- [ ] **Step 2: Run the focused test and confirm failure before endpoint registration.**
- [ ] **Step 3: Add `GET /api/ai-tools/llm/health` and `npm run test:deepseek`; make missing-key smoke output exactly `Skipped: DEEPSEEK_API_KEY is not configured`.**
- [ ] **Step 4: Run the focused tests and the smoke command without a key; confirm it skips without failure.**

### Task 4: Migrate the existing intelligent-topic form

**Files:**
- Modify: `client/src/pages/Tools/tools/TopicGenerationTool.tsx`
- Modify: `shared/api.interface.ts`
- Modify: `client/src/pages/Tools/ToolHelper.tsx`

- [ ] **Step 1: Write the smallest frontend type-checkable change test through the existing API contract: submit `topic-generation` with `field`, `educationLevel`, and non-empty `researchDirection`.**
- [ ] **Step 2: Run `npm run type:check:client` and confirm the test/change is not yet supported by the current component implementation.**
- [ ] **Step 3: Replace `MOCK_TOPICS` flow with `taskApi.createTask`, preserve form fields, use the configured 15-point cost, and navigate to `/tasks/{id}`.** Remove stale realtime/mock helper copy only for this tool.
- [ ] **Step 4: Run client type-check and build.**

### Task 5: Full verification and report

**Files:**
- No additional production files unless verification exposes a Phase A defect.

- [ ] **Step 1: Run `npm run build`.**
- [ ] **Step 2: Run `npm test -- --runInBand`.**
- [ ] **Step 3: Run `npm run lint`.**
- [ ] **Step 4: Start the server using the project’s normal development command and call `GET /api/ai-tools/llm/health`.**
- [ ] **Step 5: If `DEEPSEEK_API_KEY` is available, run `npm run test:deepseek` once; otherwise record the required PowerShell command and skipped status.**
- [ ] **Step 6: Inspect changed files and report exact modified/new files, test evidence, token metadata if a real call succeeded, and the lack of Git metadata.**
