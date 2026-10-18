# ADR-0001 — Repository foundation toolchain

Status: **accepted for SPEC-001 foundation only**.
Decision date: 2026-10-18. Decision authority: user; implementation owner: Codex.
Affected specification: [SPEC-001 v0.2](../../micro-specs/SPEC-001-repository.md).
Approval: [limited G0 and D-01](../approval-register.md), register v0.2.

## Context and authority

[M §2 and §8](../master-architecture.md) and [R: “The implementation approach should minimise operational machinery.”](../architecture-review.md) call for a shared repository and a small implementation approach. The draft plan defined the repository foundation as SPEC-001 before domain contracts and Actors.

On 2026-10-18, after reviewing the plan, the user asked “what feature branch do i create lets start now” and repeated the request to start. The quoted text is an excerpt of the start request. Interpret this as authorisation to begin the first foundation specification with the reviewed tooling approach; it is not approval of every architectural recommendation or permission to start later specifications.

## Decision

- Implement only SPEC-001's repository layout, compiler/lint/test harness and reproducible installation foundation now.
- Work on `feat/spec-001-repository`, created from `dev` at `3b74bd3`. Use a feature branch from `dev` for each subsequent approved specification, one specification at a time, with approval before its start. Production changes are outside this authorisation.
- Use npm workspaces and TypeScript with strict checking. Keep one repository for the future two Actors, integration service and shared packages; do not create additional deployables.
- Use Node 24 LTS for development, initially pinned to exact version `24.22.0`, with the development runtime constrained to Node 24. This does not establish future hosted Actor runtime compatibility without verification.
- Use Vitest for meaningful test execution and ESLint for lint checks. Compatible exact versions were selected and measured within the authorised SPEC-001 scope; their pins are recorded below and in the npm lockfile. This is a local implementation choice under the existing tooling decision, not a new approval of application dependencies.
- Provide distinct verification entry points and truthful empty-suite/missing-integration outcomes. Do not write application behaviour or placeholder domain tests to make commands look successful.

Ajv and executable JSON Schema contracts remain future implementation choices under SPEC-002. Do not install Crawlee, Apify, SQL clients or provision external services as part of foundation scaffolding without a current foundation requirement.

## Alternatives and rationale

Python remains a possible application alternative only through a future approved decision; the authorised foundation follows the reviewed TypeScript/npm proposal to keep a consistent development boundary. Adding a workflow engine, broker, container platform or cloud CI service would exceed this repository task and is unnecessary for its verification.

A supported Node LTS major with an exact initial pin and locked package versions makes the initial environment reproducible. Compatibility evidence is limited to the measured foundation below; future hosted Actors and application clients require their own checks.

## Measured foundation pins, 2026-10-18

| Tool | Exact version |
|---|---|
| Node / npm | `24.22.0` / `11.19.1` |
| TypeScript | `6.0.3` |
| Vitest | `5.0.5` |
| ESLint / `@eslint/js` | `10.13.0` / `10.0.1` |
| typescript-eslint | `8.71.2` |
| `@types/node` | `24.19.2` |

Working and isolated copies passed `npm run check`: lint, strict TypeScript and 20 actual harness tests. The clean isolated copy installed 134 packages through offline `npm ci`. Unsupported Node 20 installation failed with `EBADENGINE` as expected. These are measured foundation compatibility results, not tests of Crawlee, Apify, MSSQL or a business-data contract. See [implementation evidence](../../../reports/implementation/SPEC-001/REPORT-20261018-01.md) and [test results](../../../reports/tests/SPEC-001/RUN-20261018-01.md) for commands, red/green evidence, environment and exact tested revision.

## Consequences and verification

SPEC-001 has moved through ready and implementing to verified for its own repository foundation; user review/acceptance remains pending. Reproducible installation, compiler/lint/harness checks and safe repository inspection are documented in the linked reports, with the tested working-tree snapshot identified by a source manifest. Automatic approval review initially rejected committing. On 2026-10-18 the user explicitly approved committing/pushing this feature branch, including an AGENTS.md clarification: feature commits/pushes require explicit approval, dev merges require approval, main merges/production deployments require separate explicit approval, and merging/deployment must never happen automatically. No merge or next-specification approval was given. Empty domain suites and missing integration credentials produce explicit non-pass outcomes. Downstream domain tests and live SQL/Apify connectivity do not block foundation verification and cannot be claimed as passed by it. Full CP1 includes later contract work and is not closed by these tooling checks.

This ADR leaves D-02 through D-09 open. In particular it does not accept SQL/control/event state changes, canonicalisation policy, source contracts, evidence guarantees, live resource budgets or deployments. The dependency graph remains the proposed order for later review; G0 approval is limited to this first start.

## Change history

2026-10-18: accepted foundation decision and readiness authority recorded before tooling implementation; compatible exact foundation pins and measured verification subsequently added under the same scope. No superseded ADRs.
