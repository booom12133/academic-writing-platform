# Phase P2 Review Candidate Evidence

## Candidate identity

- Accepted `main`: `862b0548943fb09913c524b5d0178151524bf946`
- P2 implementation head before this server payment-boundary fix: `65d4c985d5134816556b023813e7ddd1a4386b6f`
- Source branch: `phase-p2-product-integration`
- Review candidate final branch head: the final branch HEAD after evidence documentation; the authoritative SHA is recorded in the PR preparation result and verified with `git rev-parse HEAD` after commit.
- P2 implementation commits after accepted `main` before this fix: 17
- P2 implementation diff before this fix: 117 files changed, `+10813/-893`
- Server payment-boundary fix commit: the authoritative SHA is reported with the final branch HEAD.

This is review evidence, not a Final Acceptance Report. The evidence is based on code and automated tests; it does not claim a real production browser deployment.

## Work-package status

| Work package | Status |
|---|---|
| WP1 Capability Inventory & Product Truth | `REVIEW_PASS` |
| WP2 Auth & Session Integration | `REVIEW_PASS` |
| WP3 Document Workspace & Input Unification | `REVIEW_PASS` |
| WP4 AI Tool Execution Closure | `REVIEW_PASS` |
| WP5 Task & Result UX | `REVIEW_PASS` |
| WP6 Academic Search & Zotero Product Integration | `REVIEW_PASS` |
| WP7 Knowledge Indexing Orchestration | `REVIEW_PASS` |
| WP8 Grounded Writing & Product Navigation | `REVIEW_PASS` |

## Workflow A evidence: document to AI result

The integrated code path is:

```text
Authenticated User
→ Upload/Select Document
→ Polish or Paper Revision
→ Submit
→ Task
→ Result
→ Copy / Export / Re-run
```

Code/test-level evidence:

- Auth/session and protected request behavior: `test/unit/auth-session-client.spec.ts`, `test/unit/api-auth-context.spec.ts`.
- Document input and workspace selection: `test/unit/document-input-client.spec.ts`, WP3 knowledge product client/integration suites.
- Polish and paper revision submission/result migration seams: `test/unit/polish-migration-client.spec.ts`, `test/unit/paper-revision-migration-client.spec.ts`.
- Task action and result UX: `test/unit/task-actions-client.spec.ts`, `test/unit/task-result-client.spec.ts`, existing task service/controller suites.
- The explicit Workflow A client/auth regression command passed with 6 suites and 34 tests.

This proves integrated code paths and contracts. It is not a claim that the flow was exercised against a deployed production browser topology.

## Workflow B evidence: Knowledge to grounded writing

The integrated code path is:

```text
Authenticated User
→ Upload/Zotero import
→ Knowledge
→ explicit Index
→ indexed
→ Grounded Writing
→ retrieval
→ generation
→ citations
→ bibliography
→ provenance
```

Code/test-level evidence:

- Authenticated Knowledge workspace and owner-scoped client contracts: WP2 auth suites and WP3 knowledge product suites.
- Zotero search/import client contracts: `test/unit/zotero-client.spec.ts`; Zotero attachment import feeds the Knowledge workspace before indexing.
- Explicit indexing lifecycle and status/retry: `test/unit/knowledge-product-indexing.spec.ts` and `test/unit/knowledge-product-indexing.http.integration.spec.ts`.
- Grounded Writing sends only accepted E6 request fields and selects only active indexed Knowledge versions: `test/unit/grounded-generation-client.spec.ts` and `test/unit/grounded-writing-client.spec.ts`.
- E3 retrieval regression: 10 suites and 36 tests passed.
- E6 grounded-generation regression: 14 suites and 51 tests passed.
- The combined Workflow B/E3/E6/WP7 command passed with 29 suites and 131 tests.

P2 proves these integrated code paths. P3 proves real deployed production topology, including deployment rehearsal and operational dependencies.

## Product truth audit

