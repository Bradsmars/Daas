# SPEC-015 — First working end-to-end pipeline acceptance

Status: **DRAFT — G0 and the decisions below block implementation and live execution.**

## Metadata

| Field | Value |
| --- | --- |
| ID / version / updated | SPEC-015 / 0.1 / 2026-10-18 |
| Owner / acceptance authority | Specification engineering / user or explicitly delegated reviewer |
| Priority / state | First pipeline / draft |
| Sources | [M §§3–8](../architecture/master-architecture.md); [R: handoff, leases, extraction validity, datasets and sign-off demonstrations](../architecture/architecture-review.md) |
| Decisions | G0; D-01–D-09 in the [approval register](../architecture/approval-register.md), all open |
| Plan / graph | [Implementation plan](../architecture/implementation-plan.md); [DAG](../architecture/dependency-graph.md), v0.1 |
| Implementation / test evidence | Not started / NOT RUN |

## Objective and scope

Demonstrate one approved source and context from discovery through SQL inventory, scheduled extraction and durable Bronze history. First exercise a deterministic fixture, then a bounded approved target using real Apify and MSSQL.

In scope: cross-component wiring, conservation counts, recurring observations, replay and the baseline failure guarantees. Out of scope: Silver/Gold, multi-source scale and production operational acceptance, owned by SPEC-018.

Source status: the architecture is available; review-derived changes and source-specific choices remain proposed until approved. Passing this spec does not imply production readiness.

## Functional requirements

| ID | Required behaviour | Trace | AC |
| --- | --- | --- | --- |
| SPEC-015-FR-01 | Execute discovery → run-specific dataset → validated SQL inventory → atomic claim/intent → extraction → raw dataset import → Bronze/outcome/checkpoint → reconciliation. Both fixture and live paths retain SQL as the control plane. | M §§2–6; R: handoff | AC-01, AC-02 |
| SPEC-015-FR-02 | Preserve correlations across discovery provenance, URL/context, logical batch, attempt/generation, physical run, event and dataset offset. Account for every assigned attempt and consumed raw position. | M §§4–7; R: contracts | AC-01, AC-02 |
| SPEC-015-FR-03 | Re-ingest committed output after a lost acknowledgement without duplicate events or authoritative outcomes. A genuinely new due capture produces a new observation even when fields are unchanged. | M §§4–6; R: event identity | AC-03 |
| SPEC-015-FR-04 | Demonstrate disjoint concurrent claims, fenced stale completions and reconciled unknown launches without uncontrolled replacement fetching. | R: handoff and lease expiry | AC-04 |
| SPEC-015-FR-05 | Import usable partial results from failed, aborted and timed-out physical executions; reconcile missing assignments without fabricated observations. | R: handoff and contracts | AC-05 |
| SPEC-015-FR-06 | Recover from SQL/import failure and poisoned raw items using durable output, atomic checkpoints and retained quarantine, without unnecessary refetching. | M §7; R: datasets | AC-06 |
| SPEC-015-FR-07 | Reject false extraction success and preserve coverage semantics: HTTP 200 alone is insufficient; incomplete discovery never retires absent URLs. | R: discovery and usable extraction | AC-07 |
| SPEC-015-FR-08 | Verify required evidence availability and selected parser replay under the approved retention policy; publish a requirement-to-evidence acceptance matrix. | R: Bronze evidence; D-06 | AC-08, AC-09 |

## Non-functional requirements

| ID | Constraint and verification | Trace | AC |
| --- | --- | --- | --- |
| SPEC-015-NFR-01 | Fixture results and fault ordering are repeatable using controlled clocks, inputs and barriers; real SQL validates transaction/concurrency properties. | M §7; engineering standard | AC-01, AC-04, AC-06 |
| SPEC-015-NFR-02 | Every live run stays within approved request, cost, time, batch and retention limits; missing limits block execution. Report actual consumption against those limits. | M §7; D-07 | AC-02, AC-09 |
| SPEC-015-NFR-03 | Evidence is sanitized and distinguishes mocked, fixture, real SQL and real Apify coverage. No credentials or sensitive scraped content enter reports. | M §7; reporting standard | AC-09 |

## Technical design and boundaries

- Own acceptance coordination under planned `tests/` and reports; call the integration service's public workflow rather than inserting a prebuilt successful result directly into Bronze.
- Deterministic transport substitutes may control Apify responses in the fixture phase. Use actual SQL for durable inventory, claims, ingestion and assertions; identify substituted boundaries explicitly.
- The live phase uses owned, pinned Actor builds and run-specific storage IDs. Actors never receive SQL credentials or connect to MSSQL.
- Use the plan's proposed **P-TEST** profile only after D-07 approval: two distinct valid detail URLs, a repeat, an out-of-scope link and non-target navigation. The first pass creates exactly **2 inventory identities, 2 attempts and 2 success events**; each page yields one approved synthetic record.
- Re-delivering both discovery and extraction datasets adds **0 inventory identities and 0 events**. A subsequent due capture creates **2 new attempts and 2 new events**, preserving the first observations; total success-event count becomes **4**.
- P-TEST uses raw page/transaction size 1 and the finite limits in the plan. Real-source execution requires separately approved permissions, budgets, cost ceiling and retention; fixture values never imply production sizing.
- For faults, reconcile each assignment as accepted terminal work or explicitly unresolved/superseded work. Count raw positions separately as new-event, identical-replay or quarantine decisions; these transport counts are not URL counts.
- Use isolated test identifiers and owned records. Preserve evidence before cleaning only resources proven to belong to the run; cleanup is not permission to erase unrelated history.

