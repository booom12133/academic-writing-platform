# Phase D4 — Text Generation Provider Abstraction

Status: Design Spec only — implementation is not authorized by this document.

Date: 2026-09-03

Baseline: `main` at `cae059e656d17981e5f4bd0116a6c37ab2d9d04e`, with
`phase-d3-accepted` peeled to the same commit and the annotated tag object
`4fc4125920c6764723ed5079937bd08df204844f`.

Proposed formal phase: `Phase D4 — Text Generation Provider Abstraction`.
The phase remains subject to the project's normal implementation authorization,
review, acceptance, merge, and tag lifecycle.

## 1. Problem statement

The accepted application has an `LlmService` façade, but the façade injects and
delegates directly to the concrete `DeepSeekProvider`. The current generation
types are partly reusable, while health, result metadata, error text,
configuration, and several business output contracts still encode DeepSeek.

This is a material boundary problem before RAG / Zotero / Search work begins.
RAG will require a separate embedding capability and must not force generation
code or `DeepSeekProvider` to absorb embedding concerns.

D4 therefore introduces the smallest stable text-generation provider boundary,
keeps DeepSeek as the only production implementation, and preserves current
external behavior. It does not become a general provider platform.

## 2. Current-state evidence from accepted `main`

The current implementation provides the following evidence:

- `LlmService` imports `DeepSeekProvider`, injects it concretely, and forwards
  `generate()` and `checkHealth()` unchanged
  ([`server/modules/ai-tools/llm/llm.service.ts`](../../../server/modules/ai-tools/llm/llm.service.ts)).
- `AiToolsModule` registers `DeepSeekProvider` and `LlmService` as concrete
  providers ([`server/modules/ai-tools/ai-tools.module.ts`](../../../server/modules/ai-tools/ai-tools.module.ts)).
- Topic Generation, Polish, and Paper Revision inject `LlmService`; no
  production generator directly injects `DeepSeekProvider`.
- `DeepSeekProvider` owns the API key, base URL, model default, axios request,
  90-second timeout, response mapping, connectivity check, and provider-specific
  errors ([`server/modules/ai-tools/llm/deepseek.provider.ts`](../../../server/modules/ai-tools/llm/deepseek.provider.ts)).
- `LlmGenerateOptions`, `LlmGenerateResult`, and `LlmUsage` are partly neutral,
  but `LlmHealthResult.provider` is restricted to `'deepseek'`
  ([`server/modules/ai-tools/llm/llm.types.ts`](../../../server/modules/ai-tools/llm/llm.types.ts)).
- Topic Generation, Polish, Paper Revision, their executors, and aggregators
  write or require `provider: 'deepseek'` in result metadata.
- `AiToolsService` logs `provider=deepseek` for Topic Generation.
- `test:deepseek` intentionally instantiates `DeepSeekProvider` directly and
  remains an explicit adapter smoke test.
- The accepted D3 report confirms that LlmService and DeepSeekProvider were
  frozen and unchanged during D3, and that RAG, multi-provider support, and
  embeddings were out of scope
  ([`docs/reviews/PHASE_D3_FINAL_ACCEPTANCE_REPORT.md`](../../reviews/PHASE_D3_FINAL_ACCEPTANCE_REPORT.md)).

The real current flow is:

```text
TopicGenerationGenerator
  → LlmService
  → DeepSeekProvider
  → axios POST /chat/completions
  → DeepSeek API

PolishChunkExecutor / PaperRevisionChunkExecutor
  → PolishGenerator / PaperRevisionGenerator
  → LlmService
  → DeepSeekProvider
  → DeepSeek API

GET /api/ai-tools/llm/health
  → AiToolsController
  → LlmService.checkHealth()
  → DeepSeekProvider.checkConnectivity()
  → GET /models
```

## 3. Goals

1. Make `LlmService` depend on a capability-specific text-generation boundary,
   not on `DeepSeekProvider`.
2. Introduce the Nest injection token `TEXT_GENERATION_PROVIDER`.
3. Keep `DeepSeekProvider` as the only production implementation.
4. Make provider and model identity originate from the generation boundary.
5. Preserve `metadata.provider`, `metadata.model`, `metadata.usage`, and latency
   field names and current DeepSeek values.
6. Remove provider-specific validation from Polish and Paper Revision
   aggregators while retaining structural validation.