- Fake/synthetic literature production path is disabled or replaced by the accepted Academic Search and Knowledge contracts; capability/product-truth boundary tests passed.
- Academic Search metadata is not treated as evidence by itself.
- Zotero import creates Knowledge input but does not imply indexed evidence.
- Only active Knowledge versions with `index.status = indexed` feed Grounded Writing.
- Grounded Writing output is not automatically written back to Knowledge.
- `mock_token` appears only in an auth test fixture; the client production login path does not use it.
- The legacy mock order/payment backend remains retained but is not exposed as an executable production product flow.
- Production UI does not offer recharge/payment in P2; `/recharge` is an unavailable page and does not create orders, pay orders, or display a fake QR.
- Production HTTP mutation routes `POST /api/orders`, `POST /api/orders/:id/pay`, and `POST /api/orders/:id/cancel` reject with `PAYMENT_NOT_AVAILABLE` and HTTP 503 before calling the legacy service.
- Read-only `GET /api/orders` and `GET /api/orders/:id` remain owner-scoped through `req.userContext.userId`.
- Authenticated users cannot obtain points through the legacy mock payment HTTP path because `PointsService.recharge` is unreachable from the rejected payment route.
- A real payment provider remains outside P2.

The product-truth, production-capability, input-contract, and tool-gate regression command passed with 5 suites and 16 tests.

The payment product-truth regression additionally verifies that Navbar and Dashboard expose no recharge action, Profile order history is read-only, and `/recharge` mounts no executable mock payment UI. The server payment-boundary regression verifies the three rejected mutations and both retained owner-scoped read paths (2 suites, 9 tests total).

## Frozen boundaries and retained limitations

P2 does not add TasksService integration to WP7 indexing or E6 grounded generation, queue/worker execution, a new migration, a new reliability system, a new AI provider/algorithm, E7, or E8.

The existing Workflow A in-process task path remains separate from synchronous WP7/E6 orchestration. The following are retained limitations and are not P2 defects:

- process-local rate limiting;
- single-node/shared-volume standalone filesystem;
- no durable queue or crash replay;
- no object storage;
- formal deployed E2E belongs to P3;
- real standalone IdP/JWKS deployment belongs to P3;
- production PostgreSQL/pgvector topology validation belongs to P3.

## Candidate verification

Executed from `phase-p2-product-integration`:

| Verification | Result |
|---|---|
| `npm test -- --runInBand` | 168 suites passed; 882 tests passed; 21 skipped |
| `npm run type:check` | PASS |
| `npm run build:server` | PASS |
| `npm run build:client` | PASS |
| `npm run lint` | PASS |
| `npm run test:app-bootstrap` | PASS; AppModule bootstrap resolved |
| Production boundary/gate regression | 5 suites, 16 tests passed |
| E6 regression | 14 suites, 51 tests passed |
| E3 regression | 10 suites, 36 tests passed |
| WP7 regression | 4 suites, 27 passed, 1 skipped |
| WP2 auth regression | 4 suites, 21 tests passed |
| WP3 Knowledge regression | 4 suites, 25 tests passed |
| WP8 targeted client tests | 2 suites, 23 tests passed |

### PostgreSQL guarded case

Command:

```text
npx jest test/unit/knowledge-product-indexing.http.integration.spec.ts --runInBand
```

Result: 3 guarded HTTP tests passed and 1 PostgreSQL product integration case skipped because `DATABASE_URL` is absent in this environment. The skipped case is not reported as a pass.

## CI and governance

The latest completed CI for PR #15 before this server-boundary push was run `34224107013`; `verify`, `postgres-schema`, and `production-gates` all passed. A new run for the final fix HEAD must be reported after push.

At candidate preparation time:

```text
P2_IMPLEMENTATION_COMPLETE=YES
P2_REVIEW_CANDIDATE=YES
P2_PHASE_PR=OPEN (after PR creation)
P2_REVIEW_PASS=NOT_CLAIMED
P2_ACCEPTED=NOT_CLAIMED
P2_ACCEPTED_CLOSED=NO
PRODUCTIZATION_PHASE_P3=NOT_ENTERED
```
