# SPEC-009 — Atomic work claiming, fencing and site admission

| Metadata | Value |
|---|---|
| Version / date | 0.1 / 2026-10-18 |
| State / implementation | **draft** / not started |
| Direct dependencies | SPEC-007, SPEC-016 |
| Entry decisions | G0; D-03, D-04, D-07, D-08 |
| Sources | M §5–7; R: “The SQL-to-Apify handoff needs a precise failure-recovery protocol.”; R: “Lease expiry must trigger reconciliation, rather than immediate rescraping.”; R: “Rate limits and retries must be controlled across both stages.” |
| Evidence | Implementation and test report under `reports/`; none yet |

## Objective and scope

Create durable bounded work assignments and enforce one fetching admission per shared site rate-limit group across discovery and extraction. Protect SQL ownership against overlapping workers and late completions.

Own claim/admission/renewal database operations and durable intent creation. Apify launch, reconciliation decisions, URL parsing and actual fetching belong elsewhere. SQL lease expiry never authorises this module to fetch again without reconciliation.

## Requirements

| ID | Requirement |
|---|---|
| SPEC-009-FR-01 | Atomically select an ordered bounded set of eligible active due URLs, allocate immutable attempts, increment lease generations, set leases and persist an immutable manifest plus dispatch intent. |
| SPEC-009-FR-02 | Serialize discovery and extraction admission by the same rate-limit group; paused groups/sources and unresolved possible fetching executions admit no replacement run. |
| SPEC-009-FR-03 | Every authoritative renewal/release matches `current_attempt_id` and `lease_generation`; group release/renewal also matches its admission identity/generation. |
| SPEC-009-FR-04 | Expose expired, unknown or superseded ownership as requiring reconciliation, preserving existing intent/attempt history rather than blindly reclaiming it. |
| SPEC-009-FR-05 | Enforce approved source budgets, finite lease/execution/import deadlines and bounded renewal; commit before any Apify API call. |
| SPEC-009-NFR-01 | Two independent SQL claimers cannot obtain the same current assignment or simultaneous incompatible fetching admissions. |
| SPEC-009-NFR-02 | Claim transactions contain no external I/O and have explicit finite batch/lock/retry bounds from D-07/08. |
| SPEC-009-NFR-03 | Stable ordering and narrow indexed predicates must remain correct under the actual SQL isolation/RCSI configuration. |

## Inputs and outputs

| Direction | Contract |
|---|---|
| Input | Stage, approved source/context/profile/configuration/build references, rate-limit group, worker identity, claim time and approved policy version. |
| Input | Extraction batch limit and due eligibility; or approved discovery seeds/scope manifest and discovery limits. Values must satisfy SPEC-016 validation. |
| Output | Immutable logical run/manifest, durable dispatch intent, admission identity/generation, and extraction attempts with URL/context/lease generation. |
| Output | Explicit `no_due_work`, `paused`, `group_busy`, `needs_reconciliation` or bounded transient SQL failure; none imply a launch occurred. |

Use a consistent documented UTC time source for eligibility/lease comparisons. Record policy versions so concurrent policy changes cannot alter an already submitted manifest. No default source/context is inferred from the URL.

## Claim and admission design

1. Validate configuration before taking locks. In one short SQL transaction, lock the shared rate-limit-group admission and verify enabled/source/pause/backlog gates and absence of unresolved fetching ownership.
2. For extraction, choose active, due, approved-context URLs in deterministic `(next_scrape_at, url_id)` order, excluding current or unresolved ownership. Use an ordered bounded update/output operation validated under D-08 settings.
3. Allocate a fresh attempt ID per selected work item, increment its monotonic URL lease generation, establish owner/expiry, and persist logical run, immutable manifest and dispatch intent in that transaction.
4. For discovery, reserve the same group admission and persist its seed/scope/configuration manifest plus intent. Do not manufacture URL attempts for unvisited discovery seeds; the discovery manifest accounts for that stage.
5. Bind admission identity/generation to the logical run. Commit all changes together; only a committed intent may be returned to the dispatcher. If extraction finds no work, create no empty fetching admission or launch intent.
6. Renewal matches the current fence, obeys the approved execution/import deadline and fails visibly when superseded or beyond its bound. Renewal does not change immutable attempt or manifest identity.
7. An expired lease/admission is reported to SPEC-014; retain the previous attempt and any possible physical execution. An ingestion backlog blocks new dispatch according to D-07 instead of causing website refetches.

SQL locking hints are an implementation choice validated on D-08. `UPDLOCK`/`READPAST` are candidates, not universal guarantees; RCSI restrictions, page locks and deadlock ordering must be tested. Use a consistent group-before-URL lock order across callers.

