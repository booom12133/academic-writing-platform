# Phase D4 — Text Generation Provider Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the accepted application's text-generation dependency from concrete DeepSeek injection to the TEXT_GENERATION_PROVIDER boundary while preserving DeepSeek behavior and every D2/D3 contract.

**Architecture:** LlmService remains the application façade and injects only TEXT_GENERATION_PROVIDER. AiToolsModule binds that token with { provide: TEXT_GENERATION_PROVIDER, useClass: DeepSeekProvider }; DeepSeek remains the only production implementation. The neutral request excludes thinking, while DeepSeekProvider emits the disabled-thinking wire body internally.

**Tech Stack:** NestJS 10, TypeScript 5.9, Jest 29 with ts-jest, axios, Nest testing utilities, npm scripts from package.json.

**Spec:** docs/superpowers/specs/2026-09-03-phase-d4-text-generation-provider-abstraction-design.md

## Global Constraints

- Do not begin implementation until ChatGPT separately returns PHASE_D4_PLAN_REVIEW_PASS and PHASE_D4_IMPLEMENTATION_AUTHORIZED.
- After implementation authorization, verify origin/main and local main are exactly cae059e656d17981e5f4bd0116a6c37ab2d9d04e before creating a branch.
- Create the D4 branch from that accepted SHA; do not develop on main.
- The first D4 branch commit must be docs-only and contain both the approved Design Spec and this final Plan.
- Every production commit must run npm run type:check:server before commit.
- Keep LlmService; do not rename it.
- Use TEXT_GENERATION_PROVIDER as the sole production generation binding seam.
- The production binding is exactly { provide: TEXT_GENERATION_PROVIDER, useClass: DeepSeekProvider }; do not directly register DeepSeekProvider as an additional production provider.
- LlmService must not import DeepSeekProvider.
- DeepSeekProvider remains the only production provider. The fake provider exists only inside tests.
- Preserve DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_PREMIUM_MODEL, DeepSeek wire behavior, the 90-second timeout, safe provider errors, and current health behavior.
- Keep jsonMode as the high-level neutral semantic; do not add a capability registry or schema-output framework.
- Remove thinking from the neutral request; preserve thinking: { type: 'disabled' } inside DeepSeekProvider.
- Do not add generic reasoning, provider-error, routing, registry, failover, load-balancing, dynamic-loading, or runtime provider-switch frameworks.
- Do not implement OpenAI, Anthropic, Gemini, local models, EmbeddingProvider, RerankProvider, RAG, Zotero, Search, Redis, BullMQ, queues, workers, or billing changes.
- Do not refactor PolishChunkExecutor or PaperRevisionChunkExecutor.
- Preserve D2/D3 chunking, References pass-through, sequential execution, first-error stop, billing, validation, warnings, usage aggregation, requirements propagation, task lifecycle, and public result structure.
- Do not fix test/unit/platform-command.spec.ts.
- Do not modify ROADMAP.md, historical acceptance reports, or the stale lower PROJECT_STATE.md D2 test-baseline subsection during implementation.
- Ordinary regression must make zero external DeepSeek calls. Do not run npm run test:deepseek as part of ordinary regression.

## File Map

### Create

- server/modules/ai-tools/llm/text-generation.provider.ts — TextGenerationProvider interface and TEXT_GENERATION_PROVIDER token.
- server/modules/ai-tools/llm/llm.service.spec.ts — real LlmService delegation through a fake provider and token-binding tests.
- server/modules/ai-tools/llm/d4-provider-decoupling.integration.spec.ts — real LlmService plus fake-provider traversal through Topic Generation, Polish, and Paper Revision.

### Modify

