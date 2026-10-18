# SPEC-001 - Repository and verification harness

Status: **draft for review; implementation not started**. Version 0.1. Updated 18 October 2026.
Owner: unassigned. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §8; R: The implementation approach should minimise operational machinery.
Blocking approvals: [D-01; G0](../architecture/approval-register.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: not started / NOT RUN. Review recommendations remain proposed until G0 and relevant decisions are accepted.

## Objective and scope

Establish the smallest reproducible repository in which the approved Actors, shared contracts and integration modules can be developed and verified.

Workspace layout, supported runtime/dependency pins, test commands, fixture conventions and local contributor instructions. Excludes application behavior, cloud provisioning and a general CI platform.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-001-FR-01 | Create `apps/discovery-actor`, `apps/extraction-actor`, `apps/integration-service`, `packages/contracts`, `packages/shared`, `database`, `tests` and `reports` only when implementation is authorised; keep one deployable integration service. | M §2, §8; R: implementation approach |
| SPEC-001-FR-02 | Choose and pin one approved compatible runtime/toolchain and lock dependency resolution; a clean checkout can install reproducibly using documented commands. | D-01 |
| SPEC-001-FR-03 | Expose separate unit, contract, real-MSSQL integration and live-smoke entry points; unavailable credentials produce an explicit blocked check, not a passing no-op. | M §7; engineering principles |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-001-NFR-01 | No secret values or generated dependency/build directories are versioned; secrets use runtime references. | 016 and M §7; AC matrix below |
| SPEC-001-NFR-02 | Local unit/contract execution requires no Apify account, SQL instance or website access; real integrations remain separately identifiable. | test-strategy; AC matrix below |

## Technical design and boundaries

Under proposed D-01, use npm workspaces and TypeScript with the smallest shared compiler/test setup. Select compatible supported Node/Crawlee/Apify/SQL client versions at implementation time and pin them. Provide dependency direction rules: contracts have no Actor/SQL imports; shared pure logic has no service bootstrapping; Actors never depend on SQL adapters. A runner/tooling choice is a local decision once the runtime is approved. Avoid package proliferation, empty service layers and speculative release pipelines.

## Inputs and outputs

Input: approved runtime/tooling decision and source tree. Output: reproducible workspace, lockfile, safe example configuration names, verified documented verification commands. Missing integrations are reported as blocked with no connection-string output.

## Dependencies and entry gate

Direct prerequisites: none.
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is reproducible tooling and documented command behavior at CP1. Downstream domain-test results do not block harness verification.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-001-AC-01 | A clean checkout with the approved runtime installs by the documented locked process and invokes the selected checks without unpublished global tools. | FR-01, FR-02 | Inspect paths/pins and exercise clean installation. | CP1: second clean checkout or equivalent isolated copy reproduces setup. |
| SPEC-001-AC-02 | An offline unit/contract command executes meaningful discovered tests once supplied; a nonexistent test suite or unavailable required integration cannot be reported PASS. | FR-03, NFR-02 | Runner capability check; no contrived application test solely for scaffolding. | CP1: exercise distinct test entry points and blocked integration output. |
| SPEC-001-AC-03 | Repository inspection finds no SQL imports in Actors, secrets in committed examples, dependency directories or generated build output. | FR-01, NFR-01 | Reviewed dependency and content inspection. | CP1: inspect actual resulting change set. |

## Unit and integration test requirements

Tooling/configuration checks replace application TDD where no application behavior exists. Do not invent a domain test to satisfy a red/green ritual. When the harness introduces behavior (for example rejecting an empty suite), verify that behavior with a meaningful focused test.

Verify clean reproducible install and real test discovery. Integration connectivity is established by later specs, not claimed here. Use the selected runtime on Windows and the intended deployment runtime where different.

Use [test-strategy](../standards/test-strategy.md); commands are established by 001 and actual results recorded later. All checks in this draft are planned, not executed.

## Error handling and recovery

Unsupported runtime or lock mismatch: fail with an actionable safe message; no automatic unpinned upgrade. Missing external settings: classify the relevant integration BLOCKED. Installation failure leaves this spec unverified; do not add cloud infrastructure to repair local setup.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Open: D-01; G0. The register identifies the information needed and the authority. Contract changes update affected dependents before implementation.

- [ ] Reproducible documented setup; dependency boundaries inspected; applicable harness checks pass; CP1 tooling evidence linked. No requirement to provision a service.
- [ ] All FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [ ] Required real-boundary checks pass; skipped, blocked or failing required checks remain unverified.
- [ ] Shared contracts, security, failure recovery and relevant integration checkpoint reviewed.
- [ ] No unapproved infrastructure or deviations; implementation/test reports and any accepted ADRs linked.
- [ ] Verification recorded separately from acceptance; current state remains draft until actual gates pass.

Completion record: report none; tested revision none; reviewer/date pending; acceptance pending.
Change history: v0.1 initial source-traced draft, 18 October 2026.

