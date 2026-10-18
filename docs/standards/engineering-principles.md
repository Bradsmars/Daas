# Engineering principles and execution standard

Status: **DRAFT — pending source reconciliation and review of the implementation plan.**

This standard governs future DaaS implementation. It does not authorise implementation. Source availability and authority are recorded in [the master specification](../architecture/master-spec.md); sequencing and checkpoints are recorded in [the dependency graph](../architecture/dependency-graph.md).

## Principles

| Principle | Required practice | Review evidence |
| --- | --- | --- |
| KISS | Use the smallest design satisfying the accepted requirements. Prefer the existing Crawlee, Apify and MSSQL boundaries. | Each abstraction and new runtime dependency has a specific requirement or demonstrated repeated use. |
| DRY | Centralise shared contracts and stable business rules. Allow local incidental similarity until a shared abstraction has a clear owner and purpose. | One authoritative definition per shared contract; compatibility checks at consumers. |
| Separation of concerns | Keep orchestration, URL policy, discovery, extraction, validation and persistence responsibilities distinct. | Business rules can be tested without network or database access; external adapters have explicit interfaces. |
| Maintainability | Use explicit names, small focused units, documented invariants and bounded scope. | A reviewer can trace a requirement through a contract, implementation and test without inferring hidden behaviour. |
| Security | Validate untrusted inputs, constrain outbound access according to the approved URL policy, parameterise SQL, protect secrets and minimise collected data. | Boundary and negative tests; no secrets in source, fixtures, logs or reports; least-privilege permissions documented. |
| Testability | Inject or control clocks, network access and other nondeterministic collaborators where necessary. | Deterministic unit tests and separate integration checks covering real adapter behaviour. |
| Reliability | Define finite work limits, operation timeouts, error categories, retry limits and safe replay. | Failure tests cover exhausted retries, partial success and recovery without unintended duplication. |
| Observability | Emit the minimum structured evidence needed to connect a run, source record, stage and failure. | Failures can be traced without exposing credentials or sensitive content. No new monitoring infrastructure is implied. |

These principles guide implementation choices; numerical limits, schemas, libraries, policies and service configurations belong in the approved specifications. Do not turn a suggested implementation detail into a requirement without a source or recorded decision.

## Architecture-specific invariants

These requirements derive from [the master architecture](../architecture/master-architecture.md), sections 2–7, and the corresponding handoff, identity, dataset and Bronze recommendations in [the architecture review](../architecture/architecture-review.md). The master source register records their reconciliation and any approvals still required.

- **One durable control plane:** MSSQL owns URL inventory, logical attempts, dispatch intent and committed progress. Each Crawlee queue is scoped to one physical execution; use work-aware identity so later refreshes or distinct contexts are not lost to queue deduplication. Actors communicate through Apify contracts and storage, without direct SQL access.
- **Simple deployment:** Keep one integration service with scheduling, dispatch, import and reconciliation modules, two Actor entry points and one SQL database. Do not add a broker, outbox service or workflow engine. Durable dispatch-intent fields can live in the existing control-plane model.
- **Explicit identities:** Distinguish normalized URL plus request context, logical attempt plus lease generation, physical Apify run and immutable event identity. Use shared versioned canonicalisation with independent ingestion validation. Preserve raw/final URLs and provenance; URL equality does not establish business-entity identity.
- **Fenced ownership:** Atomically claim bounded work and persist the immutable assignment manifest and dispatch intent. Authoritative completion and renewal require matching `current_attempt_id` and `lease_generation`. Late outcomes can remain evidence but cannot clear newer ownership or regress observation freshness.
- **Recoverable handoff:** Make Apify network calls after the claim transaction commits. A lost launch response produces an explicit unknown state that is reconciled before resubmission. Allow duplicate physical executions in the model; do not claim exactly-once launch guarantees.
- **Independent execution and import states:** Drain outputs from successful, failed, aborted and timed-out runs. Reconcile the assigned manifest against outcomes; missing output is unresolved work, not a fabricated fetch failure. Expired ownership prompts reconciliation before replacement fetching, and SQL outages prompt import retry from retained output.
- **Atomic ingestion:** Read ascending, bounded, untransformed dataset pages using run-specific storage IDs and raw offsets. Commit event or quarantine retention, accepted outcomes, eligible URL updates and the next offset together. An empty response or one item count does not alone establish completeness.
- **Immutable Bronze:** Preserve success and failure envelopes with provenance. The same event identity and content is replay; conflicting content under the same identity is a contract error. Accept at most one authoritative terminal outcome for a logical attempt, preserving later evidence without silently replacing it. Failed refreshes preserve prior valid observations.
- **Usable extraction:** Version source adapters and fixtures. Validate page identity, required fields, context and source-specific invariants before success; distinguish unavailable values, zero values, blocking, soft 404s and parser regressions. Keep extraction within the assigned manifest; route newly found links through validated discovery intake.
- **Bounded discovery and site pressure:** Capture coverage, stop reasons and continuation information. Partial discovery cannot establish deletion. Control shared rate-limit groups across discovery and extraction, including request retries, session rotations and run restarts; source pause must prevent further dispatch.
- **Explicit evidence policy:** Record which responses must be retained, required durability, retention and replay guarantees before implementation. If evidence durability is a completion condition, verify evidence before committing its SQL reference and success. Adding object storage needs the user's decision; do not silently assume either permanent raw capture or recoverability from expired Apify storage.

