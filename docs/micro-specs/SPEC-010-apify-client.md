# SPEC-010 — Apify transport adapter

Version: **0.1**. Updated: **2026-10-18**. State: **draft**. Implementation: **not started**.

Owner: unassigned integration-service implementer. Acceptance authority: user or delegated reviewer.
Plan: [dependency graph](../architecture/dependency-graph.md), [implementation plan](../architecture/implementation-plan.md).
Sources: [M](../architecture/master-architecture.md) §§5–7; [R](../architecture/architecture-review.md): "The SQL-to-Apify handoff needs a precise failure-recovery protocol." and "Apify datasets need an explicit retention and ingestion policy." Source revisions: [master-spec v0.1](../architecture/master-spec.md).

## Objective and scope

Provide one bounded, testable transport boundary for starting pinned owned Actors, reading their run-specific state/storage, and locating possibly accepted launches. This enables durable dispatch without pretending the provider supports exactly-once launch.

In scope: Apify authentication, start/status/input/dataset access, bounded run lookup, error classification and safe transport diagnostics. Out of scope: SQL state transitions (011), raw checkpoint rules (012), scheduling/reconciliation (014), source fetching (003/006), and provisioning accounts or infrastructure.

Requirements are proposed interpretations of M/R. User approval remains required for the open decisions below; no implementation is authorised by this draft.

## Requirements

| ID | Required behaviour | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-010-FR-01 | Validate the versioned Actor input and pinned Actor/build reference before one start request; return actual run/storage identifiers on accepted launch. | M §§5–6; R: handoff; D-04 | AC-01 |
| SPEC-010-FR-02 | Do not automatically retry start POSTs at the SDK, transport, or application layer. A timeout, disconnect, interrupted response, or otherwise unproven acceptance becomes `unknown`, with safe correlation evidence. | R: handoff; D-03 | AC-02 |
| SPEC-010-FR-03 | Support bounded lookup of candidate runs and inspection of their INPUT `dispatch_id`, logical-run correlation and immutable manifest fingerprint. A match requires approved contract identifiers, not timestamps or Actor identity alone. Return zero, one or multiple matches, and an explicit incomplete-search result. | R: handoff; D-03 | AC-03 |
| SPEC-010-FR-04 | Read actual run status, run INPUT and storage using physical run-specific IDs. Expose success, failure, aborted, timed-out and nonterminal states without equating execution success with ingestion success. | M §§5–6; R: handoff | AC-04 |
| SPEC-010-FR-05 | Expose bounded ascending raw dataset-page reads without clean/skip/unwind transformations; distinguish an empty page, unavailable storage, and a failed read. | R: dataset retention policy | AC-05 |
| SPEC-010-FR-06 | Return typed validation, definitive rejection, throttling, authentication, transient-read and unknown-start errors with safe request/run correlation; never make durable scheduling decisions. | M §7; R: handoff | AC-02, AC-06 |

| ID | Non-functional requirement and verification | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-010-NFR-01 | Every request, lookup page and safe read retry is bounded by D-07 time/page/attempt/byte limits; cancellation stops new requests. Inspect and fault-test approved configuration. | M §7; D-07 | AC-03, AC-05, AC-06 |
| SPEC-010-NFR-02 | Obtain credentials only through 016's approved secret reference; restrict provider endpoints and redact credentials, raw INPUT and sensitive payloads from diagnostics. Negative tests verify redaction. | M §7; D-04 | AC-06 |
| SPEC-010-NFR-03 | Pin compatible SDK/API usage during implementation and verify actual start retry settings and run-storage shapes against official provider documentation and a bounded live test. Mocks alone cannot prove provider behaviour. | R: implementation approach | AC-01, AC-04 |

## Technical design and boundaries

Planned owner: an Apify adapter module inside `apps/integration-service`; shared message ownership remains in 002. Keep injectable clock/HTTP boundaries for deterministic fault tests. No SQL client belongs here.

Expose narrow operations for start, get-run, get-input, find-correlated-runs and read-raw-page; 017 may use approved storage access through the same boundary. Return provider IDs rather than consulting a mutable "last run" endpoint. Bind Actor version/build explicitly; a changed build is not silently selected on retry.

Disable SDK start retries explicitly and inspect underlying middleware retry behaviour. Safe idempotent reads may retry within D-07. Treat uncertainty conservatively: a successful provider acceptance can coexist with a lost local response. Finding no run within an incomplete or visibility-limited search does not prove no launch occurred. 011/014 decide what to do with that uncertainty.

Candidate lookup filters by the owned Actor and bounded interval, then checks the run's INPUT against 002's immutable UUID `dispatch_id`, logical-run correlation and manifest fingerprint. Preserve multiple matches for separate physical-execution records. Never log complete Actor INPUT to establish the match. Read identifiers using 002's wire types: no conversion of BIGINT-backed decimal strings to imprecise JSON numbers.

## Inputs and outputs