Maintain decimal-string precision for wire URL/source IDs and lease generations under SPEC-002; fence comparison occurs on their exact SQL values. Generation overflow is a terminal operational fault requiring review, never wraparound or reuse.

No strict fairness claim is made without a requirement. Record starvation or lock-contention observations during real concurrent tests and address them only when the bounded pilot cannot make progress.

The proposed MVP permits one possible active fetching run per rate-limit group, regardless of stage. This is conservative admission, not a distributed request-rate limiter. Actor-level settings still enforce the approved request/session/restart bounds. A lost dispatch response holds admission until reconciliation establishes what actually started.

Fetch admission may be released after all associated physical fetching executions are confirmed terminal and no launch ambiguity remains, following SPEC-014's verified transition. SQL URL ownership may remain through import; source backlog gates still apply. Lease expiry alone is insufficient proof that fetching stopped.

## Dependencies and parallel boundary

| Direct predecessor | Required verified capability |
|---|---|
| SPEC-007 | Attempt/run/manifest/dispatch-intent schema, exact URL ownership and group admission fields, indexes and actual SQL configuration. |
| SPEC-016 | Validated runtime budgets, source pause controls and shared rate-limit-group membership. |

Can progress alongside discovery and Apify transport after these interfaces are verified. SPEC-011 consumes only committed dispatch intent; SPEC-014 owns recovery evidence for safe release/replacement. Integrate claim/fence concurrency before dispatch or end-to-end acceptance.

**Own verification gate:** Use real SQL and representative terminal/reconciled-state fixtures to verify guarded admission, renewal and release. This does not require SPEC-011 launch or SPEC-014's implemented reconciler; physical-run recovery and site-pressure enforcement remain required downstream checkpoints in 014/015.

## Acceptance criteria and tests

| Criterion | Requirements | Unit tests | Real MSSQL integration tests |
|---|---|---|---|
| SPEC-009-AC-01: Eligible claims are bounded, ordered and durable with matching manifest/attempt/fence/intent. | FR-01, FR-05; NFR-02, NFR-03 | Eligibility, batch bounds, immutable manifest and no-work cases. | Claim due fixture URLs, inspect every linked record, roll back injected failure and verify no partial intent. |
| SPEC-009-AC-02: Parallel claimers get disjoint current assignments and only one group admission. | FR-01, FR-02; NFR-01 | Group/source pause and membership rules. | Race two connections in one group and in distinct groups; assert exclusivity plus independent-group progress. |
| SPEC-009-AC-03: Discovery and extraction cannot obtain simultaneous fetching admission in one shared group. | FR-02; NFR-01 | Cross-stage priority/admission decisions. | Simultaneously request discovery and extraction admission; exactly one wins; paused group admits neither. |
| SPEC-009-AC-04: A stale worker cannot renew/release newer URL or group ownership. | FR-03 | Attempt/generation mismatch and maximum-renewal cases. | Seed a valid reconciled-prior-execution/new-owner fixture, submit stale renewal/release and assert unchanged newer fence. |
| SPEC-009-AC-05: Expiry/unknown launch returns reconciliation work without new dispatch. | FR-04, FR-05 | Expired, unknown and backlog-paused eligibility. | Expire a lease with unresolved physical run, claim again and inspect no new attempt/intent; test finite renewal deadline. |

Capture failing tests for a stale fence and cross-stage admission before implementing guards. Real concurrent sessions must exercise the actual D-08 database configuration; an in-memory lock or mocked repository is not claim-safety evidence. Test each approved policy boundary at and immediately beyond its limit.

## Failure handling and bounded recovery

SQL deadlock/lock timeout rolls back attempts, manifest, admission and intent together; retry the whole claim only within D-07's finite budget. A crash after commit leaves a discoverable intent for SPEC-011, with no automatic duplicate claim. Failure before commit produces no dispatchable work.

Invalid policy/pause/context returns a terminal validation result without locks or launch. Ownership mismatch returns `superseded`; do not clear state. Unknown/expired execution stays blocked for SPEC-014; escalation is required when its reconciliation deadline expires. This module never assumes SQL fencing stops an old Actor's HTTP requests.

## Definition of Done and blockers

Resolve G0 and D-03/04/07/08, including real group membership, batch/lease/renewal limits and isolation settings. Verify all ACs with real concurrent SQL sessions and record deadlock/rollback/renewal evidence under `reports/`. Reviewer confirms no network call inside the transaction, no lease-expiry rescrape shortcut, and identical site-admission rules for both stages.
