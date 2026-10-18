# DaaS test strategy

Version: **0.1**. Updated: **2026-10-18**. State: **draft for G0 review**.

This is a verification plan, not execution evidence. **No application tests, live Actor runs or database recovery drills have been performed as part of writing this framework.** Application code and executable tests remain outside the current task.

Sources: [M §§4–8](../architecture/master-architecture.md), the [architecture review](../architecture/architecture-review.md), the reconciled [draft baseline](../architecture/master-spec.md) and [approval register](../architecture/approval-register.md). Review-derived changes remain proposed until approved.

## Readiness and traceability

Implement only after G0 plan approval and the affected spec's `ready` gate. A test cannot settle an unresolved business policy or approve an architecture change. Resolve blocking source/context, event model, runtime, numeric limits, evidence and SQL settings decisions before selecting assertions that depend on them.

Each test/check identifies the spec revision, stable `SPEC-NNN-FR-*` / `NFR-*` / `AC-*` IDs it verifies and the actual boundary exercised. Maintain an acceptance matrix in the implementation report. Every requirement needs a criterion and evidence; test counts and code coverage do not substitute for that mapping.

Do not invent tool commands or mandatory coverage percentages before D-01 and SPEC-001 establish the toolchain. Record exact selected commands and versions when execution occurs.

## Meaningful TDD

1. Select the next approved observable behaviour and write the smallest meaningful failing test. Name the relevant AC and expected gap.
2. Run it and preserve the actual red result. A missing dependency, broken fixture or unrelated failure does not demonstrate the intended behaviour gap.
3. Implement the minimum behaviour, run the focused check and preserve green evidence.
4. Refactor while the relevant checks remain green, then run the required consumer/boundary regressions and checkpoint.

Use controlled clocks, identifiers, random seeds, resolvers, networks and worker barriers where nondeterminism would hide faults. Test public behaviour and invariants; avoid private-method assertions, declaration snapshots and tests that merely reproduce the implementation. Documentation and simple structural changes use reviewed inspection/link checks instead of artificial application tests.

## Verification layers

| Layer | Purpose and representative cases | Evidence limits |
| --- | --- | --- |
| Unit | URL/context rules, parser validity, outcome classification, budgets/backoff, policy decisions and accounting with deterministic collaborators | Does not prove provider, SQL locking or network enforcement |
| Source fixtures | Sanitized permitted HTML/JSON/DOM; required/optional fields, zero versus missing, challenge/login/soft-404 and wrong-context pages | Does not prove the target still serves the same content |
| Contract | Producer and consumer validate the same versioned inputs, manifests, events and error envelopes without silent coercion | Does not prove durable delivery or correct real extraction |
| Real MSSQL integration | Migrations, constraints/collation, collision handling, concurrent upserts/claims, ownership fences, atomic commit/checkpoints, roles and restore | Run on the approved version/isolation settings; mocks/other SQL engines cannot establish these properties |
| Apify adapter integration | Run-specific IDs, bounded polling, terminal statuses, raw pagination, retained storage and pinned builds | Separate simulated API faults from actual provider verification |
| Deterministic pipeline | Approved fixture through discovery, SQL inventory, claims/dispatch, extraction, Bronze and reconciliation; controlled counts/fault order | Explicitly identify substituted transport/runtime boundaries |
| Bounded live pipeline | Approved source using real Crawlee/Apify and private MSSQL; inspect usable fields, provenance and limits | Does not establish general multi-source scale or production recovery |
| Operational drill | Pause/resume, parser rollback, retention/evidence replay, isolated backup/restore and measured recovery | Production acceptance additionally requires approved capacity, RPO/RTO, owners and limits |

## Required scenario ownership

The table identifies primary owners; SPEC-015 assembles cross-component evidence rather than duplicating every predecessor unit test.

