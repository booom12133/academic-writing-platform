# AI Writing Skills — Phase B0-3 Frozen Assets

This directory is the reviewed, non-runtime asset layer produced by Phase B0-3 on 2026-08-31.

## Scope boundary

- Phase A is frozen. No DeepSeek provider, task system, generator, controller, service, or business workflow was changed.
- This directory contains provenance, licenses, audit records, and two adopted vendor snapshots only.
- There is intentionally no Skill Registry, Composer, Validator, RAG adapter, tool adapter, or wrapper implementation here.
- A later Phase B implementation must treat every external skill as untrusted instructions and keep network, filesystem, browser, and subprocess capabilities behind explicit adapters and permissions.

## Adopted pool

| Skill | Role | Project status | License | Provenance |
|---|---|---|---|---|
| `codex-academic-humanizer` | Chinese/English academic naturalization with semantic-preservation constraints | Vendored and frozen | MIT + NOTICE | `henmuc/codex-academic-humanizer@496d5d897d920d1c8f0d382e31406eeff0f29e45` |
| `citation-verification` | Existence, abstract-read, and claim-relevance citation gate | Vendored and frozen | MIT | `ruichenrui/citation-verification@61f42ae438afa93fcb3eeb1302f5f4ef7f59e32f` |

The Chinese academic writing candidate from `Findddx/codex-cn-paper-skills` was installed locally for Codex evaluation, but it is **LOCAL_ONLY**: the audited repository has no root `LICENSE`, so it is not copied into this project.

## Existing local baseline

The project may continue to use the already installed local skills for Nature-style writing, polishing, reading, citation, search, response letters, data availability, document handling, Zotero, humanization, and economics writing. Their source/licensing provenance was not re-vendored in this audit. The new pool is additive and does not replace the Phase A business implementation.

## Frozen task stacks for later Phase B

- Topic and outline: `nature-writing` + `codex-academic-humanizer` when prose naturalization is requested.
- Literature and citation: `nature-academic-search` or `zotero` + `citation-verification` + existing `nature-citation` when the target venue is Nature/CNS.
- Chinese academic revision: `chinese-academic-writing-cn` locally, then `codex-academic-humanizer`; project integration remains pending.
- Reviewer response: existing `nature-response`; do not stack the rejected generic rebuttal candidate automatically.
- Document QA: existing `documents`/`pdf`; do not add the duplicate Word skill automatically.

## Files

- `catalog/manifest.json`: frozen provenance, role, risk, and disposition records.
- `catalog/skill-audit-2026-08-31.md`: candidate-by-candidate audit and rejection rationale.
- `licenses/manifest.json`: license decisions and redistribution boundary.
- `vendor/`: exact snapshots of adopted MIT-licensed sources, including their upstream notices.