7. Keep `jsonMode` as the existing high-level semantic.
8. Keep DeepSeek's `thinking` wire behavior inside its adapter without exposing
   a generic reasoning framework.
9. Preserve health endpoint path, authentication behavior, and basic response
   shape.
10. Provide fake-provider tests that prove identity and result flow are truly
    decoupled from DeepSeek.
11. Keep D2 and D3 accepted behavior unchanged.

## 4. Non-goals

D4 will not implement or design production support for:

- OpenAI, Anthropic, Gemini, or local models;
- a provider router, registry, switch, failover, load balancing, or dynamic
  provider loading;
- user-selected providers or provider administration;
- `EmbeddingProvider`, embeddings, vector databases, retrieval, reranking,
  Zotero, or academic search;
- a generic reasoning/thinking capability framework;
- a generic provider error taxonomy/framework;
- Redis, BullMQ, queues, workers, retries, or concurrency redesign;
- billing redesign or usage-price calculation;
- health authentication changes;
- changes to the inherited `test/unit/platform-command.spec.ts` CI issue.

## 5. Target architecture

```text
Generator
  → LlmService
  → TEXT_GENERATION_PROVIDER
  → TextGenerationProvider
  → DeepSeekProvider
  → DeepSeek API
```

The provider boundary is a text-generation capability boundary. It is not a
unified AI provider interface and must not contain embedding methods.

## 6. TextGenerationProvider contract

The implementation should introduce a provider-neutral contract in the
`server/modules/ai-tools/llm` area. Exact file placement may follow the
repository's existing naming conventions, but the semantic contract is:

```ts
export interface TextGenerationProvider {
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
  checkHealth(): Promise<TextGenerationHealth>;
}

export interface TextGenerationRequest {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface TextGenerationResult {
  content: string;
  provider: string;
  model: string;
  usage?: LlmUsage;
}

export interface TextGenerationHealth {
  configured: boolean;
  provider: string;
  reachable: boolean;
  defaultModel: string;
  error?: string;
}
```

The existing `LlmMessage`, `LlmUsage`, and token-count semantics should be
reused or minimally aliased rather than duplicated. The provider identity is a
stable adapter-owned string. It is not a user-controlled request field.

`TextGenerationRequest` deliberately excludes `thinking`. The current
generators do not require a caller-selectable reasoning mode; the DeepSeek
adapter will preserve the current disabled-thinking wire behavior internally.

`jsonMode` remains a high-level request semantic. It means that the caller
requests JSON output; each adapter owns the wire mapping. D4 will not add a
capability registry or schema-output framework.

The contract does not standardize provider-specific HTTP errors. Adapter
errors may remain ordinary safe `Error` instances with provider-specific
handling inside the adapter. Business generators must use provider-neutral
messages for malformed structured output.

## 7. DI and token design

Introduce a Nest token named:

```ts
export const TEXT_GENERATION_PROVIDER = Symbol('TEXT_GENERATION_PROVIDER');
```

`LlmService` will inject the token:

```ts
constructor(
  @Inject(TEXT_GENERATION_PROVIDER)
  private readonly provider: TextGenerationProvider,
) {}
```

`LlmService.generate()` and `LlmService.checkHealth()` remain the stable
application-facing façade methods. The service adds no routing, fallback,
retry, or provider-specific transformation.

`AiToolsModule` will bind the token to `DeepSeekProvider`. The binding must be
explicit and local to the AI tools module. `LlmService` must no longer import
or inject `DeepSeekProvider` directly.

The health smoke module may continue to bind the DeepSeek adapter explicitly,
because `test:deepseek:health` is an operational DeepSeek smoke path rather
than a multi-provider runtime.

## 8. LlmService role

After D4, `LlmService` remains the application façade and lifecycle boundary:

- it exposes the existing `generate()` and `checkHealth()` methods;
- it depends only on `TEXT_GENERATION_PROVIDER`;
- it forwards neutral request/result/health contracts;
- it does not know DeepSeek URL, credentials, error statuses, wire fields,
  timeout, or retry behavior;
- it does not select among providers.

Keeping the name `LlmService` is intentional for compatibility. Renaming it to
`TextGenerationService` is out of scope.

## 9. DeepSeek adapter role

