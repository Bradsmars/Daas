# SPEC-011 — Durable Actor dispatch and physical run binding

Version: **0.1**. Updated: **2026-10-18**. State: **draft**. Implementation: **not started**.

Owner: unassigned integration-service implementer. Acceptance authority: user or delegated reviewer.
Plan: [dependency graph](../architecture/dependency-graph.md), [implementation plan](../architecture/implementation-plan.md).
Sources: [M](../architecture/master-architecture.md) §§5–7; [R](../architecture/architecture-review.md): "The SQL-to-Apify handoff needs a precise failure-recovery protocol.", "Lease expiry must trigger reconciliation, rather than immediate rescraping." and "Rate limits and retries must be controlled across both stages." Source revisions: [master-spec v0.1](../architecture/master-spec.md).

## Objective and scope

Turn committed scheduling intent into accountable Apify execution without losing work or creating uncontrolled duplicate website requests when a launch response is lost.

In scope: consume 009's committed claims/admission, dispatch state transitions, immutable INPUT/manifest correlation, provider call, physical run/storage binding and interrupted-dispatch recovery. Extraction attempts use the immutable assignment manifest; discovery uses its approved source-scope input and the same fetching-group admission boundary. Out of scope: claiming algorithm (009), transport (010), result import (012/013) and full reconciliation/scheduling (014). No broker or separate outbox service is introduced.

The review's stronger run/ownership model is proposed, not yet approved. D-03 must resolve its differences from M before implementation.

## Requirements

| ID | Required behaviour | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-011-FR-01 | Dispatch only durable intent whose logical run, immutable UUID `dispatch_id`, input/manifest, attempt identities/fences where applicable, and shared fetching-group admission have committed before the network call. | M §§5–6; R: handoff; D-03 | AC-01 |
| SPEC-011-FR-02 | Acquire a conditional dispatch transition so overlapping dispatchers cannot both submit the same known intent. Shared proposed dispatch states are pending, submitting, bound and dispatch_unknown; record rejection/finalization dispositions separately under 002/007's model. | R: handoff; D-03 | AC-01, AC-02 |
| SPEC-011-FR-03 | A missing launch response, process death during submitting, or lost SQL binding acknowledgement leaves recoverable unknown intent; do not automatically submit again. | R: handoff | AC-02 |
| SPEC-011-FR-04 | Record every discovered physical run and its actual dataset/build IDs separately from the logical batch; zero, one or multiple executions are representable without rewriting the manifest. | R: handoff, lifecycle separation; D-03 | AC-03 |
| SPEC-011-FR-05 | Reconcile candidate INPUT correlation/fingerprint before any replacement start. Unknown or active execution keeps its shared site group reserved; multiple matches trigger bounded hold/stop/review policy rather than additional launches. | R: handoff, lease expiry, shared rate limits; D-04 | AC-03, AC-04 |
| SPEC-011-FR-06 | Preserve current attempt/generation ownership on all accepted binding/state changes; emit a durable outcome for 014 and never mark URL or SQL ingestion successful from Actor launch/completion. | M §§5–6; R: lease expiry | AC-05 |

| ID | Non-functional requirement and verification | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-011-NFR-01 | SQL transactions are short and contain no Apify calls; fault tests prove a blocked provider request cannot hold claim/dispatch transactions open. | M §6; R: handoff | AC-01 |
| SPEC-011-NFR-02 | Dispatch, uncertainty search and operator escalation obey D-07 deadlines/attempt caps. Missing definitive evidence never becomes permission for an unbounded relaunch. | R: handoff; D-07 | AC-02–04 |
| SPEC-011-NFR-03 | Audit logical/physical IDs and safe state reasons, excluding secrets and raw sensitive INPUT; immutable input fingerprints use 002's approved rules. | M §7; D-03 | AC-03, AC-05 |

## Technical design and boundaries

Planned owner: dispatcher module in `apps/integration-service`; 007 owns SQL tables and 009 owns claims/admission. 010 owns the provider client. No Actor has SQL access.

The claim transaction creates the immutable logical run, `dispatch_id` and dispatch intent together. After commit, a conditional SQL operation elects one dispatcher and persists submitting before it calls 010. The Actor INPUT carries exactly that durable dispatch identity, logical correlation and manifest fingerprint from 002. On accepted response, a separate transaction upserts the actual physical execution by provider run ID and binds it to the logical run; a binding retry never starts another Actor.

At startup, abandoned submitting work enters dispatch_unknown after the approved dispatcher timeout. This state does not prove whether a provider run exists. Search candidate runs and validate their INPUT; absence in a bounded search can remain inconclusive because of visibility/retention limits. 014 owns subsequent ongoing reconciliation. A documented definitive rejection can follow the approved retry/backoff policy; ambiguous acceptance cannot.

Admission is shared by discovery and extraction. Do not release a rate-limit-group reservation merely because a SQL lease expired, a start timed out, or the launch response failed to persist. Resolve/stop obsolete executions under the approved policy before replacement fetching. Fencing protects SQL ownership; it does not stop an old Actor's HTTP requests.

## Inputs and outputs

