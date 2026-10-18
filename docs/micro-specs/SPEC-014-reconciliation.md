# SPEC-014 — Reconciliation, recurring scheduling and bounded recovery

Version: **0.1**. Updated: **2026-10-18**. State: **draft**. Implementation: **not started**.

Owner: unassigned integration-service implementer. Acceptance authority: user or delegated reviewer.
Plan: [dependency graph](../architecture/dependency-graph.md), [implementation plan](../architecture/implementation-plan.md).
Sources: [M](../architecture/master-architecture.md) §§5–8; [R](../architecture/architecture-review.md): "The SQL-to-Apify handoff needs a precise failure-recovery protocol.", "Lease expiry must trigger reconciliation, rather than immediate rescraping.", "Rate limits and retries must be controlled across both stages." and "Apify datasets need an explicit retention and ingestion policy." Source revisions: [master-spec v0.1](../architecture/master-spec.md).

## Objective and scope

Recover unknown, expired and partially completed work while advancing recurring freshness safely and keeping discovery/extraction within one shared site budget.

In scope: polling, unknown-dispatch correlation through 011/010, terminal-run drain coordination, manifest accounting, bounded lease renewal, retry/freshness decisions and source/group pause. Out of scope: provider transport (010), claim SQL (009), event/checkpoint transactions (013), new orchestration services, adaptive scheduling and webhook endpoints. Keep these modules in the single integration service.

The proposed policies below require the approval register's source-specific values and state-model resolution before implementation.

## Requirements

| ID | Required behaviour | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-014-FR-01 | On unknown dispatch or lease expiry, reconcile provider execution, INPUT correlation, ingestion and current fenced ownership before replacement fetching; never infer that expired means safe to refetch. | M §6; R: handoff, lease expiry | AC-01 |
| SPEC-014-FR-02 | Poll and drain run-specific outputs from every terminal state, including failed, aborted and timed-out Actors, preserving partial successes. Account for every immutable manifest assignment as accepted, retryable, terminal, superseded or unresolved under the approved model. | M §§5–7; R: handoff | AC-02 |
| SPEC-014-FR-03 | Finalise a physical ingestion boundary only after terminal execution, bounded repeated quiet/drain checks and assignment reconciliation. Counts or a single empty page alone cannot establish completeness; do not resurrect finalized Actor runs. Late dataset writes are explicit incidents, never silently discarded. | R: dataset retention policy; D-04/D-07 | AC-03 |
| SPEC-014-FR-04 | Missing output creates an unresolved/uncompleted control outcome, not a fabricated HTTP observation. Replacement work receives a new logical attempt/event identity only after previous execution/admission is resolved. | R: extraction identity, handoff | AC-02, AC-04 |
| SPEC-014-FR-05 | SQL/import failures retry retained ingestion without website refetch. Lease renewal and authoritative completion require current attempt plus generation and bounded execution/import deadlines; stale outcomes remain historical only. | M §§5–7; R: lease expiry | AC-01, AC-04 |
| SPEC-014-FR-06 | Compute recurring due times and finite jittered scheduled retries from the approved policy; preserve prior valid observation on refresh failure. Respect 429 delays and pause on parser regression, widespread blocking or unsafe ingestion backlog. | M §§5–7; R: shared rate limits, lifecycle separation | AC-05 |
| SPEC-014-FR-07 | Enforce one possible active fetching admission per shared rate-limit group across discovery and extraction, including unknown/obsolete executions; detected duplicate physical runs are accounted for/stopped under approved policy, never ignored. Source pause prevents new dispatch and handles active runs explicitly. | R: shared rate limits, lease expiry; D-04 | AC-06 |

