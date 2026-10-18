# Codex implementation plan

Version 0.3, 18 October 2026. Status: **execution permitted only for individually approved scopes; remaining architecture decisions are proposed**.

Execution update, 18 October 2026: SPEC-001/002/004 are verified and integrated into dev. The user authorised SPEC-016's controlled-fixture HTTP foundation and explicit test ceilings; see [ADR-0004](decisions/ADR-0004-controlled-http-security.md) and [its scoped plan](plans/SPEC-016.md). Work proceeds **one specification at a time on a feature branch from `dev`**, with user approval required before the next specification. Parallel opportunities remain planning information, not permission to implement several specifications concurrently. Real-source and later architectural decisions remain open.

## G0: review before coding

Review [the baseline](master-spec.md), [dependency graph](dependency-graph.md) and [approval register](approval-register.md). Approve the affected plan and resolve its necessary decisions before coding. Capture actual approval in an ADR and update the spec state. The original specification-engineering task excluded implementation; current individual scopes proceed only under their subsequent explicit user approvals.

The core stack stays Crawlee + hosted Apify + private MSSQL. TypeScript/JSON Schema/Ajv are accepted for the implemented foundation/contracts and scoped shared-module work; Actor/runtime compatibility remains gated. One integration service owns scheduling, dispatch, import and reconciliation. No new workflow engine, message broker, public webhook receiver or object-storage service is part of this plan.

## Implementation sequence and integration checkpoints

Start tasks as soon as their direct prerequisites and decision gates are satisfied. These are logical batches, not calendar or effort estimates; effort depends on the selected source and runtime.

| Stage | Work and parallelism | Integration checkpoint / exit evidence |
|---|---|---|
| A | 001 repository, then 002 shared contracts | **CP1: contract baseline.** Reproducible harness; schema/input/output fixture compatibility; exact identity, state, versioning, null semantics and source contract approved. No guessed fields. |
| B | 004 identity precedes 016 runtime security; 005 adapter and 007 SQL schema can proceed independently when approved | **CP2: isolated boundaries.** Approved URL vectors, semantic parser fixtures, real MSSQL migration/index checks and target-security tests pass. Contract consumers agree. |
| C | 003 discovery, 009 claim/fence and 010 Apify transport, as prerequisites allow; then 011 dispatch, 012 reader/quarantine and 017 evidence can run in parallel | Merge each at its ready dependency boundary. Verify real SQL claims, transactional intent and raw checkpoint protocol before their consumers depend on them. |
| D | 006 extraction, 008 discovery import and 013 Bronze commit can run in parallel after their predecessors; then 014 reconciliation | **CP3: ownership and ingestion correctness.** Real SQL concurrent claims, stale fence, checkpoint rollback/lost acknowledgment, conflicting replay and quarantine tests; simulated lost launch response and failed/partial Actor; retained evidence replay. No network call held inside a SQL transaction. |
| E | 015 assembles one source across both Actors and all integration modules | **CP4: first working pipeline.** Deterministic fixture pipeline, then bounded live hosted-Apify/private-MSSQL smoke run. Verify discovery→inventory→claim/intent→physical extraction→dataset→evidence policy→atomic Bronze/outcome/checkpoint→reconciliation. Repeat delivery adds zero events; a genuinely new scheduled observation adds history. |
| F | 018 operational handover | **CP5: operational readiness.** Source pause/rollback, backup/restore into an isolated database, retention and ingestion-backlog controls, basic metrics and approved recovery/budget objectives demonstrated. CP4 alone is not production sign-off. |

The first pipeline includes recovery guarantees needed to avoid corrupting data or duplicating website work. CP3 is not optional post-MVP hardening. CP5 may follow the pilot demonstration, but production use remains blocked until its required controls pass.

A prerequisite's verification gate covers its own exported behavior using approved fixtures and already verified dependencies. Acceptance tables may also name later cross-component checks: those are tracked obligations of the consuming checkpoint, not reverse implementation dependencies. For example, 002 verifies schema/fingerprint fixtures before 007; the actual Bronze replay test later belongs to 013/015. Never make an upstream package wait for its downstream consumer to exist before marking its own boundary verified. Downstream system claims remain unverified until that integration runs.

## Codex task protocol

For every task, read `AGENTS.md`, the ready spec and its direct dependencies. State owned files and chosen ACs. Build one observable behavior at a time: meaningful failing test, minimum implementation, focused green result, refactor and relevant regression checks. For SQL semantics, use real SQL Server under the approved version/isolation settings. For parsers and fault paths, prefer deterministic fixtures and controllable clocks/transport seams.

