# SPEC-006 - Assigned-work extraction Actor

Status: **draft for review; implementation not started**. Version 0.1. Updated 18 October 2026.
Owner: unassigned. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §5; R: Stage 2 needs to establish usable extraction before declaring success.; R: Change the extraction contract to identify work, observations and delivery separately.
Blocking approvals: [D-02, D-03, D-06, D-07, D-09; G0](../architecture/approval-register.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: not started / NOT RUN. Review recommendations remain proposed until G0 and relevant decisions are accepted.

## Objective and scope

Fetch exactly the assigned approved work and emit attributable usable observations or explicit outcome envelopes.

Crawlee run lifecycle, manifest-constrained fetching, source adapter invocation, provenance, evidence staging and outcome dataset. Excludes durable scheduling, SQL status updates and arbitrary recursive discovery.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-006-FR-01 | Validate immutable batch/dispatch/attempt/context/generation input and pinned profile/build; create a fresh per-physical-run Crawlee queue using attempt-aware request keys. | M §5; R: work-aware queue |
| SPEC-006-FR-02 | Fetch only assigned URLs under approved request context and all target controls; pass response/DOM to the approved adapter and preserve requested/final URL plus redirects and observation time. | M §5; 004, 005, 016 |
| SPEC-006-FR-03 | Emit a stable producer-generated event ID per completed observation/outcome, including attempt/generation and actual Apify run, schema/parser/profile/build versions, records, nullable HTTP status and structured errors. | R: extraction contract |
| SPEC-006-FR-04 | Stage required evidence and references/checksums before emitting an outcome requiring it; redelivery preserves ID/content while a real refetch creates a new event. | R: evidence; 017 |
| SPEC-006-FR-05 | Attempt to account for every processed assignment, but retain useful partial output if interrupted; killed/unstarted work is reconciled as missing by the integration service, not fabricated as fetched. | R: missing results and partial outputs |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-006-NFR-01 | Concurrency, request/byte/time/redirect limits, local retries, session rotations and Actor restarts all have explicit approved finite caps; source-wide admission is enforced externally as well. | M §7; R: rate limits; D-07; AC matrix below |
| SPEC-006-NFR-02 | No SQL access, warehouse acknowledgment or persistent inventory queue; run output is independently retrievable by physical execution ID. | M §2, §6; AC matrix below |
| SPEC-006-NFR-03 | An HTTP200 page cannot bypass adapter validity; correlation diagnostics expose no secrets, cookies or sensitive full content. | 005; M §7; AC matrix below |

## Technical design and boundaries

Own `apps/extraction-actor`. Use the approved HTTP crawler or justified browser for this source. Disable unapproved traversal/enqueueLinks; newly noticed targets can be reported separately through validated discovery intake but do not expand assigned work. Distinct assignments for one URL must not collapse under default queue deduplication. Separate local request retries from true new observations: once a terminal envelope is produced, repeated dataset writes reuse event identity/content. Use a serialized immutable envelope before output retry. Physical duplicate runs have distinct event IDs and are reconciled in SQL; do not promise exactly one physical fetch. Raw context-dependent representation is retained according to 017.

## Inputs and outputs

Input: ExtractionInput from 002 with run_id, dispatch_id, source_id, context, profile/build versions, bounded immutable assignments {attempt_id,url_id,canonical_url,lease_generation} and limits. Outputs: zero or more immutable ExtractionEvents, optional per-run emitted-assignment summary and evidence objects. One event can contain multiple business records; a killed Actor may omit events for unfinished assignments.

## Dependencies and entry gate

Direct prerequisites: [SPEC-004](SPEC-004-url-normalization.md), [SPEC-005](SPEC-005-source-adapter.md), [SPEC-016](SPEC-016-runtime-security.md), [SPEC-017](SPEC-017-evidence-replay.md).
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

## Acceptance criteria and traceability

**Verification boundary:** Own verification covers actual Crawlee behavior, hosted Actor output and its already verified evidence/security boundaries. SQL freshness, shared admission and partial-output import are downstream CP3/CP4 integration obligations, not prerequisites for Actor verification.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-006-AC-01 | Two assigned URLs produce two usable success envelopes with correct IDs/versions/context/records; a new scheduled batch can fetch the same URLs again with new event identities. | FR-01, FR-02, FR-03, NFR-02 | Queue-key tests and golden envelope assertions. | CP2/CP4: actual Crawlee queue then hosted Apify dataset. |
| SPEC-006-AC-02 | Network/429/HTTP/semantic failures are explicit typed outcomes with nullable status where appropriate; challenge HTTP200 is never success; no unassigned link is fetched. | FR-02, FR-03, NFR-01, NFR-03 | Bounded fake-clock retry/error matrix and redirect/subresource target tests. | CP4: source fixture mixed valid/invalid output and freshness checks. |
| SPEC-006-AC-03 | A dataset write retry repeats identical event ID/content; required evidence is hash-verifiable, and abort after one assignment leaves that observation retrievable without an invented event for unfinished work. | FR-04, FR-05 | Output-failure seam, evidence-stage failure and mid-batch interruption. | CP3/CP4: failed terminal run's useful partial output is ingested and remaining assignments reconciled. |

## Unit and integration test requirements

TDD first: two assignments sharing a URL but having distinct attempt IDs are not collapsed. Test input mismatch, context propagation, per-request and run budgets, evidence failure, zero/many records, stable redelivery, new-refetch identity, blocked/timeout/cancel outcomes and no recursive expansion.

Use actual Crawlee against controlled fixture content and actual Apify storage in a separately recorded bounded run. Test fresh queues across recurring captures. Cross-stage group occupancy/admission is verified with 009/011/014 at CP3/CP4. MSSQL success cannot be inferred from this Actor's status.

Use [test-strategy](../standards/test-strategy.md); commands are established by 001 and actual results recorded later. All checks in this draft are planned, not executed.

## Error handling and recovery

Unsupported input or profile fails before fetch. Exhausted local retry emits failure if execution can still write. Evidence staging failure blocks usable success when policy requires evidence. Process death may leave partial output and missing assignments; importer/reconciler owns recovery. No automatic SQL retry, inventory mutation or unbounded session rotation.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Open: D-02, D-03, D-06, D-07, D-09; G0. The register identifies the information needed and the authority. Contract changes update affected dependents before implementation.

- [ ] Manifest restriction, semantic validity, provenance, stable output replay, evidence policy and bounded runtime verified; partial output case demonstrated; output compatible with importer; Actor has no SQL capability.
- [ ] All FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [ ] Required real-boundary checks pass; skipped, blocked or failing required checks remain unverified.
- [ ] Shared contracts, security, failure recovery and relevant integration checkpoint reviewed.
- [ ] No unapproved infrastructure or deviations; implementation/test reports and any accepted ADRs linked.
- [ ] Verification recorded separately from acceptance; current state remains draft until actual gates pass.

Completion record: report none; tested revision none; reviewer/date pending; acceptance pending.
Change history: v0.1 initial source-traced draft, 18 October 2026.