| Direction | Contract / type | Validation and semantics | Owner / consumer |
| --- | --- | --- | --- |
| Input | Required Actor/build reference, versioned INPUT object and logical correlation | Approved Actor only; required identity and limits; malformed input produces no start request | 002/016 → adapter |
| Input | Required physical run ID or dataset ID; integer raw offset/page bound | No "last run" alias; nonnegative positions and finite limits | 011/012/014 |
| Output | Start result: accepted IDs, definitive rejection, or unknown | IDs are strings; optional storage IDs remain absent until provider supplies them; unknown is not rejected | 011 |
| Output | Run status, match set/search completeness, raw page or typed error | Preserve physical identities and raw ordering; empty page is not completion | 012/014/017 |

## Dependencies and entry gate

Direct dependencies: **[002](SPEC-002-contracts.md), [016](SPEC-016-runtime-security.md)**, verified at their required contract/security checkpoints. No additional implementation dependency is implied by consumer references.

Blocked by **G0, D-01/D-03 through 002, D-04 and D-07** in the [approval register](../architecture/approval-register.md). Specify approved Actor IDs/builds, credentials mechanism, lookup horizon, provider timeouts and finite limits before readiness. Readiness also requires this spec's review and one file owner.

Parallel opportunity: 003 and 009 can proceed independently when their own prerequisites pass. Reunite transport with 011/012/017 at **CP3**, then the real provider pipeline at **CP4**; all results remain pending until actual integration. [P-TEST](../architecture/implementation-plan.md#controlled-acceptance-profile-p-test-proposal-not-production-sizing) supplies proposed controlled-fixture limits, subject to D-07.

## Acceptance criteria and traceability

AC identifiers below are prefixed `SPEC-010-`.

| ID | Observable pass condition | Requirements | Unit verification | Integration verification |
| --- | --- | --- | --- | --- |
| AC-01 | Valid pinned input makes one start call and returns that run's actual identifiers; invalid input makes none. | FR-01, NFR-03 | Input validation / call-count fixture | Bounded owned Actor start; inspect build/input/run identity |
| AC-02 | A launch accepted remotely with its response lost produces unknown and exactly one attempted POST in the adapter. | FR-02, FR-06 | Inject post-acceptance disconnect and timeout | Fault-proxy/provider experiment, safely bounded; feed 011 |
| AC-03 | Matching INPUT selects all genuine candidates; wrong manifest, no match and exhausted search remain distinguishable; no retry launch occurs. | FR-03, NFR-01 | Multiple candidates / deadline fixtures | Read real run INPUT; prove bounded lookup |
| AC-04 | Each terminal/nonterminal provider state and its run-specific storage maps accurately without claiming SQL success. | FR-04, NFR-03 | Status mapping fixtures | Owned successful and failed run inspection |
| AC-05 | Raw page order and offsets are preserved; an empty page, unavailable dataset and timeout are distinct. | FR-05, NFR-01 | Page boundary / error fixtures | Small known dataset; verify no transformations |
| AC-06 | Authentication, 429, cancellation and exhausted safe-read retries stop within approved limits and reveal no secrets. | FR-06, NFR-01–02 | Fault and redaction fixtures | Restricted credential and bounded throttle/error checks |

## Tests, failures and recovery

First TDD red target: a lost accepted-start response must not trigger a second POST. Unit cases additionally cover malformed input, duplicate matches, foreign INPUT, missing storage IDs, pagination caps, cancellation and redaction. Integration uses an authorised test Actor/account and synthetic inputs; record real provider versus injected observations separately and clean only owned resources.

| Failure | Observable result / finite retry | Recovery owner |
| --- | --- | --- |
| Start response unavailable or cancellation after send | Unknown; no start retry | 011 persists uncertainty; 014 correlates executions |
| Documented definitive nonacceptance | Typed rejected result; no blind POST retry | 011 applies approved policy |
| Read timeout/429 | Typed read failure after bounded retry/delay | Caller resumes without inventing state |
| Auth/config error or malformed input | Terminal configuration/validation error; no request loop | Operator fixes secret/config; no payload logging |
| Candidate lookup incomplete | Explicit unresolved result | 014 holds replacement dispatch pending reconciliation |

Required test status: **NOT RUN**. Write actual red/green commands, provider versions, limits, exit codes and AC evidence using [reporting standards](../standards/reporting-and-decisions.md); no executable commands are specified before 001 pins tooling.

## Definition of Done and completion

- [ ] G0 and named blockers resolved; upstream gates verified and this spec ready before code.
- [ ] All FR/NFR/AC checks pass with meaningful red/green and real provider evidence.
- [ ] Dispatch/import consumers agree on uncertainty, run identity and raw-page semantics.
- [ ] No unapproved service or SDK dependency; safe configuration and failure behaviour documented.
- [ ] Reports, exact tested revision, limitations and reviewer recorded; no required skipped/blocked checks.

Implementation report: **not started**. Test results: **NOT RUN**. Verification/acceptance: **pending**. Architectural decisions: **none accepted**. Change history: **0.1 / 2026-10-18 / initial source-traced draft**.

