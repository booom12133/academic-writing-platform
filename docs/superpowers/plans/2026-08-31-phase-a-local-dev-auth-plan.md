# Phase A Local Development Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the existing academic-writing platform to start locally in development without inventing a platform domain, while preserving the real platform authentication requirement in production and completing the real intelligent-topic-generation task flow.

**Architecture:** Detect the narrow local-development condition before building the platform module. In that condition only, use an explicit local request user context and a local development database adapter required by the existing task services; when a real platform domain or production mode is present, retain the existing PlatformModule and authentication path unchanged. Keep the DeepSeek topic generator and AiToolsService task flow intact.

**Tech Stack:** NestJS, `@lark-apaas/fullstack-nestjs-core`, Drizzle ORM PostgreSQL schema, Jest, DeepSeek provider, React/Vite.

**Spec:** User-provided Phase A local startup and intelligent-topic-generation acceptance requirements in the current task.

## Global Constraints

- Do not enter Phase B.
- Do not develop Skills Engine, migrate other generators, add RAG, add file parsing, or refactor authentication.
- Never invent or set a fake `FORCE_AUTHN_INNERAPI_DOMAIN`.
- Local fallback is allowed only when `NODE_ENV === 'development'` and the real platform domain is absent.
- Production must still require the real `FORCE_AUTHN_INNERAPI_DOMAIN` path.
- Use the existing `AiToolsService` HTTP task flow; do not call a generator directly for E2E verification.
- Do not modify `.env` or expose credentials.

---

### Task 1: Encode the local-platform decision and prove production preservation

**Files:**
- Create: `server/config/local-development.ts`
- Test: `server/config/local-development.spec.ts`
- Modify: `server/app.module.ts`

**Interfaces:**
- Produces `isLocalDevelopmentWithoutPlatformDomain(): boolean` and `getPlatformModuleOptions()` for the root module.
- The production branch keeps `PlatformModule.forRoot()` with its default enabled platform client.

- [ ] **Step 1: Write the failing test**

```ts
describe('local development platform decision', () => {
  it('enables the local fallback only for development without a platform domain', () => {
    expect(isLocalDevelopmentWithoutPlatformDomain({ NODE_ENV: 'development' })).toBe(true);
    expect(isLocalDevelopmentWithoutPlatformDomain({ NODE_ENV: 'production' })).toBe(false);
    expect(isLocalDevelopmentWithoutPlatformDomain({ NODE_ENV: 'development', FORCE_AUTHN_INNERAPI_DOMAIN: 'https://real.example' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the decision function is missing**

Run: `npm test -- --runInBand server/config/local-development.spec.ts`

Expected: FAIL with the missing module/function error.

- [ ] **Step 3: Implement the pure decision function**

```ts
export function isLocalDevelopmentWithoutPlatformDomain(env = process.env): boolean {
  return env.NODE_ENV === 'development' && !env.FORCE_AUTHN_INNERAPI_DOMAIN;
}
```

- [ ] **Step 4: Wire the root module without changing production defaults**

Use the decision only to select local providers; do not assign a fake domain and do not disable production authentication.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- --runInBand server/config/local-development.spec.ts`

Expected: PASS.

### Task 2: Add an explicit development-only local request user context

**Files:**
- Create: `server/middleware/local-development-auth.middleware.ts`
- Test: `server/middleware/local-development-auth.middleware.spec.ts`
- Modify: `server/app.module.ts`

**Interfaces:**
- The middleware runs only in the local-development branch.
- It sets a clearly named fixed development user ID in `req.userContext` without any production code path.

- [ ] **Step 1: Write the failing middleware test**

```ts
it('provides a local development user context for API task requests', () => {
  const request: any = { userContext: {} };
  new LocalDevelopmentAuthMiddleware().use(request, {} as any, () => undefined);
  expect(request.userContext.userId).toBe('local-development-user');
  expect(request.userContext.loginUrl).toBe('');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --runInBand server/middleware/local-development-auth.middleware.spec.ts`

