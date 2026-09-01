# External Skill Audit — 2026-08-31

## Decision key

- `ADOPT`: installed into Codex and copied as a license-compatible project snapshot.
- `LOCAL_ONLY`: installed for local Codex evaluation; no project redistribution.
- `DEFER`: useful source material, but not part of the frozen pool.
- `TOOL_ONLY`: requires a future explicit adapter, sandbox, and permission boundary.
- `REJECT`: not suitable for this phase or fails a hard requirement.

## Candidate matrix

| Candidate | Pinned commit | Main value | Security/dependency finding | License finding | Decision |
|---|---|---|---|---|---|
| `Findddx/codex-cn-paper-skills` | `81213da48f0edb6a7ab2a79f14a649389d9d7b84` | Chinese academic writing, evidence mapping, terminology and acceptance checklist | Prompt skill is low risk; CNKI helper moves local downloads and relies on an authenticated visible browser workflow, so it is not a current tool adapter | No root `LICENSE` found in audited commit | `LOCAL_ONLY` for `chinese-academic-writing-cn`; CNKI helper `TOOL_ONLY`; Word skill rejected as duplicate |
| `henmuc/codex-academic-humanizer` | `496d5d897d920d1c8f0d382e31406eeff0f29e45` | Chinese/English academic naturalization with explicit preservation of facts, citations, formulas, variables, and hedging | Prompt-only package; no runtime dependency or network script | MIT; retain `NOTICE` | `ADOPT` |
| `ruichenrui/citation-verification` | `61f42ae438afa93fcb3eeb1302f5f4ef7f59e32f` | Existence, abstract-read, and claim-relevance citation gate | Prompt-only package; no runtime dependency | MIT | `ADOPT` |
| `msimchowitz/writing-skills` | `214981fe02326f27b0fc8790d00eb4b731607073` | Abstract, academic voice, literature review, rebuttal, paper writing | Strong material, but several skills depend on sibling paths and the package substantially overlaps installed Nature/humanizer skills; review script should be a future validator input, not enabled now | MIT | `DEFER` |
| `TobiasLee/Rebuttal-Skill` | `7315391c54b73df96cda47da2a19a5235484c36b` | Thorough reviewer-response triage and evidence planning | Prompt-only and low execution risk, but conference-focused and duplicates `nature-response` | No repository license found | `REJECT` |
| `hideshi/scholarly-agent-skills` | `3ef50b4c6a12240a768e7a70ef5b57f2906f10a1` | Claim-evidence gate, citation traceability audit, source criticism, translation | MIT package includes scripts for network literature search, PDF download, and report generation; requires future adapters/configuration and is too broad for this phase | MIT, with explicit safety/disclaimer files | `DEFER`; retain claim/citation gates as future Validator candidates |
| `bytedance/deer-flow` | `72ba661b84452ed3b8271d77749b3f0e036e2809` | Data analysis and systematic literature review workflows | Heavy agent harness; data-analysis helper can auto-install Python packages, install DuckDB extensions, execute SQL, and write caches/outputs | MIT | `TOOL_ONLY`; no install |
| `zLanqing/codex-claude-academic-skills` | `7ed6377f0efb6a38951b48ef03b19d996e454b1f` | Research writing, office academic files, scientific toolkit | Requested `statistical-analysis` skill path does not exist at the pinned commit; existing office skill overlaps installed document/PPT skills | MIT root, but referenced resources may have their own terms | `REJECT` |

## Adopted-source integrity

The two vendor directories are copied from the installed, pinned Codex sources without prompt rewriting. Their original `SKILL.md`, references, examples, metadata, README, and license/notice files are retained.