| Direction | Contract / type | Validation and invariants | Owner / consumer |
| --- | --- | --- | --- |
| Input | Required committed `run_id`/`dispatch_id`, Actor/build, versioned immutable INPUT and fetching-group admission | UUID run/dispatch/attempt IDs; decimal-string source/URL/generation; opaque Apify IDs; discovery uses `discovery_run_id` | 009/002 |
| Input | Accepted / rejected / unknown start result, or correlated physical-run set | Physical IDs and correlation validated; incomplete search remains explicit | 010 |
| Output | Durable dispatch state and physical execution bindings | Unique provider run identity; logical manifest unchanged; no fabricated run ID | 014/012 |
| Output | Safe diagnostic/escalation and held/released group status | Fenced SQL updates; release requires approved proof/policy | 009/014/operations |

## Dependencies and entry gate

Direct dependencies: **[009](SPEC-009-work-claiming.md), [010](SPEC-010-apify-client.md)**, verified for atomic intent/admission and typed transport uncertainty respectively. Read the [normative DAG](../architecture/dependency-graph.md) for transitive schema/contract/security dependencies.

Blocked by **G0, D-03, D-04, D-07 and D-08**. D-08 is inherited through 009's real SQL claim/binding configuration. Approve state transitions, operator ownership, search/deadline limits and duplicate-execution stop policy; complete upstream gates and spec review before readiness.

Parallel opportunity: 012 and 017 after their own prerequisites. Reunite 009/010/011 in **CP3: ownership and ingestion correctness**; 014 later integrates long-running recovery, and **CP4** verifies the bounded provider pipeline. P-TEST values remain proposals subject to D-07.

## Acceptance criteria and traceability

AC identifiers below are prefixed `SPEC-011-`.

| ID | Observable pass condition | Requirements | Unit verification | Integration verification |
| --- | --- | --- | --- | --- |
| AC-01 | No start occurs for rolled-back intent; committed intent starts only after transaction completion; overlapping dispatchers elect one submitting owner. | FR-01–02, NFR-01 | Transition/order fixture | Real MSSQL concurrent dispatchers plus controlled provider delay |
| AC-02 | Crash before/after provider acceptance and lost binding acknowledgement preserve unknown or bound work; restart performs zero blind relaunches. | FR-02–03, NFR-02 | Each crash-window fixture | Persisted-state restart with injected lost response/ack |
| AC-03 | One or multiple matching provider runs bind as separate physical records to the original manifest; nonmatching INPUT never binds. | FR-04–05, NFR-02–03 | Correlation / duplicate-ID fixtures | Real run INPUT and SQL binding replay |
| AC-04 | Unknown/active runs hold the same fetching group across both Actor types; expired lease alone cannot admit replacement fetching. | FR-05, NFR-02 | Admission decision fixtures | Discovery/extraction admission overlap and delayed execution |
| AC-05 | Stale dispatch completion cannot overwrite newer attempt/generation; neither launch nor provider success sets SQL ingestion success; safe audit remains traceable. | FR-06, NFR-03 | Fence/redaction fixtures | Real SQL stale binding and independent ingestion-state inspection |

## Tests, failures and recovery

First TDD red target: a submitting process interrupted after remote acceptance must not launch a second Actor after restart. Unit tests cover every conditional transition, unknown result, candidate mismatch, repeated binding and group hold. Integration uses isolated MSSQL records plus one bounded owned Actor; fault injection covers network acceptance loss and SQL acknowledgement loss separately. A mock-only test cannot establish SQL concurrency or real INPUT matching.

| Failure | Observable state / retry bound | Recovery |
| --- | --- | --- |
| SQL intent transaction fails | No committed intent; no provider call | Retry claim only under 009 policy |
| Worker dies in submitting / launch uncertain | dispatch_unknown after bounded stale-owner detection | Correlate physical runs before replacement |
| SQL binding fails after accepted start | Unknown or pending durable binding; retain safe run correlation | Replay binding / lookup; no new start |
| Multiple physical matches | Account for each run; keep group held | 014 reconciles/approved stop or operator escalation |
| Stale ownership or disabled source | Reject authoritative mutation/new fetching | Retain history; reconcile current owner |

Required test status: **NOT RUN**. Record red/green, exact commands/exit codes, tested snapshot, crash points, SQL settings, safe run IDs and AC evidence under [reporting standards](../standards/reporting-and-decisions.md).

## Definition of Done and completion

- [ ] G0 and blockers resolved; 009/010 verified; scope and transition contract reviewed.
- [ ] All FR/NFR/AC checks pass, including real SQL overlap and lost-response restart.
- [ ] Every launch is accountable as intent plus separate physical records; no exactly-once claim.
- [ ] Dispatch-recovery checkpoint passes; 014 receives unresolved intent without losing site admission.
- [ ] Reports and decisions updated with no secrets, unapproved infrastructure or required missing checks.

Implementation report: **not started**. Test results: **NOT RUN**. Verification/acceptance: **pending**. Architectural decisions: **none accepted**. Change history: **0.1 / 2026-10-18 / initial source-traced draft**.