## Inputs and outputs

| Direction | Contract and invariants | Owner |
| --- | --- | --- |
| Input | Approved source/context/profile, seeds and sanitized fixture; explicit expected fields, cardinality, counts and coverage | D-02, D-05; SPEC-002/005 |
| Input | Approved runtime, SQL test environment, pinned Actors, secret references, fault schedule and numeric budgets | SPEC-016; D-04/D-07/D-08 |
| Output | Discovery coverage, inventory/attempt/event/checkpoint observations and sanitized run correlations | SPEC-003/008/011/013/014 |
| Output | Acceptance matrix, actual commands/results, live-limit usage, replay evidence and remaining production blockers | Reporting standard |

## Dependencies and entry gate

Direct prerequisites: **SPEC-003, SPEC-006, SPEC-008, SPEC-011, SPEC-013, SPEC-014**, each verified at its required checkpoint. Their transitive contracts, security and evidence dependencies are defined in the DAG.

Entry requires G0 approval, resolution of D-01–D-09 as applicable to the slice, this spec promoted to `ready`, and CP1–CP3 evidence. No real-source run is authorised by merely drafting this spec. Fixture planning may proceed in parallel with predecessor implementation; acceptance waits for all direct prerequisites.

## Acceptance criteria and traceability

IDs below have the full prefix `SPEC-015-`.

| ID | Given / when / then pass condition | Requirements | Verification |
| --- | --- | --- | --- |
| SPEC-015-AC-01 | Given approved P-TEST fixtures, the full workflow yields exactly 2 inventory identities, 2 attempts and 2 valid success events; raw-position counts reconcile and every correlation/durable boundary can be traced. | FR-01, FR-02, NFR-01 | Fixture pipeline with real MSSQL; CP4 |
| SPEC-015-AC-02 | Given a permitted bounded target, real Apify discovery/extraction and real MSSQL complete the same path; resulting fields match the approved target fixture checks and actual usage remains within approved limits. | FR-01, FR-02, NFR-02 | Live smoke, separately recorded; CP4 |
| SPEC-015-AC-03 | Given committed P-TEST datasets and lost acknowledgement, replay adds no inventory/event/authority records; after both URL/context identities become due, 2 new attempts/refetches add 2 events (4 total), preserving prior observations. | FR-03 | Real SQL replay plus controlled due-time advance; CP3/CP4 |
| SPEC-015-AC-04 | Given overlapping claimers, a lost launch response and a late old result, current ownership is disjoint, unknown launch reconciliation precedes replacement, and stale output cannot clear newer ownership or regress freshness. | FR-04, NFR-01 | Barrier-controlled SQL races and transport fault injection; CP3 |
| SPEC-015-AC-05 | Given each non-success terminal execution with partial output, valid successes commit and remaining assignments are accounted for without invented events; approved quiet polls, terminal status and manifest reconciliation verify the end boundary. | FR-05 | Provider-status/lagging-page fixtures and real SQL; CP3 |
| SPEC-015-AC-06 | Given outages before/after commit and a malformed middle item, restart resumes from durable raw offsets; no item is skipped without retained disposition, no replay duplicates events, and SQL recovery does not trigger another website request. | FR-06, NFR-01 | Transaction/crash injection and request counters; CP3 |
| SPEC-015-AC-07 | Given challenge/login/soft-404/wrong-context fixtures and incomplete discovery, invalid pages never count as successful and absent known URLs remain unretired. | FR-07 | Source fixtures plus inventory integration; CP2/CP4 |
| SPEC-015-AC-08 | Given selected retained responses, approved retrieval verifies checksums and corrected-parser replay; missing required evidence prevents success and sampling coverage is stated accurately. | FR-08 | SPEC-017 evidence integration; CP4 |
| SPEC-015-AC-09 | Given all checks, the report maps every FR/NFR/AC to actual evidence, records limits and sanitized environments, and separates first-pipeline acceptance from remaining SPEC-018 production work. | FR-08, NFR-02, NFR-03 | Report review; CP4 |

## Tests, failures and recovery

Use unit tests only for new acceptance accounting or workflow decisions; the first red case is a missing/duplicate assignment escaping the summary. Do not duplicate predecessor unit suites solely to increase test counts.

Integration requirements are AC-01–AC-08. Use controlled faults before live verification; report which provider behaviours were simulated. Missing credentials, unavailable approved SQL, unset budgets or absent source approval yield `BLOCKED`, never `PASS`. Count mismatch, unsafe dispatch, invalid success or broken fencing fails the checkpoint and stops dependent work. Preserve failure evidence and resume through the owning module's bounded recovery policy; do not repair tests by silently editing committed history.

Results belong under `reports/tests/SPEC-015/`; implementation evidence under `reports/implementation/SPEC-015/`. Commands and tooling are recorded only when actually selected and run. **No application tests have been run for this draft.**

## Definition of Done

- [ ] G0 and relevant D decisions resolved; source/profile, limits and expected counts are explicit.
- [ ] All requirements and ACs verified; CP1–CP4 evidence and meaningful TDD records linked.
- [ ] Both fixture and real Apify/MSSQL paths pass; recovery, replay and recurring history demonstrated.
- [ ] Evidence, reports and decisions match tested revisions; no required check skipped or blocked.
- [ ] First-pipeline review recorded; SPEC-018 production acceptance remains a separate gate.

Completion record: implementation, verification reviewer/date and acceptance authority/date **not started / pending**. Change history: **0.1, 2026-10-18 — initial source-traced draft for G0 review**.