- server/modules/ai-tools/llm/llm.types.ts — neutral request/result/health types and compatibility aliases without thinking.
- server/modules/ai-tools/llm/llm.service.ts — token-only injection and delegation.
- server/modules/ai-tools/llm/deepseek.provider.ts — TextGenerationProvider implementation, provider identity, internal disabled-thinking wire behavior.
- server/modules/ai-tools/llm/deepseek.provider.spec.ts — adapter contract, identity, jsonMode, disabled thinking, usage, health, timeout, and safe errors.
- server/modules/ai-tools/ai-tools.module.ts — sole production token binding.
- server/modules/ai-tools/ai-tools.module.spec.ts — production binding assertion.
- server/modules/ai-tools/generators/topic-generation.generator.ts and topic-generation.generator.spec.ts — neutral identity, request, and error handling.
- server/modules/ai-tools/generators/polish.generator.ts and polish.generator.spec.ts — neutral identity, request, and error handling.
- server/modules/ai-tools/generators/paper-revision.generator.ts and paper-revision.generator.spec.ts — neutral identity, request, and error handling.
- server/modules/ai-tools/ai-tools.service.ts — log returned provider identity.
- server/modules/ai-tools/polish/polish-input.types.ts — provider-neutral chunk metadata type.
- server/modules/ai-tools/polish/polish-result.aggregator.ts and polish-result.aggregator.spec.ts — structural metadata validation and non-DeepSeek acceptance.
- server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.ts and paper-revision-result.aggregator.spec.ts — structural metadata validation and non-DeepSeek acceptance.
- scripts/test-deepseek.ts — remove thinking: false from the neutral request.
- scripts/test-deepseek-health.ts — bind TEXT_GENERATION_PROVIDER to DeepSeekProvider.

### Explicitly unchanged