`DeepSeekProvider` remains the only production implementation and continues to
own:

- `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and
  `DEEPSEEK_DEFAULT_MODEL`;
- DeepSeek model defaults and the existing unused premium-model configuration;
- axios and the `/chat/completions` and `/models` endpoints;
- request field conversion such as `maxTokens` → `max_tokens`;
- `jsonMode` → `{ response_format: { type: 'json_object' } }`;
- the current internal `thinking: { type: 'disabled' }` behavior for migrated
  application calls;
- response content/model/usage mapping;
- 90-second timeout;
- safe provider-specific authentication, rate-limit, billing, timeout, and
  HTTP failure messages.

No provider-specific behavior moves upward into generators or `LlmService`.

## 10. Request, result, and identity design

Request identity is not supplied by the client or business generator. The
optional `model` request field remains available for the existing internal
semantics, but D4 does not add user-facing model selection.

The provider result is the authoritative source for:

```text
provider → result.provider
model    → result.model
usage    → result.usage
```

Generators copy these values into the existing public/task metadata names:

```text
metadata.provider ← result.provider
metadata.model    ← result.model
metadata.usage    ← result.usage
```

With the current binding, the externally observable provider remains exactly
`"deepseek"`. A fake provider may return another identity in tests, and the
identity must propagate without generator or aggregator rejection.

The no-executed-chunk fallback used by direct aggregator tests may retain the
legacy DeepSeek-compatible default solely for backward compatibility. It is not
valid production generation identity; every successful generated result must
derive provider and model from `TextGenerationResult`.

## 11. `jsonMode` treatment

`jsonMode?: boolean` remains in the provider-neutral request because it is the
smallest compatibility-preserving semantic already used by the three current
LLM-backed generators.

The contract does not promise identical JSON enforcement across future
providers. The adapter is responsible for mapping or ignoring the semantic
according to its own API. D4 only implements and tests the existing DeepSeek
mapping and keeps Zod/JSON validation in the generators.

## 12. `thinking` treatment

No generic `thinking`, `reasoning`, or model-capability framework will be added.

The current generators' behavior is effectively `thinking: false`. D4 removes
that provider-specific wire option from the neutral request and preserves the
current DeepSeek request behavior inside `DeepSeekProvider`. This prevents
DeepSeek's `thinking` object shape from becoming a cross-provider contract.

## 13. Health compatibility

Health is provider-neutral internally but backward compatible externally.

The following must not change:

- `GET /api/ai-tools/llm/health`;
- route authentication behavior;
- `configured`, `provider`, `reachable`, `defaultModel`, and optional `error`;
- the current externally observable provider value `"deepseek"`;
- the existing DeepSeek `/models` connectivity behavior.

The controller need not gain provider selection or health aggregation. It
continues to call `LlmService.checkHealth()`.

## 14. Generator migration

Only the three current class-based LLM consumers are in scope:

- `TopicGenerationGenerator`;
- `PolishGenerator`;
- `PaperRevisionGenerator`.

They will continue to inject `LlmService` and retain their prompt construction,
JSON/Zod validation, academic safeguards, and retry behavior. They will stop
hardcoding `provider: 'deepseek'` and instead copy provider/model/usage from the
generation result.

Business-level malformed-output errors will no longer say “DeepSeek returned
invalid JSON”. They will describe invalid structured output without naming the
provider. DeepSeek transport/auth/rate-limit/billing/timeout errors remain
inside the adapter.

The old function-based generators that do not use `LlmService` are not
refactored as part of D4.

## 15. D2/D3 aggregator compatibility

D4 may touch only the provider metadata validation needed for neutrality in:

- `PolishResultAggregator`;
- `PaperRevisionResultAggregator`;
- their local chunk-output contracts.

The aggregators must no longer require `provider === 'deepseek'`. They must
continue to require structurally valid metadata:

- provider is a non-empty string;
- model is a non-empty string;
- latency is a number;
- existing output fields remain valid;
- usage continues to come from the D1 aggregate.

Provider and model still come from the first successful executed chunk, as in
the accepted D3 behavior. References remain pass-through and never produce
provider metadata. Chunk order, source boundaries, validation, warnings,
latency summation, usage aggregation, first-error stop, task lifecycle,
billing, and result field names remain unchanged.

## 16. Error-boundary decision

D4 will not create a generic provider error taxonomy.

The boundary is:

```text
DeepSeek HTTP/auth/rate-limit/billing/timeout failure
  → handled and safely summarized inside DeepSeekProvider

