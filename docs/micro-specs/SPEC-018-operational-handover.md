# SPEC-018 — Operational handover and production acceptance

Status: **DRAFT — first-pipeline acceptance alone does not satisfy this gate.**

## Metadata

| Field | Value |
| --- | --- |
| ID / version / updated | SPEC-018 / 0.1 / 2026-10-18 |
| Owner / acceptance authority | Specification engineering / user or explicitly delegated operational owner |
| Priority / state | After first pipeline; before production sign-off / draft |
| Sources | [M §§6–9](../architecture/master-architecture.md); [R: operating controls, costs, retention and sign-off demonstrations](../architecture/architecture-review.md) |
| Decisions | G0; D-04, D-06–D-09 in the [approval register](../architecture/approval-register.md), all relevant portions open |
| Plan / graph | [Implementation plan](../architecture/implementation-plan.md); [DAG](../architecture/dependency-graph.md), v0.1 |
| Implementation / test evidence | Not started / NOT RUN |

## Objective and scope

Make the verified first pipeline operable, recoverable and reviewable using the existing integration service, Apify and MSSQL. Demonstrate controlled pause/rollback, retention, isolated database restore and production readiness against approved business limits.

In scope: minimal structured metrics, alerts/thresholds, operator runbooks, recovery drills and a sign-off dossier. Out of scope: mandatory dashboards, a new monitoring stack, larger-scale architecture or unapproved production exercises.

Source status: required operational capabilities derive from M/R. Production capacity, retention, RPO/RTO, ownership and threshold values remain unresolved; this spec cannot become ready with those values missing.

## Functional requirements

| ID | Required behaviour | Trace | AC |
| --- | --- | --- | --- |
| SPEC-018-FR-01 | Report discovery coverage/yield, new/known URLs, due/current/stuck work, success/error counts, freshness, ingestion lag and discovery-to-Bronze latency with source/run correlations. | M §7; R: operational controls | AC-01 |
| SPEC-018-FR-02 | Report cost per 1,000 valid, fresh, committed observations, including discovery, failed/duplicate work, browser/proxy execution, API/storage, SQL/backups and attributable operating effort; disclose unavailable estimates. | R: cost measurement | AC-02 |
| SPEC-018-FR-03 | Demonstrate source/rate-group pause and safe resume, preventing new dispatch while retaining imports and durable ownership; document handling of already running Actors. | R: shared rate limits and sign-off | AC-03 |
| SPEC-018-FR-04 | Demonstrate rollback to an approved pinned parser/build without altering immutable history, losing pending work or silently reinterpreting stored events. | R: parser rollback | AC-04 |
| SPEC-018-FR-05 | Provide and exercise runbooks for unknown launch, stuck ownership, SQL/import outage, quarantine review, parser regression, blocking and evidence/storage expiry. | M §§6–7; R: failure responses | AC-05 |
| SPEC-018-FR-06 | Restore an identified backup into an isolated actual SQL Server environment, verify control/Bronze consistency and reconcile external executions before any replacement fetching. | M §7; R: backup/restore | AC-06 |
| SPEC-018-FR-07 | Verify dataset/evidence retention exceeds the approved outage window, required evidence can be retrieved/replayed, and owned storage cleanup preserves active recovery dependencies. | R: retention and evidence | AC-07 |
| SPEC-018-FR-08 | Produce an operational dossier with owners, access references, capacity assumptions, measured limits, recovery evidence, known limitations and explicit production acceptance decision. | M §§7–9; R: final sizing | AC-08 |

## Non-functional requirements

| ID | Constraint and verification | Trace | AC |
| --- | --- | --- | --- |
| SPEC-018-NFR-01 | Approved numeric freshness, alert, capacity, cost, retention, RPO and RTO targets are explicit and compared with measured evidence; unknown values block production sign-off. | M §§7–9; D-07/D-08 | AC-01, AC-06, AC-08 |
| SPEC-018-NFR-02 | Recovery drills isolate resources, suppress live dispatch by default and preserve auditable ownership; restoration never writes over production as a test shortcut. | R: restore and fencing | AC-03, AC-06 |
| SPEC-018-NFR-03 | Use existing logs/platform reporting or approved facilities; sanitize telemetry/runbooks and restrict operator privileges. No new infrastructure is implied. | M §7; user constraint | AC-01, AC-05, AC-08 |

## Technical design and boundaries

- Own operator documentation in planned `docs/operations/` and operational functions in the existing integration service. Correlate SQL state and Apify run IDs without exposing sensitive raw URLs or payloads.
- Define metric denominators and time windows. Success counts accepted usable outcomes, not Actor success or HTTP 200; freshness uses observation time while ingestion delay uses pipeline timestamps.
- Cost denominator counts unique accepted successful observations satisfying the approved freshness rule during the reporting window. Replays do not increase it; a zero denominator reports undefined cost with its underlying numerator and zero count.
- Include known costs and attributed/estimated cost components separately; do not label a subtotal as full cost per 1,000 observations.
- Pause stops new work admission/dispatch. In-flight stop/abort and drain decisions follow an approved policy; retained output remains ingestible. Resume reconciles unknown physical work and ownership before new requests.
- Parser rollback changes future pinned execution configuration. Historical envelopes retain their original versions; selected evidence replay is separately identified, not an overwrite of old observations.
- A restored SQL checkpoint may predate external launches or commits. Keep dispatch disabled until reconciliation accounts for existing physical executions and safe replay boundaries.
- Use the approved backup and storage mechanisms. This spec neither provisions a backup service nor authorizes a destructive production restore.