- server/modules/ai-tools/polish/polish-chunk.executor.ts
- server/modules/ai-tools/paper-revision/paper-revision-chunk.executor.ts
- server/modules/ai-tools/ai-tools.controller.ts
- .env.example
- shared/api.interface.ts
- server/modules/tasks/**
- server/modules/document-input/**
- server/modules/document-parsing/**
- server/modules/context-builder/**
- server/modules/chunking/**
- PROJECT_STATE.md, ROADMAP.md, and historical acceptance reports during implementation
- test/unit/platform-command.spec.ts

## TDD and commit rules

Each implementation task writes the smallest behavior test first, runs the focused test to record the expected red failure, makes the minimal change, reruns the focused test, runs the task regression, runs server type-check for every production change, then commits one reviewable purpose.

The early migration is intentionally one atomic production commit. This prevents an intermediate green commit from leaving the repository type-broken while the neutral request, DeepSeek adapter, service injection, module binding, and smoke compatibility are being migrated together.

All commands below are run from D:\学术写作辅助平台 after the D4 branch and docs-only baseline exist.

## Task 0: Authorized baseline and docs-only governance commit

**Files:**

- Add to the new D4 branch: docs/superpowers/specs/2026-09-03-phase-d4-text-generation-provider-abstraction-design.md
- Add to the new D4 branch: docs/superpowers/plans/2026-09-03-phase-d4-text-generation-provider-abstraction-plan.md
- No production or test file may be included.

**Interfaces:**

- Consumes the accepted main SHA cae059e656d17981e5f4bd0116a6c37ab2d9d04e.
- Produces a D4 branch whose first commit is governance evidence only.

- [ ] Step 1: Verify authorization and accepted baseline

Run:

    git status --short
    git branch --show-current
    git rev-parse main
    git rev-parse origin/main
    git remote -v
    git config --local --get http.version
    git ls-remote origin refs/heads/main refs/tags/phase-d3-accepted 'refs/tags/phase-d3-accepted^{}'

Expected: implementation authorization is present; main and origin/main both equal cae059e656d17981e5f4bd0116a6c37ab2d9d04e; origin is the project repository; http.version is HTTP/1.1; phase-d3-accepted peels to the same SHA. Stop if any value differs.

- [ ] Step 2: Create the D4 phase branch from accepted main

Run:

    git switch main
    git switch -c phase/d4-text-generation-provider-abstraction

Expected: the new branch starts at the verified accepted SHA. Do not change any production or test file.

- [ ] Step 3: Add only the approved Design Spec and final Plan

Stage only:

    docs/superpowers/specs/2026-09-03-phase-d4-text-generation-provider-abstraction-design.md
    docs/superpowers/plans/2026-09-03-phase-d4-text-generation-provider-abstraction-plan.md

Expected: the staged file list contains exactly those two paths.

- [ ] Step 4: Verify the baseline is docs-only

Run:

    git diff --cached --name-only
    git diff --cached --name-only -- server test shared
    git diff --cached --check

Expected: exactly the two docs paths are listed; the production/test/shared filtered list is empty; formatting check is clean.

- [ ] Step 5: Create the docs-only baseline commit

Proposed commit:

    docs(d4): record approved design and implementation plan

This is the only commit before TDD implementation. Do not include production code, tests, build output, coverage, secrets, PROJECT_STATE.md, or ROADMAP.md.

## Task 1: Atomically establish the token-backed generation seam

**Files:**

- Create: server/modules/ai-tools/llm/text-generation.provider.ts
- Create: server/modules/ai-tools/llm/llm.service.spec.ts
- Modify: server/modules/ai-tools/llm/llm.types.ts
- Modify: server/modules/ai-tools/llm/llm.service.ts
- Modify: server/modules/ai-tools/llm/deepseek.provider.ts
- Modify: server/modules/ai-tools/llm/deepseek.provider.spec.ts
- Modify: server/modules/ai-tools/ai-tools.module.ts
- Modify: server/modules/ai-tools/ai-tools.module.spec.ts
- Modify: scripts/test-deepseek.ts
- Modify: scripts/test-deepseek-health.ts

**Interfaces:**

- TextGenerationRequest has messages, model, temperature, maxTokens, and jsonMode; it has no thinking field.
- TextGenerationResult has content, provider, model, and optional usage.
- TextGenerationHealth has configured, provider, reachable, defaultModel, and optional error.
- TextGenerationProvider has generate(request) and checkHealth().
- LlmService injects only TEXT_GENERATION_PROVIDER.
- AiToolsModule binds exactly one production token provider with useClass: DeepSeekProvider.
- DeepSeekProvider returns provider: 'deepseek' and emits disabled thinking internally.
- Smoke scripts compile against the new seam; test-deepseek remains a direct adapter smoke and test-deepseek-health uses the token.

- [ ] Step 1: Write the red tests before changing production code

Add to llm.service.spec.ts a Nest testing module with a deterministic fake provider:

    const fakeProvider: TextGenerationProvider = {
      generate: jest.fn().mockResolvedValue({
        content: '{"ok":true}',
        provider: 'fake-generation',
        model: 'fake-model',
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
      }),
      checkHealth: jest.fn().mockResolvedValue({
        configured: true,
        provider: 'fake-generation',
        reachable: true,
        defaultModel: 'fake-model',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: TEXT_GENERATION_PROVIDER, useValue: fakeProvider },
        LlmService,
      ],
    }).compile();

Assert that the real LlmService returns the fake generation result and health
result, and that fakeProvider.generate/checkHealth each receive exactly one
call.

In ai-tools.module.spec.ts, inspect the module provider metadata and assert:

    { provide: TEXT_GENERATION_PROVIDER, useClass: DeepSeekProvider }

Also assert that DeepSeekProvider is not separately present in the production
provider list.

In deepseek.provider.spec.ts, remove thinking: false from the neutral request,
require provider: 'deepseek' in the result, and require the exact outbound body
to contain:

    thinking: { type: 'disabled' }

Keep assertions for jsonMode, usage, missing key, empty content, 401/403, 429,
billing, timeout, generic status, and health.

Expected red failure on accepted production code: the token/interface are
missing, LlmService still injects DeepSeekProvider, the module has no token
binding, DeepSeekProvider reads options.thinking, and its result lacks provider.

- [ ] Step 2: Run the red tests

Run:

    npx jest server/modules/ai-tools/llm/llm.service.spec.ts server/modules/ai-tools/llm/deepseek.provider.spec.ts server/modules/ai-tools/ai-tools.module.spec.ts --runInBand

Expected: FAIL in the new delegation/binding/adapter assertions. Axios remains
mocked; no external request is allowed.

- [ ] Step 3: Add the neutral types, interface, and token

In llm.types.ts, define the neutral contracts and keep existing Llm names as
aliases only where current imports require them. The aliases must not reintroduce
thinking.

In text-generation.provider.ts, define:

    export const TEXT_GENERATION_PROVIDER = Symbol('TEXT_GENERATION_PROVIDER');

    export interface TextGenerationProvider {
      generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
      checkHealth(): Promise<TextGenerationHealth>;
    }

Do not add embedding, reranking, reasoning, capability registry, or generic
error types.

- [ ] Step 4: Make LlmService token-only

Remove the DeepSeekProvider import. Inject TEXT_GENERATION_PROVIDER with
Nest Inject and delegate generate and checkHealth without routing, retry,
fallback, or provider-specific transformation.

- [ ] Step 5: Adapt DeepSeekProvider minimally

Make DeepSeekProvider implement TextGenerationProvider. Keep all current
DeepSeek environment reads, endpoints, headers, request conversion, usage
mapping, safe errors, logger, and 90-second timeout.

Return provider: 'deepseek'. Remove thinking from the neutral input and emit
thinking: { type: 'disabled' } inside the adapter for current generation calls.
Map jsonMode exactly as before. Implement the interface's checkHealth while
preserving the current health response fields and values.

- [ ] Step 6: Bind the production module and smoke scripts

In AiToolsModule, replace the direct DeepSeekProvider provider entry with:

    {
      provide: TEXT_GENERATION_PROVIDER,
      useClass: DeepSeekProvider,
    }

Do not retain a separate DeepSeekProvider entry.

Remove thinking: false from scripts/test-deepseek.ts. In
scripts/test-deepseek-health.ts, remove the direct DeepSeekProvider provider
entry and add the same token useClass binding. Do not change smoke output,
endpoint, or authentication semantics.

- [ ] Step 7: Run focused green tests and global type checks

Run:

    npx jest server/modules/ai-tools/llm server/modules/ai-tools/ai-tools.module.spec.ts --runInBand
    npm run type:check:server
    npx tsc --noEmit --project tsconfig.smoke.json

Expected: all focused tests and both type-check commands pass. This is the
first green state and it must be globally type-valid for production and smoke
scripts before commit.

- [ ] Step 8: Commit the atomic seam

Proposed commit:

    feat(d4): establish token-backed generation boundary

The commit must include all Task 1 files and no generator, aggregator, executor,
frontend, shared, task, billing, database, or unrelated file.

## Task 2: Prove real LlmService traversal and migrate generators

**Files:**

- Create: server/modules/ai-tools/llm/d4-provider-decoupling.integration.spec.ts
- Modify: server/modules/ai-tools/generators/topic-generation.generator.ts
- Modify: server/modules/ai-tools/generators/topic-generation.generator.spec.ts
- Modify: server/modules/ai-tools/generators/polish.generator.ts
- Modify: server/modules/ai-tools/generators/polish.generator.spec.ts
- Modify: server/modules/ai-tools/generators/paper-revision.generator.ts
- Modify: server/modules/ai-tools/generators/paper-revision.generator.spec.ts
- Modify: server/modules/ai-tools/ai-tools.service.ts

**Interfaces:**

- The integration test obtains the real LlmService from a Nest test module bound
  to the deterministic fake TextGenerationProvider.
- TopicGenerationGenerator, PolishGenerator, and PaperRevisionGenerator receive
  that real LlmService instance.
- Each generator copies provider/model/usage from TextGenerationResult.
- Each request retains jsonMode where currently used and contains no thinking.
- Generator malformed-output errors do not contain DeepSeek.

- [ ] Step 1: Write the red integration test

Create one focused integration spec that binds:

    { provide: TEXT_GENERATION_PROVIDER, useValue: fakeProvider }
    LlmService

Obtain LlmService from the compiled testing module. Construct each of the three
real generators with that same LlmService and the existing deterministic skill
composer/registry/validator test doubles used by their unit suites.

Use a fake response containing valid JSON for each generator and assert:

    fake TextGenerationProvider
      → real LlmService
      → TopicGenerationGenerator
      → metadata.provider === 'fake-generation'

    fake TextGenerationProvider
      → real LlmService
      → PolishGenerator
      → metadata.provider === 'fake-generation'

    fake TextGenerationProvider
      → real LlmService
      → PaperRevisionGenerator
      → metadata.provider === 'fake-generation'

Also assert each fake call receives the expected prompt request, jsonMode true,
and no thinking property. The fake returns model fake-model and deterministic
usage; assert both model and usage propagate.

Expected red failure: current generators hardcode provider: 'deepseek', still
pass thinking: false, and the current result types do not expose the fake
identity through their metadata.

- [ ] Step 2: Run the integration red test

Run:

    npx jest server/modules/ai-tools/llm/d4-provider-decoupling.integration.spec.ts --runInBand

Expected: FAIL at provider identity and no-thinking assertions, while the
earlier real-service seam remains green.

- [ ] Step 3: Update generator unit tests to characterize the migration

Change the three existing generator test doubles to include provider:
'fake-generation'. Retain their prompt, schema, retry, and safeguard assertions.
Add provider-neutral malformed JSON assertions for Polish, Paper Revision, and
Topic Generation. The Topic Generation single retry remains exactly one retry.

Expected: the new metadata assertions and provider-neutral error assertions are
red before production migration. Existing tests that characterize current
DeepSeek output may be updated only to reflect identity now supplied by the fake.

- [ ] Step 4: Migrate generator output identity and request fields

In all three generators, change provider metadata to a non-empty string and copy
response.provider, response.model, and response.usage. Remove thinking: false
from all neutral requests. Keep prompts, Zod schemas, academic safeguards,
retry count, requirements, source text, and validation unchanged.

Replace provider-named malformed-output messages with generator-owned messages
such as invalid academic polish JSON, invalid academic revision JSON, and
invalid structured output.

In AiToolsService, log generated.metadata.provider instead of provider=deepseek.
Do not change task lifecycle or result persistence.

- [ ] Step 5: Run the integration and generator suites green

Run:

    npx jest server/modules/ai-tools/llm/d4-provider-decoupling.integration.spec.ts server/modules/ai-tools/generators/topic-generation.generator.spec.ts server/modules/ai-tools/generators/polish.generator.spec.ts server/modules/ai-tools/generators/paper-revision.generator.spec.ts --runInBand

Expected: PASS for all three real-service traversal paths, fake identity/model/usage
propagation, jsonMode, absence of thinking, provider-neutral errors, existing
retry, and academic safeguards.

- [ ] Step 6: Run production type-check before the generator commit

Run:

    npm run type:check:server

Expected: exit code 0.

- [ ] Step 7: Commit the generator migration

Proposed commit:

    feat(d4): propagate generation provider identity

Do not modify either chunk executor.

## Task 3: Make D2/D3 aggregators provider-neutral

**Files:**

- Modify: server/modules/ai-tools/polish/polish-input.types.ts
- Modify: server/modules/ai-tools/polish/polish-result.aggregator.ts
- Modify: server/modules/ai-tools/polish/polish-result.aggregator.spec.ts
- Modify: server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.ts
- Modify: server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts

**Interfaces:**

- Existing metadata names remain provider, model, and latencyMs.
- Valid provider and model values are non-empty strings.
- D1 usage aggregation, source provenance, References pass-through, validation,
  warnings, latency, and all D2/D3 result fields remain unchanged.

- [ ] Step 1: Add the red non-DeepSeek acceptance tests

In both aggregator suites, change a valid executed fixture to:

    metadata: {
      provider: 'fake-generation',
      model: 'fake-model',
      latencyMs: 5,
    }

Assert the aggregate preserves fake-generation and fake-model. These tests fail
against the current provider === 'deepseek' guards.

- [ ] Step 2: Add structural negative tests

In each aggregator suite, add empty provider and empty model cases and assert the
existing invalid chunk output error. Keep the existing malformed-output tests.
The empty-value cases may already throw on accepted main; retain them as
structural validation invariants and ensure the implementation no longer relies
on provider identity.

- [ ] Step 3: Run the aggregator red tests

Run:

    npx jest server/modules/ai-tools/polish/polish-result.aggregator.spec.ts server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts --runInBand

Expected: valid fake metadata cases fail before implementation. No network call
is possible in these pure aggregation tests.

- [ ] Step 4: Replace literal guards with structural checks

In both aggregators and their local metadata types, require:

    typeof provider === 'string' && provider.trim().length > 0
    typeof model === 'string' && model.trim().length > 0
    typeof latencyMs === 'number'

Remove only provider === 'deepseek' requirements. Do not change join logic,
trusted provenance, pass-through, warnings, validation flattening, usage, or
latency aggregation.

- [ ] Step 5: Run aggregator tests and server type-check green

Run:

    npx jest server/modules/ai-tools/polish/polish-result.aggregator.spec.ts server/modules/ai-tools/paper-revision/paper-revision-result.aggregator.spec.ts --runInBand
    npm run type:check:server

Expected: PASS, including fake identity acceptance, empty-value rejection,
provenance protection, References pass-through, usage, warnings, and validation.

- [ ] Step 6: Commit aggregator neutrality

Proposed commit:

    feat(d4): accept provider-neutral chunk metadata

## Task 4: Preserve D2/D3 regressions and audit the frozen surface

**Files:**

- No new files.
- No production file changes.
- No test changes are planned.

- [ ] Step 1: Run the D4-focused regression

Run:

    npx jest server/modules/ai-tools/llm server/modules/ai-tools/generators/topic-generation.generator.spec.ts server/modules/ai-tools/generators/polish.generator.spec.ts server/modules/ai-tools/generators/paper-revision.generator.spec.ts server/modules/ai-tools/polish server/modules/ai-tools/paper-revision server/modules/ai-tools/ai-tools.module.spec.ts --runInBand

Expected: PASS with no external call.

- [ ] Step 2: Run the existing D2/D3 migration suites directly

Run:

    npx jest server/modules/ai-tools/polish server/modules/ai-tools/paper-revision server/modules/ai-tools/ai-tools.service.spec.ts test/unit/polish-migration-client.spec.ts test/unit/paper-revision-migration-client.spec.ts --runInBand

Expected: PASS with unchanged preparation, chunking, References pass-through,
sequential execution, first-error stop, billing, validation, warnings, usage,
requirements, task lifecycle, and result structure.

- [ ] Step 3: Audit imports, bindings, and frozen files

Run:

    rg -n "DeepSeekProvider|TEXT_GENERATION_PROVIDER|thinking|provider === 'deepseek'|provider: 'deepseek'" server/modules/ai-tools scripts
    git diff --name-only
    git status --short

Expected:

- LlmService has no DeepSeekProvider import.
- AiToolsModule contains exactly the token useClass binding and no separate direct DeepSeek provider entry.
- DeepSeekProvider appears only in its adapter, token binding, explicit adapter tests, and smoke scripts.
- Neutral request types and generators contain no thinking field.
- Aggregators contain no provider === 'deepseek' guard.
- Both chunk executors and all frozen paths are unchanged.
- No secrets, build output, coverage, or temporary files are present.

- [ ] Step 4: Run server type-check after all production changes

Run:

    npm run type:check:server

Expected: exit code 0.

## Task 5: Final regression and zero-external-call verification

**Files:**

- No additional files planned.
- PROJECT_STATE.md is updated only during the Review Candidate governance step after all checks.

- [ ] Step 1: Run focused provider and migration suites

Run:

    npx jest server/modules/ai-tools/llm server/modules/ai-tools/generators/topic-generation.generator.spec.ts server/modules/ai-tools/generators/polish.generator.spec.ts server/modules/ai-tools/generators/paper-revision.generator.spec.ts server/modules/ai-tools/polish server/modules/ai-tools/paper-revision server/modules/ai-tools/ai-tools.module.spec.ts --runInBand

Expected: PASS. Axios is mocked in adapter tests and the fake provider is
deterministic.

- [ ] Step 2: Run full local regression

Run:

    npm test -- --runInBand

Expected: local suites pass. The known GitHub Linux-only inherited
test/unit/platform-command.spec.ts fixture issue remains unchanged and is not
a D4 failure target.

- [ ] Step 3: Run lint and both type-check projects

Run:

    npm run lint
    npm run type:check
    npx tsc --noEmit --project tsconfig.smoke.json

Expected: all commands exit 0. The smoke project command, not tsconfig.node.json,
validates scripts/test-deepseek.ts and scripts/test-deepseek-health.ts.

- [ ] Step 4: Run builds and AppModule bootstrap

Run:

    npm run build:server
    npm run build:client
    npm run test:app-bootstrap

Expected: all commands exit 0; existing non-blocking client module-type/chunk-size
warnings may remain; bootstrap resolves the token binding without a DeepSeek call.

- [ ] Step 5: Do not run the live DeepSeek smoke in ordinary regression

Do not run npm run test:deepseek or npm run test:deepseek:health as part of the
ordinary D4 regression. Their compatibility is proven by tsconfig.smoke.json,
mocked DeepSeek adapter tests, the token-binding unit test, and AppModule
bootstrap. A real smoke remains separately authorized only.

If a separately authorized smoke is later requested, start a dedicated subprocess
with the intended key explicitly supplied and record that it is outside ordinary
regression. Never rely on the ambient environment.

- [ ] Step 6: Verify zero external calls and exact scope

Run:

    git diff --check
    git diff --name-only
    git status --short
    rg -n "axios\.(get|post)|fetch\(" server/modules/ai-tools scripts

Expected:

- formatting check is clean;
- changed files are limited to the File Map plus explicitly required
  Review Candidate governance metadata;
- HTTP call sites remain limited to the existing adapter and explicit smoke
  scripts;
- no ordinary test or build command made an external DeepSeek call;
- no out-of-scope provider, embedding, retrieval, queue, billing, health-auth,
  or inherited-CI change exists.

## Task 6: Review Candidate governance and GitHub delivery

**Files:**

- Modify: PROJECT_STATE.md only for the required Review Candidate evidence.
- No ROADMAP.md, historical report, production, test, or frontend change.

- [ ] Step 1: Record Review Candidate evidence

Update only the current-development/candidate section of PROJECT_STATE.md with
the D4 branch, candidate commit, focused/full test results, lint, type-check,
build, bootstrap, zero-call evidence, frozen-path audit, and known inherited
CI issue. Do not mark D4 accepted or closed, and do not change the stable D3
state.

- [ ] Step 2: Commit governance evidence

Run:

    git diff --check
    git diff --name-only
    git status --short
    npm run type:check:server

Expected: only the explicitly authorized PROJECT_STATE.md governance update is
uncommitted, production type-check is green, and no implementation file is
silently included.

Proposed commit:

    chore(d4): record review candidate verification

- [ ] Step 3: Verify delivery configuration before push

Run:

    git status --short
    git branch --show-current
    git remote -v
    git config --local --get http.version
    git rev-parse HEAD

Expected: current branch is phase/d4-text-generation-provider-abstraction,
origin is the project repository, http.version is HTTP/1.1, and the candidate
HEAD is recorded for the PR.

- [ ] Step 4: Push the D4 branch and open the PR

Push only the D4 branch using the repository's normal non-force workflow, then
open a PR against main. The PR description must include Phase D4, scope,
tests, frozen contracts, known inherited CI issue, explicit out-of-scope items,
and the instruction: Do not merge before acceptance.

- [ ] Step 5: Stop for ChatGPT GitHub Review

After the branch is pushed and the PR is open, stop. Do not merge main, create
an accepted tag, declare PHASE_D4_ACCEPTED, or enter Phase E.

## Proposed commit sequence

1. docs(d4): record approved design and implementation plan
2. feat(d4): establish token-backed generation boundary
3. feat(d4): propagate generation provider identity
4. feat(d4): accept provider-neutral chunk metadata
5. chore(d4): record review candidate verification

Every production commit must have fresh npm run type:check:server evidence before
commit. The first commit is docs-only; the final commit is governance-only.

## Plan self-review checklist

- Blocking 1: Tasks 0–1 create the branch/docs baseline first, then make the
  neutral types, LlmService, DeepSeek adapter, module binding, and smoke
  compatibility one atomic green production commit; no early production commit
  can be type-broken.
- Blocking 2: Task 2 uses a real LlmService obtained from a Nest testing module
  and traverses all three real LLM-backed generators; generator unit mocks remain
  supplemental.
- Blocking 3: Task 0 verifies accepted main, creates the D4 branch, and commits
  both approved docs before TDD implementation.
- Blocking 4: ordinary regression never runs test:deepseek; smoke scripts are
  validated with tsconfig.smoke.json and mocked adapter tests.
- Important smoke clarification: tsconfig.node.json is not used to validate smoke
  scripts.
- Important delivery clarification: final verification proceeds to Review
  Candidate commit, push, PR, and stop for ChatGPT review; there is no extra
  local-only completion gate.
- Polish and Paper Revision chunk executors are explicitly unchanged.
- No provider, embedding, retrieval, routing, queue, billing, health-auth, or
  inherited-CI scope is introduced.

Implementation remains unauthorized until PHASE_D4_IMPLEMENTATION_AUTHORIZED.