| Scenario | Primary specifications | Observable result |
| --- | --- | --- |
| Version/shape/cardinality rejection and nullable HTTP status | 002, 005, 006 | Invalid envelopes/fields cannot silently become success |
| Source-aware URLs, context, query/fragment/path cases and explicit collision handling | 004, 007, 008 | Approved identities remain distinct; no accidental merge under SQL collation |
| Discovery duplicates, partial coverage and repeat intake during a lease | 003, 008 | Discovery facts update; ownership/freshness remain intact; absence does not retire URLs |
| Concurrent claims and bounded shared site admission | 009, 011, 014 | Disjoint current ownership and no overlapping fetching outside the approved group policy |
| Start accepted but response lost; worker crashes around network call | 010, 011, 014 | Durable intent becomes unknown/reconciled; no uncontrolled replacement launch |
| Late success after a newer attempt/generation | 009, 013, 014 | History may append; current lease and freshness cannot be overwritten by stale authority |
| Same ID/same content versus same ID/conflicting content | 002, 012, 013 | Identical replay is idempotent; conflict is retained/rejected under the approved policy |
| Multiple physical executions for one logical attempt | 011, 013, 014 | All executions traceable; at most one authoritative terminal result accepted |
| Failed/aborted/timed-out Actor with partial results or no events | 010, 012, 014 | Useful successes import; missing assignments remain explicit unresolved work |
| Empty, exact-boundary and multiple raw pages; lagging metadata | 010, 012, 014 | No transformed-offset skip; completion also requires terminal/drain/manifest evidence |
| Malformed middle item; interruption before/after SQL commit/ack | 012, 013 | Raw position has durable event/replay/quarantine disposition before checkpoint advances |
| SQL outage after Actor completion | 012, 013, 014 | Retained output imports on recovery without unnecessary website requests |
| HTTP 200 challenge/login/soft-404/empty shell/wrong market | 005, 006 | No usable-success declaration; source classification and pause policy apply |
| Missing/invalid required evidence; selected corrected-parser replay | 006, 013, 017 | Required evidence gates success; sampled retention never implies full-history replay |
| Forbidden DNS/redirect/browser target and unsafe evidence reference | 016, 017 | No unauthorized egress/access; safe typed diagnostic and no permissive retry |
| Re-ingestion versus genuinely new recurring capture | 013, 014, 015 | Replay adds no event; new capture appends history even for unchanged values |
| Source pause, pinned parser rollback and isolated SQL restore | 018 | Durable state remains recoverable; recovery objectives and operator actions are demonstrated |

## Checkpoints

| Checkpoint | Required boundary evidence | Release condition |
| --- | --- | --- |
| CP1 — Contracts | SPEC-001 tooling established; SPEC-002 versioned contracts and agreed examples validated by producers/consumers | Contract and relevant decision gates verified; no placeholder business semantics |
| CP2 — Parallel boundaries | Identity vectors, semantic source-parser fixtures, actual MSSQL migrations/indexes and runtime target-policy checks | Independent owners reconcile shared contracts; isolated boundary checks pass |
| CP3 — Ownership and commit faults | Actual MSSQL concurrency/fencing/transactions plus dispatch-unknown, partial execution, quarantine, raw-offset, outage and retained-evidence replay faults | Required safety/recovery matrix passes; mocks are not substituted for SQL properties; no network call occurs inside the claim/ingestion transaction |
| CP4 — First pipeline | SPEC-015 deterministic full path, bounded real Apify/MSSQL target, replay, recurring observation, coverage and selected evidence | First working pipeline verified within explicit source/budget limits; production gate remains separate |
| CP5 — Operations | SPEC-018 cost/freshness reporting, pause/rollback, retention, actual isolated restore and approved recovery/capacity envelope | Production acceptance authority records decision; unknown RPO/RTO/sizing blocks sign-off |

