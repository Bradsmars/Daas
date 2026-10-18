# SPEC-001 - Repository and verification harness

Status: **verified for the repository foundation; user review pending**. Version 0.2. Updated 18 October 2026.
Owner: Codex. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §8; R: The implementation approach should minimise operational machinery.
Start approvals: [G0 and D-01 accepted for this foundation only](../architecture/approval-register.md); [ADR-0001](../architecture/decisions/ADR-0001-repository-toolchain.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation: [REPORT-20261018-01](../../reports/implementation/SPEC-001/REPORT-20261018-01.md). Test evidence: [RUN-20261018-01](../../reports/tests/SPEC-001/RUN-20261018-01.md). Foundation checks passed; domain suites and external connectivity are not claimed as passed. The reports identify the tested working-tree snapshot. After an automatic review rejection, the user explicitly approved committing/pushing this feature branch and clarified AGENTS.md; merge and next-spec approval remain pending.
Branch: `feat/spec-001-repository` from `dev` at `3b74bd3`. Scope: repository foundation only; approval required before starting SPEC-002 or any other specification.

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

Under accepted foundation D-01, use npm workspaces, strict TypeScript, Node 24 LTS, Vitest and ESLint with the smallest shared setup. Verified pins are Node `24.22.0`, npm `11.19.1`, TypeScript `6.0.3`, Vitest `5.0.5`, ESLint `10.13.0`, typescript-eslint `8.71.2`, `@eslint/js` `10.0.1` and `@types/node` `24.19.2`; the npm lockfile records reproducible package resolution. Development runtime is restricted to Node 24; hosted application runtime compatibility remains future verification. Crawlee/Apify/SQL clients and Ajv are future specification work, not foundation dependencies. Dependency direction remains: contracts have no Actor/SQL imports; shared pure logic has no service bootstrapping; Actors never depend on SQL adapters. Avoid package proliferation, empty service layers and speculative release pipelines.

## Inputs and outputs

Input: approved runtime/tooling decision and source tree. Output: reproducible workspace, lockfile, safe example configuration names, verified documented verification commands. Missing integrations are reported as blocked with no connection-string output.

## Dependencies and entry gate

Direct prerequisites: none.
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

Readiness record, 2026-10-18: **ready before tooling implementation began**. Direct predecessors: none. The user authorised the first foundation start after plan review; limited G0/D-01 and ADR-0001 resolved this specification's entry choices. Its own boundary, acceptance criteria and verification plan were reviewed, then it moved to **implementing** on the authorised feature branch. This entry record did not claim any test pass. Subsequent foundation verification is recorded below; acceptance remains the user's review decision.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is reproducible tooling and documented command behavior at CP1. Downstream domain-test results do not block harness verification.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-001-AC-01 | A clean checkout with the approved runtime installs by the documented locked process and invokes the selected checks without unpublished global tools. | FR-01, FR-02 | Inspect paths/pins and exercise clean installation. | CP1: second clean checkout or equivalent isolated copy reproduces setup. |
| SPEC-001-AC-02 | An offline unit/contract command executes meaningful discovered tests once supplied; a nonexistent test suite or unavailable required integration cannot be reported PASS. | FR-03, NFR-02 | Runner capability check; no contrived application test solely for scaffolding. | CP1: exercise distinct test entry points and blocked integration output. |
| SPEC-001-AC-03 | Repository inspection finds no SQL imports in Actors, secrets in committed examples, dependency directories or generated build output. | FR-01, NFR-01 | Reviewed dependency and content inspection. | CP1: inspect actual resulting change set. |

### Foundation verification record, 2026-10-18

| Criterion | Own-boundary evidence and result |
|---|---|
| AC-01 | **PASS:** Node `24.22.0`/npm `11.19.1`; clean isolated copy installed 134 packages with offline `npm ci` in approximately seven seconds; `npm run check` passed in working and isolated copies. Exact commands/output and tested revision are linked in the reports. |
| AC-02 | **PASS for harness behaviour:** lint, strict TypeScript and 20 actual harness tests passed. Empty unit/contract commands exit 1; absent external credentials report `BLOCKED` and exit 2; configured but empty external suites exit 1. These expected outcomes verify honest reporting, not domain or live-integration success. |
| AC-03 | **PASS for foundation inspection:** workspace/dependency and ignore-boundary evidence is recorded in the implementation report; no Actor, SQL adapter or production integration is implemented by this foundation. Git diff/ignore checks and the exact tested source snapshot are recorded in the reports. |

Unsupported Node 20 installation was rejected with `EBADENGINE` and exit 1 as expected. Meaningful TDD evidence includes a missing-setting preflight initially returning 0 instead of required 2, then passing after the guard, and an initially missing child environment-forwarding value, then passing after forwarding. The reports retain actual red/green evidence. These checks verify SPEC-001's tooling portion of CP1; full CP1 contract verification and later pipeline checkpoints remain outstanding.

## Unit and integration test requirements

Tooling/configuration checks replace application TDD where no application behavior exists. Do not invent a domain test to satisfy a red/green ritual. When the harness introduces behavior (for example rejecting an empty suite), verify that behavior with a meaningful focused test.

Verify clean reproducible install and real test discovery. Integration connectivity is established by later specs, not claimed here. Use the selected runtime on Windows and the intended deployment runtime where different.

Use [test-strategy](../standards/test-strategy.md); actual foundation commands and results are linked in RUN-20261018-01. Unit/contract domain suites currently have no implemented cases and fail honestly; MSSQL/Apify connectivity remains outside this specification's verification boundary.

## Error handling and recovery

Unsupported runtime or lock mismatch: fail with an actionable safe message; no automatic unpinned upgrade. Missing external settings: classify the relevant integration BLOCKED. Installation failure leaves this spec unverified; do not add cloud infrastructure to repair local setup.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Resolved for this start: limited G0, foundation D-01 and ADR-0001. Exact compatible foundation pins and measured verification are now recorded in ADR-0001 and the reports. D-02 through D-09 and future contract/Ajv choices remain open; they do not authorise extra work here. Contract changes update affected dependents before their implementation.

- [x] Reproducible documented setup; dependency boundaries inspected; applicable harness checks pass; CP1 tooling evidence linked. No service was provisioned.
- [x] Foundation FR/NFR and ACs have passing applicable evidence; meaningful harness behaviour has red/green history.
- [x] Required local runtime, subprocess and isolated-install checks pass; external checks remain explicitly blocked/unimplemented rather than being counted as passed.
- [x] Foundation dependency boundaries, secret handling, failure reporting and own CP1 tooling scope reviewed; downstream contracts/pipeline are outside this completion.
- [x] No unapproved infrastructure or architectural expansion; implementation/test reports and accepted foundation ADR linked.
- [x] Verification recorded separately from acceptance; status is verified pending user review, with next-specification approval still required.

Completion record: reports and tested working-tree manifest linked above; implementation/verification owner Codex, 2026-10-18; user review/acceptance pending. Commit/push to feat/spec-001-repository explicitly approved; merging requires a further decision. Do not promote to accepted or start the next specification through this record.
Change history: v0.1 initial source-traced draft, 18 October 2026; v0.2 scoped foundation approval, ready → implementing → verified lifecycle and measured foundation evidence, 2026-10-18.