The review recommends TypeScript, shared JSON Schema validation, Ajv and polling-first integration. These remain recorded implementation choices for the user to confirm, rather than silently selected dependencies. Keep HTTP fetching as the proposed default and browser rendering source-dependent; confirm representative-source needs before mandating browser infrastructure.

## Source authority and changes

1. Follow the user's explicit constraints and decisions.
2. Apply the supplied architecture and accepted architecture-review findings, with exact references preserved in the master source register.
3. Apply approved architectural decisions and ready micro-specifications within that authority.
4. Use this standard for engineering practice and the template for consistency.

A conflict between architecture and review is an unresolved decision until the user chooses an interpretation. If a new decision changes a source requirement, record the old requirement, the approved change, its rationale and all impacted specifications. Repository drafts and external documentation must not silently override the authoritative sources.

## Specification lifecycle

| State | Entry and exit gate | Responsibility |
| --- | --- | --- |
| `draft` | Scope, assumptions and candidate requirements may be incomplete. Missing sources or unresolved blocking decisions remain explicit. It cannot authorise implementation. | Specification author. |
| `ready` | Authoritative sources are available and reconciled; the user has approved the dependency graph and implementation plan; this specification has traceable requirements, testable acceptance criteria, direct dependencies, resolved blocking decisions and a reviewed verification plan. Its dependency entry gates must be satisfied before implementation starts. | User or an explicitly delegated reviewer confirms readiness; the implementer checks entry gates. |
| `implementing` | Work begins within the ready specification's scope. Record owner and implementation report. Capture meaningful TDD evidence as work proceeds. | Assigned implementer. |
| `verified` | All acceptance criteria have evidence; required unit and integration checks and relevant integration checkpoints pass; no required check is skipped or unavailable; deviations and decisions are resolved; Definition of Done is satisfied. | Implementer supplies evidence; reviewer validates it. |
| `accepted` | The user or explicitly delegated reviewer accepts the verified result and its documented limitations. | Acceptance reviewer. |

The user may delegate routine specification readiness and acceptance when approving the implementation plan. Honour that delegation and earlier approvals; do not introduce a fresh permission request for each specification unless a decision exceeds the authorised scope. The initial dependency-plan review and unresolved architectural decisions remain explicit user gates.

Changes to accepted scope, contracts, dependencies or acceptance criteria require an updated specification and impact review. Return the affected specification to `draft` when the change invalidates its readiness; preserve previous verification evidence as historical evidence, not proof of the changed requirement. Reverification is required for affected behaviour.

## SDD and TDD working cycle

1. Select a ready specification whose dependency entry gates are satisfied. Read the relevant source references and decisions; identify the next observable acceptance behaviour.
2. Add the smallest meaningful test for that behaviour and run it. Record the expected failure and confirm it fails for the intended reason. A setup failure does not demonstrate the missing behaviour.
3. Implement the minimum change needed for that test to pass, then rerun the relevant checks.
4. Refactor only while the relevant checks remain passing. Keep changes within the specification and approved architecture.
5. Verify boundary failures and integration behaviour, update traceability and record results. Stop at any required integration checkpoint before starting its dependent work.

