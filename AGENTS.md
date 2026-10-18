# DaaS engineering instructions

Status: **DRAFT — specification work only; implementation is not approved.**

## Authority and starting gate

- Follow the user's current instructions and constraints, then the authoritative architecture and accepted review decisions. The source register and reconciliation status live in `docs/architecture/master-spec.md`. Never treat an inferred requirement as an approved source requirement.
- If the architecture and review conflict, record the conflict and obtain the user's decision. Do not silently choose an interpretation or change Crawlee, Apify or MSSQL.
- Read the supplied `docs/architecture/master-architecture.md` and `docs/architecture/architecture-review.md` alongside the source register. Draft specifications interpret those sources; unresolved architecture choices still require the user's decision.
- Do not write application code, dependency configuration, migrations or executable tests until the authoritative sources are reconciled and the user approves the dependency graph and implementation plan in `docs/architecture/dependency-graph.md`.
- Do not add infrastructure without a documented need and an approved architectural decision. Prioritise the smallest working end-to-end pipeline before widening coverage or adding operational complexity.

## Before each task

1. Read this file, `docs/standards/engineering-principles.md`, the relevant micro-specification, its direct dependencies and linked decisions.
2. Before implementation, confirm the specification is `ready` and the dependencies required by its entry gate are satisfied. Draft specification and review work may continue. If a requirement is ambiguous or blocked, document it; work only on independent, authorised scope.
3. State the objective, files owned, acceptance criteria and planned verification. When working in parallel, assign each file or shared contract one owner and coordinate cross-cutting edits.

## Implementation discipline

- Keep solutions simple and focused. Separate crawling, extraction, contracts and persistence. Keep domain rules independently testable and isolate external services behind narrow boundaries.
- SQL owns durable inventory and committed state; Crawlee queues own execution within a run. Keep scheduling, dispatch, ingestion and reconciliation as modules of one integration service. Actors do not connect to MSSQL.
- Preserve immutable success and failure envelopes in Bronze. Fence authoritative state changes using both `current_attempt_id` and `lease_generation`; late evidence cannot clear newer ownership or move freshness backwards.
- Commit claims and durable dispatch intent before Apify network calls. Reconcile unknown launches and all terminal runs, including partial outputs. Commit raw dataset offsets with corresponding writes or quarantine; Actor completion never proves SQL ingestion.
- Reuse established contracts and genuinely repeated logic. Avoid speculative abstractions, silent fallbacks and duplicated business rules.
- Use TDD for meaningful application behaviour: demonstrate a relevant failing test, implement the smallest change, then refactor with the relevant tests passing. Record the red and green evidence. Documentation-only changes require review and link checks, not invented application tests.
- Validate inputs at trust boundaries; handle credentials through the agreed runtime secret mechanism; never commit or log secrets, connection strings or sensitive raw payloads. Parameterise database queries and use least-privilege access.
- Specify timeouts, retry limits and recovery behaviour for external operations. Make retryable writes safe to repeat according to the approved persistence contract. Avoid unlimited retries and unbounded work.
- Apply source-aware URL/context identity and the source adapter's validity checks. HTTP 200 alone cannot mean extraction success. Follow the approved evidence/retention policy; a new object store is a decision, not an assumed prerequisite.
- Keep changes within the specification's scope. Record necessary deviations before implementation; architectural deviations require a user-approved decision.

## Verification and completion

- Map each acceptance criterion to verification evidence. Run the checks appropriate to the affected behaviour and the integration checkpoints in the plan.
- A skipped, unavailable or failing test is never a pass. Record the exact limitation and leave the affected criterion unverified. Unit mocks do not prove live Apify or MSSQL integration.
- Use the lifecycle gates in `docs/standards/engineering-principles.md`: `draft` → `ready` → `implementing` → `verified` → `accepted`.
- Record actual commands, outcomes, environment, deviations and remaining risks in `reports/`. Do not claim tests were run without evidence. Keep architecture decisions in `docs/architecture/decisions/` and link them from affected specifications.
- Finish with the concrete outcome, verification evidence and unresolved blockers. Do not begin the next dependent specification merely because a previous implementation exists; its required verification gate must be satisfied.