The [implementation plan](../architecture/implementation-plan.md) and [DAG](../architecture/dependency-graph.md) govern dependency release. CP1–CP5 names here abbreviate the same gates. Earlier fixture design is allowed; unverified prerequisites do not become merge-ready because a consumer passes with mocks. Shared contracts and migrations have one owner during parallel work.

The proposed P-TEST profile supplies finite controlled-fixture bounds, raw page/transaction size 1 and two success-producing target URLs. Initial counts are 2 inventory identities / 2 attempts / 2 success events; dataset redelivery adds zero identities/events, while a new due capture adds 2 attempts/events and preserves the first observations. D-07 approval is required; real-source cost, permission, retention and recovery budgets are separate readiness conditions.

## Isolation, access and cleanup

- Use synthetic or permitted sanitized source fixtures with revision/checksum and ownership recorded. Do not commit credentials, personal data or full scraped customer content.
- Use the approved dedicated test database/environment and least-privilege runtime roles. Record SQL version, collation, isolation/RCSI and relevant index/locking settings.
- Tag owned rows, runs, datasets and evidence with safe test identifiers. Cleanup may affect only resources proven to belong to that test; preserve failure artifacts before cleanup.
- Verify the resolved isolated restore target before any restore write. Keep restored dispatch disabled until external physical executions and checkpoint replay are reconciled.
- Reference secrets by environment/secret names. Run live tests only with approved source permissions and explicit finite request, byte, batch, time, cost and retention budgets.
- Browser verification is conditional on the approved source requiring rendering. Record reviewed exclusions; a required browser mode cannot inherit HTTP-only security evidence.

## Fault execution and boundedness

Inject faults at observable boundaries: after intent commit/before launch, after provider acceptance/before response, before/after SQL commit, before acknowledgement and during ingestion pagination. Use controlled worker barriers for races instead of timing-dependent sleeps. Assertions include both durable state and the absence of unintended new website requests.

Verify the plan's dataset finalization protocol: drain every terminal state, observe the end boundary over the approved number/interval of quiet polls, and reconcile immutable assignments. P-TEST proposes 2 confirmation polls at least 1 second apart. Metadata counts/one empty page never suffice. An unverifiable end boundary remains incomplete; output appearing after finalization triggers recorded reconciliation or review, never silent discard.

Bound retries, polling, sessions, Actor restarts and recovery waits using the approved D-07 values. A hanging test is not a recovery policy. Preserve partial results, quarantine and manifest accounting; do not make a test pass by deleting history or manufacturing missing outcomes.

Use fault fixtures first. Identify separately which statuses, pagination and retention behaviours were verified against the actual Apify account. An unavailable provider or SQL environment is `BLOCKED`; do not quietly substitute mocks and call the same check passed.

## Result records

Follow [reporting and decisions](reporting-and-decisions.md) and the [test-result template](../templates/test-results-template.md). Record source/spec/tested revisions, dirty-tree identification where relevant, exact safe commands, environment versions, fixture identity, boundary realism, timestamps, observed outcomes and sanitized artifacts.

Initial checks are `NOT RUN`. Actual statuses are `PASS`, `FAIL`, `BLOCKED` or `SKIPPED`; reviewed `NOT APPLICABLE` requires an explicit reason. Required blocked/skipped/not-run checks prevent verification. Preserve red evidence as a historical failed result and link later green runs; never overwrite failure history with a success.

Store test records in `reports/tests/<SPEC-ID>/<RUN-ID>.md`, implementation summaries in `reports/implementation/<SPEC-ID>/`, and sanitized supporting evidence in `reports/artifacts/<RUN-ID>/` or approved durable references with retention/checksum. Record every AC as verified or unverified and name its evidence; do not infer success from a successful wrapper exit code.

## Current completion state

This document establishes planned verification responsibilities and gates only. G0 and the approval-register decisions remain open; no runtime tooling, application tests, live credentials, migrations or infrastructure were added by this work. Change history: **0.1, 2026-10-18 — initial source-traced test strategy for review**.