| ID | Non-functional requirement and verification | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-014-NFR-01 | Poll pages, retries, quiet interval/check count, lease renewal, work per cycle and escalation obey D-07 finite limits. Inject clock/jitter for deterministic tests; no unbounded loops. | M §7; D-07 | AC-01, AC-03, AC-05 |
| SPEC-014-NFR-02 | Repeated or overlapping cycles are idempotent, use short fenced SQL changes and no network inside SQL transactions. Controlled overlap leaves one authoritative result. | M §6; R: lease expiry | AC-01, AC-04 |
| SPEC-014-NFR-03 | Expose safe counts/age/reasons for unresolved intent, missing assignments, ingestion lag and paused groups, correlated by logical/physical IDs without raw personal data. | M §7; R: metrics/sign-off | AC-02, AC-05–06 |

## Technical design and boundaries

Planned owner: scheduler/reconciler modules in `apps/integration-service`. Poll persisted runnable work in bounded cycles; use the shared contracts and repositories exported by direct dependencies rather than inventing another queue.

Process uncertain dispatch first, preserving all matching physical executions. For nonterminal runs, renew only still-current ownership within approved execution/import budgets. For terminal runs, request bounded raw-page import through 012/013, including successful partial items from failed runs. An execution status and an ingestion status are separate facts.

For a candidate completion, require terminal provider status plus quiet checks spanning D-07's approved visibility window, stable raw offset/progress and explicit assignment reconciliation. A missing event may be unresolved even when the provider reports zero items. If provider visibility cannot establish completeness within the deadline, escalate as incomplete; do not silently claim success. Finalized Actor executions stay closed; new unresolved work uses fresh runs. If data appears after ingestion finalization, follow the plan's recorded reconciliation/reopen-ingestion action or hold for review, preserving prior offsets/event identities; never silently ignore the late data.

SQL outage recovery resumes ingestion/checkpoint work from retained datasets. It does not dispatch a replacement fetch merely because an import lease/deadline aged. Backpressure pauses new work before the approved retention/recovery window becomes unsafe. 013 remains the sole owner of atomic event/outcome/freshness/checkpoint commits.

Admission uses 009's shared groups for both Actor types. Resolve unknown runs and stop obsolete fetching where approved before releasing a group. Rate, session-rotation, Actor restart and scheduled-retry costs must all fit the approved site budget. Do not bypass access controls to recover blocked work.

## Inputs and outputs

| Direction | Contract / type | Validation and semantics | Owner / consumer |
| --- | --- | --- | --- |
| Input | Required durable logical intents/manifests, physical executions, attempts/fences and checkpoints | Approved model and immutable identities; empty workset is a bounded no-op | 011/013 repositories |
| Input | Required policy versions, clock, group admission and safe provider state/pages | D-07 limits explicit; unknown/missing differs from failed HTTP observation | 009/010 through dependencies |
| Output | Reconciliation decisions, bounded import requests, renewal/retry/pause/escalation | Conditional/fenced changes only; no fabricated extraction envelopes | 009/011/013 |
| Output | Completion accounting and safe metrics | Assigned = accounted categories; unresolved visible; observation time distinct from import time | 015/018/reports |

## Dependencies and entry gate

Direct dependencies: **[011](SPEC-011-durable-dispatch.md), [013](SPEC-013-bronze-commit.md)**, verified with dispatch uncertainty and atomic import/checkpoint evidence. Their graph ancestors supply claiming, transport and evidence verification.

Blocked by **G0, D-03, D-04, D-07 and D-09**. Define numeric quiet checks/deadlines/backoff/jitter, pause thresholds, source error classification and operator escalation before readiness. D-06 retention/evidence and D-08 SQL settings must already be satisfied through 013. Approve this spec and its upstream checkpoints before code.