Malformed JSON or schema-invalid model content
  → handled by the business generator as provider-neutral structured-output failure
```

This preserves the current safe error behavior without allowing provider names
to leak into generator-owned validation messages.

## 17. Configuration and deployment compatibility

Existing DeepSeek deployment configuration remains authoritative:

```text
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_DEFAULT_MODEL
DEEPSEEK_PREMIUM_MODEL
```

D4 will not introduce `LLM_GENERATION_PROVIDER`, runtime provider switches, or
new provider credentials. Direct DeepSeek-specific environment access may
remain infrastructure-local. Migration to `ConfigService` is not required.

The only runtime binding change is that the module binds
`TEXT_GENERATION_PROVIDER` to the existing `DeepSeekProvider`. Production
requests, API endpoints, model defaults, timeout, and external API behavior
remain unchanged.

## 18. Precise allowed production touch surface

If implementation is separately authorized, production changes are limited to
the following surface:

1. `server/modules/ai-tools/llm/llm.types.ts` and/or new provider-boundary
   type/token files under `server/modules/ai-tools/llm/`;
2. `server/modules/ai-tools/llm/llm.service.ts`;
3. `server/modules/ai-tools/llm/deepseek.provider.ts`;
4. `server/modules/ai-tools/ai-tools.module.ts`;
5. `server/modules/ai-tools/generators/topic-generation.generator.ts`;
6. `server/modules/ai-tools/generators/polish.generator.ts`;
7. `server/modules/ai-tools/generators/paper-revision.generator.ts`;
8. `server/modules/ai-tools/polish/polish-input.types.ts` and
   `polish-result.aggregator.ts`;
9. `server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.ts`;
10. `server/modules/ai-tools/ai-tools.service.ts`, only to remove the
    provider-specific log literal if required by the new metadata contract.

No frontend, shared API, task, billing, database, document, skills, queue, or
retrieval file may be changed by D4 unless a later explicit review expands the
scope.

## 19. Frozen paths

The following remain frozen:

- C1, C2, C3, C4, and D1 foundations;
- accepted D2 Polish behavior;
- accepted D3 Paper Revision behavior;
- `TasksService`, points, orders, and database schema;
- B1 skills/runtime and academic safeguards;
- shared API contracts;
- unrelated frontend behavior;
- historical acceptance reports;
- the inherited `test/unit/platform-command.spec.ts` fixture and CI issue.

D4 must not alter chunking, reference pass-through, sequential execution,
first-error stop, preparation-before-billing, requirements propagation,
validation, warnings, usage aggregation, task lifecycle, or result structure.

## 20. Backward-compatibility invariants

The implementation must preserve:

1. `LlmService` class name and `generate()` / `checkHealth()` methods.
2. `metadata.provider`, `metadata.model`, `metadata.usage`, and latency fields.
3. External provider value `"deepseek"` under the current module binding.
4. Existing DeepSeek environment variable names and meanings.
5. DeepSeek endpoint, request mapping, response mapping, timeout, and safe
   provider error behavior.
6. `GET /api/ai-tools/llm/health`, authentication behavior, and basic response
   shape.
7. `jsonMode` behavior for current generators.
8. Current structured-output validation and Topic Generation's single retry.
9. D2/D3 public/task result structure and execution semantics.
10. Zero executor/generator/LLM calls for References pass-through.
11. No new external calls in unit, integration, or regression tests.

## 21. Fake-provider testing strategy

Add a fake `TextGenerationProvider` seam in tests. The fake must return a
non-DeepSeek identity, for example `provider: 'fake-generation'` and
`model: 'fake-model'`, together with deterministic content and usage.

Tests must prove end to end that:

- `TEXT_GENERATION_PROVIDER` resolves the fake provider;
- `LlmService` forwards the request to the fake provider;
- Topic Generation, Polish, and Paper Revision receive and propagate the fake
  provider/model identity;
- Polish and Paper Revision aggregators accept the fake identity when metadata
  is structurally valid;
- no business generator imports or instantiates `DeepSeekProvider`;
- no aggregator rejects a valid provider merely because it is not DeepSeek.

Existing unit tests should retain their focused prompt, schema, safeguard,
chunk, and aggregation assertions. Test doubles should use the boundary/token
rather than relying on concrete-provider casts wherever D4 touches the seam.

## 22. DeepSeek adapter testing strategy

Retain and adapt the existing adapter tests to cover:

- configured model and Authorization header;
- `/chat/completions` URL and request body mapping;
- `jsonMode` mapping;
- internal disabled-thinking wire behavior;
- normal content and usage mapping;
- empty response handling;
- missing key handling;
- authentication, rate-limit, billing, timeout, and generic status handling;
- `/models` health behavior;
- 90-second timeout preservation.

`test:deepseek` and `test:deepseek:health` remain explicit DeepSeek adapter
smokes. They do not need to become provider-neutral or run without an
authorized key.

## 23. Regression strategy

After separate implementation authorization, the candidate must run:

- focused LLM/provider, generator, aggregator, and module tests;
- `npm test -- --runInBand`;
- `npm run lint`;
- `npm run type:check`;
- `npm run build:server`;
- `npm run build:client`;
- `npm run test:app-bootstrap`.

No live DeepSeek call is part of ordinary regression. Any explicit smoke call
requires an authorized key and must be recorded separately. The inherited
Linux/Windows `platform-command.spec.ts` failure remains documented and out of
scope.

## 24. Migration risks

- Existing task results may already contain `metadata.provider: 'deepseek'` and
  must remain readable.
- Removing literal provider checks must not weaken model/provider metadata
  validation.
- Removing `thinking` from the neutral request must not accidentally enable
  DeepSeek thinking for current application calls.
- `jsonMode` has different support levels across hypothetical future providers;
  D4 must not promise more than the current semantic.
- Optional provider usage must continue to aggregate as the existing D1 logic
  expects.
- Generator error text changes must remain compatible with task failure
  handling even though provider names are removed.
- DI test modules and bootstrap paths must bind the token correctly.
- Direct adapter smoke tests must remain valid while application code uses the
  token boundary.
- The stale lower `PROJECT_STATE.md` test-baseline text must not be mistaken
  for a D3 rollback or reopened phase.

## 25. Explicit out-of-scope paths and behaviors

No implementation may add or modify:

- any second provider;
- embedding or reranking capability;
- RAG/Zotero/Search;
- queues, workers, Redis, or BullMQ;
- provider selection or routing configuration;
- failover, load balancing, provider registry, or dynamic loading;
- billing or task lifecycle semantics;
- frontend behavior unrelated to the provider metadata contract;
- the inherited platform-command CI fixture.

## 26. Acceptance criteria

D4 can become a Review Candidate only if all of the following are true:

1. `LlmService` has no concrete `DeepSeekProvider` dependency.
2. `TEXT_GENERATION_PROVIDER` is the sole production binding seam.
3. `DeepSeekProvider` is the only production implementation.
4. Provider/model identity for successful generation comes from the generation
   result, not generator hardcoding.
5. Polish and Paper Revision aggregators validate metadata structurally and
   accept a valid fake provider identity.
6. `jsonMode` remains compatible and `thinking` remains adapter-local.
7. Health endpoint path, authentication behavior, response shape, and current
   `"deepseek"` value are unchanged.
8. Existing DeepSeek configuration and wire behavior are preserved.
9. D2/D3 execution, billing, validation, aggregation, references, usage, task,
   and result invariants remain unchanged.
10. Fake-provider tests demonstrate end-to-end decoupling.
11. DeepSeek adapter tests cover the preserved HTTP/config/error behavior.
12. Focused tests, full regression, lint, type-check, builds, and bootstrap
    checks pass, subject only to the documented inherited CI issue.
13. No EmbeddingProvider, RerankProvider, second provider, router, registry,
    or provider platform is introduced.
14. Only the allowed production touch surface is modified.

## 27. Design review boundary

This document authorizes no implementation. The next governance transition is
only:

```text
Design Spec review
→ PHASE_D4_DESIGN_REVIEW_PASS
→ separately authorized Implementation Plan
→ separately authorized implementation branch
```

Until `PHASE_D4_DESIGN_REVIEW_PASS` is explicitly issued, no Implementation
Plan, branch, production change, test change, push, PR, or Phase acceptance is
authorized.
