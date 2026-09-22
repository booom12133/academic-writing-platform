# Phase P5 Final Acceptance Report

## Final decision

```text
PHASE_P5_ACCEPTED
P5_ACCEPTED = YES
P5_MERGED = YES
P5_ACCEPTED_CLOSED = NO
ACCEPTED_TAG_CREATED = NO
```

The Controller granted Final Acceptance for candidate
`49020ffa8bb0430b30272363e06358b4c51f069e` after authoritative PR CI run
`35722816390` passed every required job, including the real PostgreSQL P5
suite. PR #18 was then merged, and the resulting `main` CI run `35724195720`
passed all five required jobs. This governance commit records the accepted
state before annotated-tag creation and Controller closeout verification.

## Phase identity

| Item | Value |
|---|---|
| Phase | P5 — Whole-paper Manuscript Assembly & Export |
| Branch | `phase/p5-manuscript-assembly-export` |
| PR | [#18 Phase P5: assemble manuscripts and export DOCX](https://github.com/booom12133/academic-writing-platform/pull/18) |
| Accepted baseline | `c13013d79e09f130693e94e71fd69f58c623787a` |
| Accepted candidate | `49020ffa8bb0430b30272363e06358b4c51f069e` |
| Authoritative PR CI | [35722816390](https://github.com/booom12133/academic-writing-platform/actions/runs/35722816390) — `SUCCESS` |
| Merge commit / initial post-merge main HEAD | `1f95f7ba888559dcdca009a3f7743a97bfb2a7f1` |
| Initial post-merge main CI | [35724195720](https://github.com/booom12133/academic-writing-platform/actions/runs/35724195720) — `SUCCESS` |
| Governance closeout | This documentation-only commit; no business implementation change |

## Accepted scope

P5 deterministically assembles the canonical P4 project, active outline,
OUTLINE sections, and exact current immutable revisions into a whole-manuscript
projection. It adds safe global citation normalization and bibliography,
fingerprinted Abstract/Keywords refresh, target-excluded Conclusion freshness,
bounded and fair whole-manuscript generation context, authenticated manuscript
preview, immutable export history and download, and editable DOCX export using
the `generic-academic-v1` template.

## Key decisions and frozen interfaces

- `PaperSectionRevision` remains the only canonical body truth; no whole-body
  mirror or mutable manuscript aggregate was added.
- Multi-query manuscript loads and derived-generation fingerprint checks use a
  PostgreSQL `REPEATABLE READ` consistent snapshot and fail closed on missing
  exact revisions.
- Existing P4 workspace, outline, section, remap, and restore flows remain
  `sectionRole=OUTLINE` only. ABSTRACT and KEYWORDS are loaded through the
  Manuscript domain.
- Whole-manuscript generation context is deterministic, bounded, preserves the
  title and Research Plan, fairly covers sections, and exposes truncation.
- A refreshed Conclusion stores a target-excluded basis fingerprint so its own
  new revision does not become stale immediately.
- DOCX is the only accepted production export. The template uses a static
  heading-derived TOC without page numbers and declares zh-CN/en font families
  without embedding or redistributing font files.
- P5 does not authorize Phase F, Redis, BullMQ, Queue/workers, PDF, LaTeX, or
  production deployment.

## Database and dependencies

- `0006_p5_section_roles.sql` adds persisted section roles with OUTLINE
  compatibility and derived-role uniqueness.
- `0007_p5_paper_exports.sql` adds immutable owner-scoped export manifests.
- Accepted migrations `0001`–`0005` are unchanged.
- Total migration count: `7`; restore required table count: `20`.
- Exact additions: production `docx@9.7.1`; development `jszip@3.10.1`.

## Verification evidence

- Full regression: 224 suites / 1224 tests PASS; 10 suites / 63 tests were
  environment-skipped locally.
- HTTP E2E: 2 suites / 10 tests PASS.
- Lint, server/client type-check, server/client build, AppModule bootstrap, and
  clean dependency installation: PASS.
- The deterministic 10k/50k/100k benchmark passed DOCX ZIP/XML validation and
  preserved bounded coverage across all ten sections; 100k local p95 was
  153.38 ms.

## Authoritative GitHub CI

PR CI run `35722816390` completed successfully at the exact accepted candidate.

| Required job | Result |
|---|---|
| `verify` | `SUCCESS` |
| `postgres-schema` | `SUCCESS` |
| `wp6-step5b` | `SUCCESS` |
| `nginx-upload-boundary` | `SUCCESS` |
| `production-gates` | `SUCCESS` |

The PostgreSQL-backed step explicitly executed
`test/integration/p5-manuscript-snapshot.integration.spec.ts`: 4 P5 tests
passed and none were skipped. This covers consistent-snapshot concurrency,
repository loader mutation, section-role migration/uniqueness, and export
constraints.

## Merge and initial post-merge main CI

PR #18 was merged using a merge commit. Merge commit and initial post-merge
`main` HEAD are both `1f95f7ba888559dcdca009a3f7743a97bfb2a7f1`.
GitHub Actions run `35724195720` completed successfully at that exact commit.

| Required job | Result |
|---|---|
| `verify` | `SUCCESS` |
| `postgres-schema` | `SUCCESS` |
| `wp6-step5b` | `SUCCESS` |
| `nginx-upload-boundary` | `SUCCESS` |
| `production-gates` | `SUCCESS` |

## Known non-blocking issues

- Existing Vite module-type and chunk-size warnings remain non-blocking.
- GitHub Actions reports the upstream Node.js action-runtime deprecation and
  future `ubuntu-latest` image migration notices; neither changes P5 behavior.

## Governance status

```text
REVIEW_PASS = YES
ACCEPTED = YES
MERGED = YES
ACCEPTED_TAG_CREATED = NO
ACCEPTED_CLOSED = NO
PRODUCTION_DEPLOYED = NO
```

The annotated `phase-p5-accepted` tag remains gated on successful CI for this
final governance-only `main` state and exact local/remote peeled-target
verification. No next product phase is authorized.