Tests should assert externally meaningful behaviour, not duplicate implementation steps. Use deterministic fixtures, isolated data and controlled failures. Documentation changes need content, consistency and link review; they do not require artificial red/green evidence. A straightforward configuration or structural task may use the specific validation required by its specification; document why TDD is not applicable instead of fabricating evidence.

## Test scope and evidence

- **Unit:** Pure policies, transformations, validation, state decisions and error classification. Keep tests deterministic and independent of live external services.
- **Integration:** Adapter behaviour against the agreed Apify/Crawlee runtime and MSSQL environment as required by the relevant specification. Record runtime versions, configuration labels and test-data isolation without recording secrets.
- **Contract:** Producer and consumer agree on required fields, types, semantic invariants and compatibility behaviour. Consumer tests using invented payloads alone cannot prove producer compatibility.
- **End-to-end:** A small bounded, authorised source passes through the complete agreed pipeline to an inspectable MSSQL result, with evidence for rerun and failure behaviour required by the plan.

Relevant integration checkpoints must exercise overlapping claimers, a lost launch response, a stale completion after ownership changes, replay and lost acknowledgements, terminal-run partial output, interrupted ingestion, partial discovery, challenge pages and parser regressions. Production-readiness evidence additionally covers the approved evidence replay guarantee, source pause, parser rollback and database restore. The dependency plan assigns these checks to focused specifications and checkpoints; they are not all a prerequisite for each individual unit of work.

Classify each check as `PASS`, `FAIL`, `BLOCKED`, `SKIPPED` or `NOT APPLICABLE`. Give a reason for anything except `PASS`. `BLOCKED` and `SKIPPED` leave related acceptance criteria unverified. `NOT APPLICABLE` needs a reviewed justification and must not conceal an applicable requirement. Do not use coverage percentages alone as evidence of correctness, and do not add arbitrary coverage gates without an accepted requirement.

Run only relevant checks first, followed by the required integration checkpoint. Broaden or repeat verification when failures, changed shared contracts or new risks justify it. Isolate test records and clean up only records or runs demonstrably owned by the test; never use production cleanup as a test shortcut.

## Parallel implementation and integration

The dependency graph determines parallel eligibility. Independent specifications can proceed together only after their contracts and entry gates are settled. Assign one owner for shared contracts, migrations and each shared file; consumers can use agreed fixtures while integration remains explicitly pending. Coordinate interface changes before editing consumers. Merge or integrate small reviewed increments and run the checkpoint before releasing downstream work.

Do not introduce a queue, orchestration service, cache, container platform or deployment environment merely to support parallel coding. A need for additional infrastructure requires a documented requirement, alternatives analysis and user decision.

## Documentation obligations

Use stable specification, requirement, acceptance-criterion and decision identifiers. Keep identifiers stable when wording changes; retire removed identifiers rather than reassigning them to unrelated behaviour. Each specification uses [the micro-specification template](../templates/micro-spec-template.md) and records its version, sources, dependencies and state.

Store implementation reports and test evidence under `reports/`, using a clear specification identifier and run identifier in filenames or directories. Each implementation report must contain:

- Specification version, source revision or commit, owner, date and environment description.
- Implemented behaviour and affected paths, linked to requirement and acceptance identifiers.
- TDD red/green evidence for meaningful behaviour, including actual commands and outcomes.
- Unit, contract, integration and checkpoint results, durations where relevant, and evidence paths.
- Deviations, approved decisions, security-relevant configuration, known limitations and recovery notes.
- Acceptance matrix showing each criterion as verified or unverified, with its evidence.
- Definition of Done checklist and reviewer/acceptance status.

Store exact test output as an attached artifact or linked report when practical. A prose summary must not replace missing required results. Record failed and blocked attempts honestly. Sanitise output before storing it; reference environment names and secret identifiers rather than secret values.

Record architectural decisions in `docs/architecture/decisions/ADR-NNN-short-title.md`. A decision record includes status (`proposed`, `accepted`, `rejected` or `superseded`), date, decision owner, source references, context, the decision, alternatives, rationale, consequences, affected specifications and verification or migration implications. Only the user or explicitly delegated authority can accept architectural changes. Link a superseding decision without erasing the prior record.

Documentation changes accompany implementation changes that alter behaviour or contracts. Reports record what actually happened; specifications record the agreed intended behaviour; decisions explain why an architectural choice was approved.