Expected: FAIL because the middleware is missing.

- [ ] **Step 3: Implement the middleware with an explicit local marker**

Set `userId`, `userName`, `userType: 'local-development'`, `env: 'runtime'`, `loginUrl: ''`, and `isSystemAccount: false`; do not read or create credentials.

- [ ] **Step 4: Register it only when the local-development decision is true**

Keep the existing `UserContextMiddleware` and global `AuthNPaasGuard`; the local middleware supplies request context for localhost development only.

- [ ] **Step 5: Run the focused middleware test and the existing authentication-related tests**

Run: `npm test -- --runInBand server/middleware/local-development-auth.middleware.spec.ts server/modules/ai-tools/llm/deepseek.provider.spec.ts`

Expected: PASS.

### Task 3: Supply only the local data dependency needed by the existing task services

**Files:**
- Create: `server/database/local-development.module.ts`
- Create: `server/database/local-development.database.ts`
- Test: `server/database/local-development.database.spec.ts`
- Modify: `server/app.module.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Provides the existing `DRIZZLE_DATABASE` token and the current schema tables to the already-existing services.
- The adapter is selected only when `isLocalDevelopmentWithoutPlatformDomain()` is true.
- Production continues to use `SUDA_DATABASE_URL` through the platform DataPaas module.

- [ ] **Step 1: Write the failing database bootstrap test**

```ts
it('creates the local schema and supports an app user lookup', async () => {
  const database = await createLocalDevelopmentDatabase();
  await database.insert(appUsers).values({ userId: 'local-development-user', points: 100 });
  const rows = await database.select().from(appUsers);
  expect(rows[0].userId).toBe('local-development-user');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --runInBand server/database/local-development.database.spec.ts`

Expected: FAIL because the local database module is missing.

- [ ] **Step 3: Implement the local adapter against the existing schema**

Use an isolated in-memory PostgreSQL-compatible adapter and create only `app_users`, `tasks`, `point_records`, and `recharge_orders` required by the current services. Seed the local development user with enough points for one topic-generation task.

- [ ] **Step 4: Register the adapter only in local development**

Do not remove `PlatformModule` or change its production configuration. The local module replaces only the missing local database dependency in the development branch.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- --runInBand server/database/local-development.database.spec.ts`

Expected: PASS.

### Task 4: Start the complete local stack and verify the real HTTP task flow

**Files:**
- Modify only files required by Tasks 1–3.

- [ ] **Step 1: Run `npm run dev` and observe both processes for at least 30 seconds**

Expected: server remains listening on its reported backend URL and Vite remains listening on its reported frontend URL.

- [ ] **Step 2: Verify backend health over HTTP**

Run: `Invoke-RestMethod http://localhost:3000/api/ai-tools/llm/health`

Expected: configured/reachable DeepSeek health with `deepseek-v4-flash`.

- [ ] **Step 3: Verify frontend HTTP response**

Run: `Invoke-WebRequest http://localhost:8080`

Expected: HTTP 200 and HTML content.

- [ ] **Step 4: Submit the exact topic-generation payload through the real API**

Use `POST /api/ai-tools/submit` with the UI payload and the local development request user context. Poll `GET /api/tasks/:id` until completion. Do not call the generator directly.

- [ ] **Step 5: Verify result provenance and quality**

Confirm result metadata identifies DeepSeek and `deepseek-v4-flash`, includes token usage and latency, and record all generated fields without changing the prompt.

### Task 5: Run the complete Phase A regression gate

**Files:**
- No additional source changes.

- [ ] **Step 1: Run `npm test -- --runInBand` and record the result**
- [ ] **Step 2: Run `npm run lint` and record the result**
- [ ] **Step 3: Run `npx nest build` and record the result**
- [ ] **Step 4: Run `npx vite build` and record the result**
- [ ] **Step 5: Run `npm run test:deepseek` and record the real metadata**
- [ ] **Step 6: Stop local processes and verify ports are released**
