# SPEC-NNN — Short component name

Status: **DRAFT — complete the gates below before implementation.**

Replace placeholders with concrete, sourced requirements. Remove instructional examples from a ready specification. Do not fill missing architecture details with an unstated assumption. Keep one focused, independently verifiable outcome per specification; split work when acceptance requires unrelated responsibilities.

## Metadata

| Field | Value |
| --- | --- |
| ID | SPEC-NNN |
| Version | 0.1 |
| State | draft / ready / implementing / verified / accepted |
| Owner | Person or agent responsible for this specification |
| Reviewer / acceptance authority | User or explicitly delegated reviewer |
| Last updated | YYYY-MM-DD |
| Implementation priority / phase | First pipeline or later approved phase |
| Authoritative sources | Source ID, version and exact section; use `MISSING` when unavailable |
| Review findings | Accepted finding IDs and exact references |
| Architectural decisions | ADR links, status and affected requirements |
| Plan / dependency graph | Link to the approved plan and graph revision |
| Implementation report | Link after work begins; `not started` beforehand |

## Objective and scope

**Objective:** One observable outcome and why the pipeline needs it.

**In scope:** Explicit responsibilities and relevant boundary conditions.

**Out of scope:** Adjacent work assigned elsewhere or deliberately deferred. Cross-reference its owner or specification when known.

**Source status:** State whether the requirements are source-confirmed, user-decided or provisional. A missing authoritative source prevents readiness.

## Requirements

Use stable identifiers such as `SPEC-NNN-FR-01` and `SPEC-NNN-NFR-01`. Each requirement must be observable or objectively reviewable, and traceable to a source or approved decision.

### Functional requirements

| ID | Required behaviour | Source / decision | Acceptance criteria |
| --- | --- | --- | --- |
| SPEC-NNN-FR-01 | Given a stated input or condition, the component shall produce a specific result or transition. | Exact source section or approved ADR | SPEC-NNN-AC-01 |

### Non-functional requirements

| ID | Quality constraint and measurable target | Verification method | Source / decision |
| --- | --- | --- | --- |
| SPEC-NNN-NFR-01 | State the applicable bound, security rule, determinism, compatibility, resource limit or reliability guarantee. Avoid vague claims such as “fast” or “secure”. | Measurement or specific inspection/test | Exact source section or approved ADR |

If a numerical target or policy remains undecided, identify its decision ID and mark the affected gate blocked. Do not invent a mandatory value. Record reviewed `not applicable` cases with a reason.

## Technical design and boundaries

- **Responsibility and ownership:** Package, actor, service or database responsibility, including proposed path after implementation is authorised.
- **Existing architecture:** How this component uses the agreed Crawlee, Apify and MSSQL boundaries where applicable.
- **Approach:** Minimum algorithm, state transitions, adapter boundary and invariants needed to implement the requirements.
- **Contract ownership:** Producer, consumer, versioning and compatibility expectations for shared data.
- **Identity and ownership:** URL/request context, logical attempt and lease generation, physical execution and event identity where applicable; specify which state changes require ownership fencing.
- **Configuration:** Required values, validation, defaults if approved, bounds, secret references and absence behaviour.
- **Persistence and external effects:** Transactions, uniqueness, replay guarantees, partial success and external operations, if applicable.
- **Commit boundaries:** Keep Apify network calls outside SQL transactions. For import work, identify the atomic boundary between retained event/quarantine, accepted outcomes, fenced state updates and raw dataset checkpoint.
- **Evidence and coverage:** Applicable discovery completeness, evidence durability/retention and replay guarantees; link the approved policy and any required storage decision.
- **Runtime constraints:** Cancellation, timeout, resource limits and concurrency as sourced or approved.
- **Prohibited or deferred choices:** Unapproved infrastructure or scope expansions.

Separate required behaviour from illustrative design choices. Add a dependency or library only when justified by the scope and approved architecture; do not mandate speculative tooling.

## Inputs and outputs

| Direction | Contract / field | Type and requiredness | Validation and invariants | Example / owner |
| --- | --- | --- | --- | --- |
| Input | Contract or field name | Explicit type; required / optional | Size limits, permitted values, semantic rules | Safe fixture and owning spec |
| Output | Result, record or error | Explicit type; required / optional | Ordering, cardinality, identity and compatibility guarantees | Safe fixture and consuming spec |

Include empty, malformed, duplicate and absent-input semantics where applicable. Identify all side effects and error outputs. Examples are illustrative and cannot replace a complete contract. Never use real credentials or sensitive records in examples.

For extraction and import specifications, explicitly distinguish work identity from event and physical execution identity, success/failure envelopes from business-record cardinality, and observation time from ingestion time. For discovery, include the coverage manifest and discovery provenance separately from approved target ownership.

## Dependencies and entry gate

| Direct dependency | Required capability or contract | Required state / evidence | What becomes blocked if unavailable |
| --- | --- | --- | --- |
| SPEC-XXX or approved decision | Exact prerequisite | Accepted/verified contract or checkpoint, as required by the plan | Specific activity |

List direct dependencies only; link the graph for transitive dependencies. Distinguish a design/contract dependency from a live integration prerequisite when they differ.