Parallel opportunity: other independently ready Actor/import work may continue while reconciliation fixtures are designed. Required reunion is **CP3** before first end-to-end acceptance (015/**CP4**); unresolved recovery cannot be deferred as later hardening. **CP5** verifies operational procedures. Use approved P-TEST quiet-poll/deadline values for the controlled fixture and separately approve real-source values.

## Acceptance criteria and traceability

AC identifiers below are prefixed `SPEC-014-`.

| ID | Observable pass condition | Requirements | Unit verification | Integration verification |
| --- | --- | --- | --- | --- |
| AC-01 | Expired/unknown running work is reconciled without replacement fetch; stale generation cannot renew/clear current ownership; renewal stops at its approved bound. | FR-01, FR-05, NFR-01–02 | Clock/ownership state matrix | Real SQL overlapping reconcilers and delayed owned Actor |
| AC-02 | Failed/aborted/timed-out run outputs retain partial successes; every manifest item is accounted for and missing output creates no observation. | FR-02, FR-04, NFR-03 | Manifest outcome matrix | Owned partial-output terminal runs plus SQL accounting |
| AC-03 | Lagged item count or temporary empty response cannot prematurely close ingestion; approved terminal/quiet/drain/reconciliation checks finalise a complete run; late appended data raises a recorded incident without losing it. | FR-03, NFR-01 | Delayed-visibility and late-write fixtures | Repeated provider/raw-offset inspection; terminal incomplete and incident-reopen cases |
| AC-04 | SQL failure and lost import acknowledgement resume retained output without new website requests; repeated cycles cannot duplicate events or clear newer ownership. | FR-04–05, NFR-02 | Recovery decision fixtures | Real SQL fault/replay with controlled fetch counters |
| AC-05 | Due refresh/backoff/429 calculations meet approved bounds; failed refresh preserves prior observation; unsafe backlog, blocking or parser regression pauses new work with reason. | FR-06, NFR-01, NFR-03 | Deterministic time/jitter/classification | Bounded recurrent fixture capture and backlog pause |
| AC-06 | Discovery and extraction sharing a group never gain concurrent active fetching permission while unknown/obsolete work is unresolved; pause/resume is auditable. | FR-07, NFR-03 | Shared admission matrix | Cross-Actor overlap, stop/reconcile and source pause |

## Tests, failures and recovery

First TDD red target: an expired SQL lease with an active provider run must trigger reconciliation rather than a new fetch. Unit tests cover all execution/import combinations, superseded attempts, missing events, jitter limits, delayed pages, pause and retention pressure. Integration exercises real MSSQL plus bounded owned Apify runs; provider visibility assumptions and injected lag must be labelled separately. Record fixture ownership and cleanup.

| Failure | Observable result / bounded action | Recovery |
| --- | --- | --- |
| Provider lookup unavailable/ambiguous | Keep unresolved admission; bounded reads then escalation | Reconcile later; no blind replacement |
| Terminal partial or missing dataset | Preserve usable output; incomplete assignments remain visible | Retained-output retry or approved new work after reconciliation |
| SQL/import/evidence unavailable | Import blocked/backlog pause; no fabricated completion | Resume ingestion after recovery within retention |
| Late event or competing reconciler | Historical evidence or fenced no-op | Current owner remains authoritative |
| Retention/deadline exhausted | Explicit irrecoverable/incomplete incident | Operator-approved recovery; never label successful |

Required test status: **NOT RUN**. [Reports](../standards/reporting-and-decisions.md) must show exact red/green commands, safe physical/logical IDs, SQL settings, controlled fault order, assignment counts and AC coverage.

## Definition of Done and completion

- [ ] G0/blockers resolved; 011/013 and inherited checkpoint gates verified; numeric policies explicit.
- [ ] Every FR/NFR/AC passes with meaningful TDD and real SQL/provider boundary evidence.
- [ ] Recovery checkpoint proves partial outputs, unknown launch, fencing, lost acknowledgement and import-only retry.
- [ ] Shared discovery/extraction admission, pause, retention/backlog limits and operator procedure are documented.
- [ ] No invented observations, uncontrolled refetch, new infrastructure or unresolved required checks; reports reviewed.

Implementation report: **not started**. Test results: **NOT RUN**. Verification/acceptance: **pending**. Architectural decisions: **none accepted**. Change history: **0.1 / 2026-10-18 / initial source-traced draft**.