Keep contracts under a single owner. Parallel workers consume the same verified revision and own disjoint files. Use separate Git worktrees when available and appropriate; a shared workspace requires explicit ownership and sequential shared-file/migration changes. Do not make an infrastructure project out of parallel execution. Review contract/schema changes centrally before dependent work proceeds.

When a failure reveals a missing architectural rule, update the decision/spec and obtain the applicable decision approval before coding that rule. Continue independent authorised work. Do not silently change expected outputs to make tests pass. Do not repeat permissions already covered by accepted decisions.

Suggested task prompt after G0 and readiness gates:

> Implement SPEC-NNN revision X within its approved scope. Read AGENTS.md, its source references, accepted decisions and direct prerequisites. Own the listed files, demonstrate the specified failing behavior, then implement and verify it. Use the existing contracts. Record actual red/green and integration evidence using the report templates. Leave blocked criteria unverified and report the cause. Stop at the specified integration checkpoint; do not expand architecture or start a blocked dependent spec.

This repository-specific workflow is consistent with official OpenAI guidance on [persistent repository instructions and workflow records](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) and [durable task state, verification and isolated work](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex). The spec IDs, gates and report formats here are project conventions.

## Controlled acceptance profile P-TEST (proposal, not production sizing)

Use synthetic fixture content first. A controlled index exposes two distinct valid detail URLs, a repeated URL, an out-of-scope link and a non-target navigation link. The two detail pages each yield one approved synthetic business record in the happy path. An initial run produces two inventory identities, two assigned attempts and two valid success envelopes; new-vs-known counts reconcile exactly. Redelivering both datasets adds no inventory identities or event rows. A subsequent due capture creates two new attempts/events and preserves the first observations.

Proposed finite values make the controlled test repeatable. The subset explicitly recorded in ADR-0004 is approved for SPEC-016's HTTP fixtures; other pipeline values below remain proposals requiring D-07 approval. These do not establish source permissions, production throughput, cost or SLAs.

| Control | Controlled-fixture proposal |
|---|---|
| Source/context/rate group | One of each; one active fetching execution across discovery and extraction |
| Discovery | At most 5 requests, 10 candidate URLs, depth 1; report partial coverage on a bound |
| Extraction | 2 assignments per batch, concurrency 1; no traversal beyond assigned work |
| Transport payload | 1 MiB maximum decompressed response/item/evidence in this fixture; enforce streaming cap |
| Request/retry | 20 s request timeout, at most 1 local retry; zero automatic session rotation and Actor restart for controlled tests |
| Actor/polling | 120 s execution deadline, polling every 1 s, 180 s transport observation deadline; bounded pending/unknown state on timeout |
| Ingestion | Raw page size 1, transaction item limit 1; next raw offset committed with writes; no transforms |
| Lease | 300 s lease; renew every 60 s only under matching fence and bounded execution/import policy |
| Import/recovery | 600 s import deadline; 2 terminal drain-confirmation polls at least 1 s apart, followed by assignment reconciliation; inability to verify remains blocked |
| Scheduling | Test clock controls due times and bounded retry; no waiting for real freshness intervals |
| End-to-end | 20 min ceiling for the controlled live smoke procedure; timeout yields an explicit incomplete run |

A real-source pilot must replace or confirm these settings with the site's approved limits, actual byte sizes, Apify runtime behavior, SQL timeouts and a numeric cost ceiling. Unknown cost/retention/recovery parameters block that pilot; they are not assigned made-up defaults.

## Dataset finalization protocol

Checkpoint raw transport position, not count of successful records. The integration service owns datasets exclusively and forbids writing to or resurrecting finalized runs. Poll and drain every terminal run state. After a terminal run, observe the end boundary at least the approved number of quiet polls separated by the approved interval, compare emitted outcome/coverage manifests when available, and reconcile every immutable assignment. A short/empty page or a lagging metadata count alone never proves completion. A terminal failed run without a final Actor summary can still be drained and reconciled with explicit unresolved assignments.

If the end boundary cannot be verified, retain an incomplete import state and stop cleanup/replacement fetches until reconciliation. If data appears after finalization, treat it as a producer/retention-policy incident: reopen ingestion under a recorded reconciliation action or hold for review, preserving all prior checkpoints and event identities. Never silently discard it.

## Results, decisions and handoff

Use [reporting-and-decisions.md](../standards/reporting-and-decisions.md). Each spec gets implementation and test records with exact revision, safe environment identifiers, AC mapping, actual commands/results, red/green evidence, deviations and limitations. Keep reports separate from ADRs. Shared contract changes update affected micro-spec revisions, graph and traceability before implementation continues. A failed, blocked or skipped required check cannot count as completion.