**Entry checklist:**

- [ ] Authoritative source requirements reconciled and blocking decisions resolved.
- [ ] User approved the dependency graph and implementation plan.
- [ ] This specification is reviewed and `ready`.
- [ ] Required dependency states and integration checkpoints are satisfied.
- [ ] File ownership and shared contract ownership agreed for parallel work.

**Parallel opportunities:** State which independent specification may proceed concurrently, on which stable interface, and at which integration checkpoint results must reunite. If none, say so.

## Acceptance criteria and traceability

| ID | Given / when / then, including observable pass condition | Requirement IDs | Unit verification | Integration / checkpoint verification |
| --- | --- | --- | --- | --- |
| SPEC-NNN-AC-01 | Given a concrete condition, when an action occurs, then a precise result is observed. | SPEC-NNN-FR-01; relevant NFR IDs | Named test scenario or justified N/A | Named scenario, environment and checkpoint, or justified N/A |

Cover both successful and required failure behaviour. Every requirement must map to at least one criterion; every criterion must have a verification method. Criteria must be independently assessable. An integration requirement cannot be satisfied solely by a mock-based unit test.

## Test requirements and evidence plan

### Unit tests

List meaningful scenarios, inputs and expected outcomes for normal, boundary and failure behaviour. Identify deterministic fixtures and controllable dependencies. Include the first expected failing behaviour for TDD; implementation reports must record its actual red and green evidence.

### Integration and contract tests

Identify real boundaries under test, required environment and credentials by reference, producer/consumer fixtures, test data ownership, isolation, cleanup and repeatability. State exact expected effects and checks. Distinguish local emulation from verification against the agreed Apify/Crawlee runtime or MSSQL environment.

### Checkpoints and evidence

Identify required end-to-end or cross-specification checkpoints from the approved plan. Name expected commands or check procedures once tooling is approved; never present planned execution as an actual result. State artifact/report locations. Classify actual results as `PASS`, `FAIL`, `BLOCKED`, `SKIPPED` or reviewed `NOT APPLICABLE`; a required skipped or blocked check prevents verification.

Documentation-only or simple structural work may use reviewed inspection instead of TDD when no meaningful application behaviour is introduced. Explain applicability; do not fabricate tests.

## Error handling, failures and recovery

| Failure / trigger | Observable error or state | Retry rule and finite bound | Recovery / replay behaviour | Verification |
| --- | --- | --- | --- | --- |
| Concrete malformed input, timeout, unavailable dependency or partial write | Explicit typed error, record or run status; safe diagnostic context | Retryable or terminal, with approved bound | Retained progress, rollback or safe replay; ownership of operator action | AC/test scenario |

Specify which errors affect one record, one source or the entire run. Cover applicable partial-success cases, cancellation and duplicate/replayed work. Define what may be logged and what must be redacted. A missing recovery policy is an unresolved requirement, not permission to retry indefinitely.

Where relevant, address unknown launches, late fenced outcomes, failed Actors with usable partial datasets, missing manifest results, conflicting event replays, invalid raw items retained in quarantine, lagging dataset metadata and SQL outages. Actor completion alone cannot satisfy a durable-ingestion criterion; incomplete discovery alone cannot justify retirement.

## Decisions and open questions

| ID | Ambiguity / decision needed | Available evidence and options | Proposed default, if any | Authority / status | Blocks |
| --- | --- | --- | --- | --- | --- |
| DEC-NNN | Specific unresolved issue | Relevant source references and trade-offs | Clearly provisional, never silently approved | User / unresolved | Requirement or gate |

Link accepted architectural choices to decision records. Separate blocking decisions from explicitly deferred scope. Do not mark this specification `ready` while a decision blocks its implementation or acceptance.

## Definition of Done

- [ ] Scope and source traceability are complete and current.
- [ ] Implementation satisfies all functional and non-functional requirements within approved scope.
- [ ] Meaningful behaviour has recorded TDD evidence or a reviewed applicability explanation.
- [ ] All acceptance criteria are verified with linked evidence.
- [ ] Required unit, contract, integration and checkpoint checks pass; no required test is skipped or blocked.
- [ ] Relevant failure, recovery, security and replay behaviour is verified.
- [ ] Shared contracts and dependent specifications are consistent; required integration review is complete.
- [ ] No unapproved infrastructure, architectural changes or unresolved blocking deviations remain.
- [ ] Documentation, decision records and implementation/test reports reflect the final result and limitations.
- [ ] Review is complete and the result has sufficient evidence for `verified`; record the later acceptance decision separately in the completion record.

## Completion record

| Item | Evidence |
| --- | --- |
| Implementation report | `reports/` link |
| Test results | Linked actual output and acceptance matrix |
| Source revision / commit | Exact revision when available |
| Decisions and deviations | Linked accepted records or explicit none |
| Verification reviewer and date | Name, date, state |
| Acceptance authority and date | Name, date, state; pending until accepted |

## Change history

| Version | Date | Change and reason | Source / decision | Review status |
| --- | --- | --- | --- | --- |
| 0.1 | YYYY-MM-DD | Initial draft | Source references or missing-source status | Draft |
