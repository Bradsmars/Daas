# DaaS engineering instructions

Status: **SPEC-004's scoped offline URL/context identity implementation authorised on 2026-10-18; commit/push, merges and later specifications require approval.**

## Authority and starting gate

- Follow the user's current instructions and constraints, then the authoritative architecture and accepted review decisions. The source register and reconciliation status live in `docs/architecture/master-spec.md`. Never treat an inferred requirement as an approved source requirement.
- If the architecture and review conflict, record the conflict and obtain the user's decision. Do not silently choose an interpretation or change Crawlee, Apify or MSSQL.
- Read the supplied `docs/architecture/master-architecture.md` and `docs/architecture/architecture-review.md` alongside the source register. Draft specifications interpret those sources; unresolved architecture choices still require the user's decision.
- The user authorised starting SPEC-001 on `feat/spec-001-repository`, branched from `dev` at `3b74bd3`. This permits repository layout, strict TypeScript/tooling configuration, npm workspaces and meaningful verification of the harness. See `docs/architecture/decisions/ADR-0001-repository-toolchain.md` and the limited G0/D-01 record in `docs/architecture/approval-register.md`.
- The user authorised SPEC-002's offline shared-contract implementation on `feat/spec-002-contracts` from `dev` at `f5b7cf1`. Its verified contracts are now integrated into `dev` at `d98b69f`. Keep the historical plan, ADR-0002 and implementation/test reports as evidence; integration does not approve all downstream architecture choices.
- The user authorised reviewing and starting the next implementation, then explicitly selected "Implement the shared module with synthetic fixtures first (Recommended)" for SPEC-004. Work on `feat/spec-004-url-normalization`, created from clean `dev` at `d98b69f522e8625bfe5c20bbcce9bc09ff5019e7`. Follow `docs/architecture/plans/SPEC-004.md`, SPEC-004 v0.2 and `docs/architecture/decisions/ADR-0003-url-identity.md`. This permits a pure shared normalizer with caller-supplied trusted source/context/version/scope policy, synthetic fixtures, exact identity bytes and meaningful offline TDD. Support only `preserve-v1`; do not infer real-site parameter removal, query sorting, fragment/slash rewrites or alias rules.
- Work on one micro-specification at a time. Create each implementation feature branch from `dev`; keep SPEC-004 on its assigned branch. Complete and report the current specification, then obtain the user's approval before starting the next one.
- Commits and pushes to feature branches are permitted with the user's explicit approval. On 2026-10-18 the user explicitly approved committing and pushing SPEC-001, including this clarification, to `feat/spec-001-repository` for review into `dev`.
- SPEC-004 start approval does not authorise a commit, push or merge. Earlier specification approvals do not transfer publication authority to this branch.
- Merging into `dev` requires the user's approval. Merging into `main` or deploying to production requires separate explicit approval. Never automatically merge or deploy changes. The SPEC-001 commit/push approval does not authorise a merge, deployment or the next specification.
- Current implementation approval covers SPEC-004's pure offline module, using the verified foundation and contracts. SQL/control implementation, real-source normalization/parsing/crawling, storage retention, Actors, external integrations and infrastructure retain their own readiness/approval gates in `docs/architecture/dependency-graph.md` and the approval register. A synthetic fixture is not an approved real source. Syntactic URL scope does not replace SPEC-016's DNS, connection, redirect and browser egress enforcement.
- Do not add infrastructure without a documented need and an approved architectural decision. Prioritise the smallest working end-to-end pipeline before widening coverage or adding operational complexity.
- Use the verified Node 24/npm/strict-TypeScript/Vitest/ESLint foundation and existing Ajv contract validation with coercion, default insertion and field removal disabled. Real source validation receives an explicit trusted profile from the caller; never let an envelope approve its own source/profile, and do not add a registry service. Reuse SPEC-002's fingerprints for the fixed SPEC-004 identity tuple and compare exact identity bytes alongside digests. Retain all changes locally until commit approval.
- The finite SPEC-002 offline profile bounds message bytes/depth/members, identifiers, URLs, errors and collection sizes. It is a contract/test limit, not permission to crawl a site or a production resource budget. Real source policies remain open for their owning specifications.

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
