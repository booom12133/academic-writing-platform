# Phase B1 Final Acceptance

## 1. Overall

PARTIAL

Test A English and Chinese passed. Test B was blocked by `revision-conservative` with 4 invariant errors, so Phase B1 is not accepted.

## 2. Runtime Asset Verification

PASS

Compiled output loaded all required skills from:

`D:\学术写作辅助平台\dist\server\modules\ai-tools\skills\`

Loaded successfully:

- `project/academic-polish/SKILL.md`
- `project/chinese-academic-writing/SKILL.md`
- `project/academic-revision/SKILL.md`
- `vendor/codex-academic-humanizer/SKILL.md`

The compiled Chinese polish stack contained:

`academic-polish → chinese-academic-writing → codex-academic-humanizer`

## 3. Test A — English Polish

- Stack: `academic-polish-en`
- Model: `deepseek-v4-flash`
- Validator: `polish-strict`
- Preserved invariants: `DvXray`, `RT-DETR`, `92.4%`, `p = 0.032`, `[12]`, `24.6 GFLOPs`, `Figure 4`
- Usage: prompt 1557 / completion 102 / total 1659
- Latency: 1122 ms
- Result: PASS

The revised sentence improved flow and academic tone while preserving the protected values.

## 4. Test A — Chinese Polish

- Stack: `academic-polish-zh`
- Validator: `polish-strict`
- Result: PASS
- Usage: prompt 1628 / completion 64 / total 1692
- Latency: 1033 ms

All protected values remained unchanged.

## 5. Test B — Academic Revision

- Stack: `academic-revision-en`
- `authorInputNeeded`: NOT VERIFIED; delivery was blocked before resultData was returned
- Unsupported facts generated: validator detected 4 unsupported invariant errors
- Validator: `revision-conservative` — ERROR
- Result: FAIL

The generator correctly refused to deliver the revision after the deterministic invariant gate failed. No repair call was attempted.

## 6. Negative Validator Test

PASS

`polish-strict` detected all required changes as ERROR:

- `92.4% → 94.7%`
- `DvXray → PIDray`
- `p = 0.032 → p = 0.023`
- `[12] → [13]`

## 7. HTTP Smoke

NOT RUN. Full HTTP smoke requires the existing local authentication/database startup path; no new test infrastructure was added.

## 8. Regression

- Tests: PASS — 13 suites, 46 tests
- Lint: PASS
- Server type-check: PASS
- Client type-check: PASS
- Server build: PASS using existing `cross-env` equivalent command
- Client build: PASS using existing `cross-env` equivalent command

The original Windows `NODE_ENV=...` npm script compatibility issue remains unchanged.

## 9. Review of Extra Modified Files

- `ai-tools.service.ts`: injects and routes only the new polish/revision generators; no silent fallback, task-state semantic change, or topic-generation change.
- `tasks.service.ts`: calculates polish points from the canonical frontend `text` field instead of the obsolete `content` field.
- `nest-cli.json`: copies only runtime skill Markdown assets into `dist`; no `.env`, secret, or unrelated large resource is included.

## 10. Remaining Issues

- Test B needs investigation of the four invariant errors before acceptance.
- HTTP smoke was not run.
- DOCX/PDF file parsing remains intentionally out of scope.
- Native Windows `npm run build:server` / `build:client` scripts still require the existing `cross-env` equivalent.

## 11. Final Decision

PHASE_B1_NOT_ACCEPTED