## Inputs and outputs

| Direction | Contract and invariants | Owner |
| --- | --- | --- |
| Input | SPEC-015 acceptance evidence; approved source/freshness/failure and evidence policies | SPEC-015; D-06/D-07/D-09 |
| Input | SQL version/settings, backup identity, isolated restore target, authorized operator/access references and RPO/RTO | D-04/D-08 |
| Input | Expected URL population, refresh frequency, browser share, payload/evidence sizes, retention and cost ceiling | D-07; R: final sizing |
| Output | Minimal metric definitions/reports, thresholds and pause/rollback/recovery/retention runbooks | Operational owner |
| Output | Sanitized drill records and production acceptance matrix with measured gaps and authority/date | Reporting standard |

## Dependencies and entry gate

Direct prerequisite: **SPEC-015**, verified first-pipeline acceptance and its complete dependency evidence. G0 and applicable D-04/D-06/D-07/D-08/D-09 decisions must be resolved; this spec must be `ready` before implementation/drills.

Runbook drafts and metric definitions may be prepared while SPEC-015 is underway. CP5 verification requires the accepted interfaces and real pipeline evidence; production remains blocked until the approved sizing, recovery and operating targets pass. A bounded pilot acceptance must state its limits explicitly rather than silently waive production criteria.

## Acceptance criteria and traceability

IDs below have the full prefix `SPEC-018-`.

| ID | Given / when / then pass condition | Requirements | Verification |
| --- | --- | --- | --- |
| SPEC-018-AC-01 | Given known pipeline activity and induced backlog/error states, reported coverage/counts/freshness/lag reconcile to SQL/run evidence, approved thresholds are evaluated and sanitized diagnostics identify the affected source/stage. | FR-01, NFR-01, NFR-03 | Controlled operational scenario and metric inspection; CP5 |
| SPEC-018-AC-02 | Given a cost window, known failed/duplicate requests and replays, the full numerator and unique fresh-commit denominator reproduce the reported cost; missing components and a zero denominator are explicit. | FR-02 | Unit calculation fixtures and actual-account report reconciliation; CP5 |
| SPEC-018-AC-03 | Given active and queued work, pause prevents new dispatch, handles active Actors according to policy, preserves ingestible output and resume reconciles ownership before replacement fetching. | FR-03, NFR-02 | Controlled pipeline pause/resume drill; CP5 |
| SPEC-018-AC-04 | Given a faulty parser release, rollback selects the approved prior build/profile for future work, preserves event versions/history and permits selected evidence replay with separate provenance. | FR-04 | Pinned-version rollback drill and SQL history comparison; CP5 |
| SPEC-018-AC-05 | Given each documented failure, the designated operator follows the runbook to a bounded safe state; escalation, privileges, retained progress and recovery limits are explicit. | FR-05, NFR-03 | Witnessed drills/tabletop where no runtime assertion is claimed; CP5 |
| SPEC-018-AC-06 | Given an identified backup and isolated actual SQL target, restoration meets approved RPO/RTO, preserves expected event/attempt/checkpoint consistency and blocks dispatch until external-run reconciliation completes. | FR-06, NFR-01, NFR-02 | Actual backup/restore and consistency drill, recorded settings/timings; CP5 |
| SPEC-018-AC-07 | Given selected retained evidence and outage-aged output, approved retrieval/checksum/replay works, retention covers the recovery window and cleanup excludes unresolved ingestion dependencies. | FR-07 | Retention/access review and controlled storage/replay drill; CP5 |
| SPEC-018-AC-08 | Given all evidence, named owners approve explicit supported load, limits and recovery targets; required gaps remain blocking and the dossier records the production acceptance authority/date without new unapproved infrastructure. | FR-08, NFR-01, NFR-03 | Dossier and acceptance review; CP5 |

## Tests, failures and recovery

For operational application behaviour, begin TDD with a meaningful failing pause/admission or cost-denominator case. Unit tests cover classifications, thresholds and arithmetic; runbook prose uses inspection rather than invented unit tests.

Use real SQL for restore/consistency tests and identify actual Apify/runtime coverage separately. Isolate drill IDs and prove restore-target identity before writes. Do not perform a production failover, deletion or restore merely to satisfy this draft. A failed restore or unmeasured RPO/RTO blocks acceptance; preserve the original backup and diagnose in isolation. Missing retained evidence, unknown spending or absent owners remain visible gaps, with approved corrective action and finite escalation. No missing required check becomes a pass through a tabletop exercise.

Store evidence under `reports/tests/SPEC-018/` and implementation records under `reports/implementation/SPEC-018/`. **No operational drills, restores or application tests have been run for this draft.**

## Definition of Done

- [ ] All FR/NFR/ACs verified and CP5 evidence linked; production sizing and RPO/RTO are explicit.
- [ ] Source pause/resume, parser rollback, retained-evidence replay and actual isolated SQL restore demonstrated.
- [ ] Runbooks identify owners, escalation, safe access and recovery/retention limits.
- [ ] Reports preserve actual results and limitations; no required check skipped or blocked.
- [ ] Production acceptance authority/date and approved operating envelope recorded separately from SPEC-015.

Completion record: implementation, verification reviewer/date and acceptance authority/date **not started / pending**. Change history: **0.1, 2026-10-18 — initial source-traced draft for G0 review**.
