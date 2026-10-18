# Reporting and architectural decisions

Status: **DRAFT — authoritative sources available; framework and unresolved architectural choices await user review.**

This standard defines how future implementation work will be recorded. It contains no implementation evidence. Its authoritative inputs are the [master architecture](../architecture/master-architecture.md) and [architecture review](../architecture/architecture-review.md). The specification framework cannot be called implementation-ready until source conflicts and blocking ambiguities are resolved, source requirements are traced to the micro-specifications, and the user approves the implementation plan.

## Authority and decisions

Apply requirements in this order:

1. The user's explicit instructions and constraints, including specification work before application code and preservation of Crawlee, Apify, and MSSQL unless an approved change justifies otherwise.
2. The reconciled master architecture and accepted architecture review findings, with explicit links to their source revisions and user-approved resolutions of conflicts.
3. Accepted architectural decision records (ADRs), approved micro-specification revisions, and repository engineering standards, within the scope of the authority above.

Do not silently choose between conflicting sources. Record an unresolved source conflict or architectural ambiguity, its affected specifications and acceptance criteria, options, and the approval required. An unaccepted review recommendation is a proposal, not an implemented decision. A later ADR changes the agreed architecture only when the user explicitly approves that change; record the affected baseline and superseded decision.

Routine implementation choices already authorised by an approved specification do not require repeated approval. Explain material local choices in the implementation report. Use an ADR when a choice changes architecture, shared contracts, cross-component responsibilities, persistence semantics, security boundaries, or another lasting cross-cutting constraint. User approval is required to resolve source ambiguities and architectural changes; it is not implied by a passing test or by an agent marking a document accepted.

## Document locations

| Record | Location | Purpose |
| --- | --- | --- |
| Implementation report | `reports/implementation/<SPEC-ID>/<REPORT-ID>.md` | Scope, changes, requirements coverage, TDD evidence, limitations, and outcome for one implementation attempt. |
| Test result record | `reports/tests/<SPEC-ID>/<RUN-ID>.md` | Reproducible commands, outcomes, environment, fixtures, and sanitised evidence for one test run or related run set. |
| Supporting test evidence | `reports/artifacts/<RUN-ID>/` | Small, sanitised logs or outputs referenced by the test record. Store large or short-lived artifacts outside version control and record a durable approved reference, retention, and checksum where practical. |
| Architectural decision | `docs/architecture/decisions/ADR-NNN-<short-title>.md` | Proposed decision, alternatives, consequences, authority, and approval. |
| Unresolved question | The architecture ambiguity register linked from the execution plan | One source of truth for decisions required before affected implementation. Link its stable identifier from reports and ADRs. |

Use stable, non-sensitive identifiers. Example identifiers such as `REPORT-YYYYMMDD-01` and `RUN-YYYYMMDD-01` are naming patterns, not records of work performed. Filenames must not contain customer names, credentials, raw target URLs, or personal data. Create directories when a real record is needed; empty directories and infrastructure are unnecessary.

Use these templates:

- [Implementation report](../templates/implementation-report-template.md)
- [Test results](../templates/test-results-template.md)
- [ADR](../templates/adr-template.md)

## Required implementation report evidence

Every report identifies the specification ID and exact revision, report author or executing agent, timestamp with time zone, source architecture and review revisions, baseline commit, tested commit or working-tree state, branch if available, and linked test runs and decisions. Cite source requirements as `M §<number>` for a section in the master architecture and `R: "<exact review heading>"` for a review section. Link both the source document and the approved resolution when a review recommendation changes the master design. Never substitute a branch name for a commit identity. If the workspace is not a Git repository, state that explicitly and use a documented source snapshot identifier.

A commit alone does not identify a dirty working tree. Record whether tracked or untracked changes existed and how the tested state is identified: for example, the baseline commit plus a sanitised patch artifact and hashes of relevant untracked files. Record the scope of the snapshot, exclude secrets and unrelated user data, and disclose any evidence gap. Do not publish a raw diff or file listing without checking it for sensitive content.

Map each requirement and acceptance criterion to changed components, test cases, result records, and any remaining gaps. Do not infer coverage from a test count. Record exclusions, blocked work, skipped checks, failed checks, known limitations, and the effect on acceptance. Mark implementation complete only when the approved specification's Definition of Done and required integration checkpoint are met.

## Test evidence and TDD

Before implementation, identify the next acceptance criterion and its meaningful failing test. Capture the red result, the focused green result after the minimum implementation, and relevant regression results after refactoring. Record exact commands, execution context, timestamps, observed exit codes, test selection, runner summary, and sanitised artifacts. A red result is useful TDD evidence only when it failed for the intended missing behaviour. A setup failure or unrelated regression must be described separately.

The test record must identify the runtime and dependency versions, operating environment, relevant non-secret configuration names, fixture revision or checksum, and isolation strategy. Use synthetic data and safe environment identifiers, such as `mssql-integration-local`, instead of connection strings or live customer identifiers. Record whether external services were real, local, emulated, or mocked, and what this means for integration coverage.

The required test statuses are:

| Status | Meaning |
| --- | --- |
| `NOT RUN` | No execution evidence exists for this check. This is the initial template state. |
| `PASS` | The required command completed with its expected successful outcome and all required assertions passed. |
| `FAIL` | The command or assertions failed; include the observed cause and affected acceptance criteria. |
| `SKIPPED` | Intentionally omitted; include the reason, authority if required, and remaining work. A skip is not a pass. |
| `BLOCKED` | Could not execute because a prerequisite is missing; identify that prerequisite and its owner or decision reference. |

For expected-failure/red-stage tests, record `FAIL` as the observed test result and separately state whether it demonstrates the intended behaviour gap. Preserve that historical failure even after green; final completion depends on the required verification of the implemented state. A successful wrapper process does not override failed assertions, and an unexpected nonzero exit code cannot be labelled a pass. If a tool exposes no exit code, state `NOT AVAILABLE`, preserve its observable result, and disclose the limitation. A final verification run with failures, required skipped tests, or missing required tests must not be summarised as an overall pass. Maintain separate status for optional checks and required checks.

Record exact command text only after checking that it contains no secrets or personal data. If a command would embed a secret, invoke it using an environment variable or secret reference before execution; record that safe command and the variable name, never its value. Redact sensitive output before storing evidence and explain the type of redaction. Do not invent results, timestamps, exit codes, coverage numbers, logs, or external-service verification.

## Required pipeline correctness evidence

Each applicable micro-specification report must link the relevant scenarios below. The final integration report must account for every scenario, including its approved specification requirement, observed result, and evidence. A scenario still awaiting an architectural decision is `BLOCKED`, not silently waived. These are review-derived requirements for the proposed framework; record the user's resolution of conflicts before implementing their changed contracts or states.

| Scenario | Required demonstration | Source trace |
| --- | --- | --- |
| Concurrent claims and lease fencing | Concurrent claimers obtain disjoint current ownership; a stale attempt or lease generation cannot renew, clear, or overwrite newer ownership or regress freshness. Record actual SQL isolation settings and controlled ordering of the competing workers. | M §§5–7; R: "Lease expiry must trigger reconciliation, rather than immediate rescraping."; R: "Separate URL lifecycle, attempt outcome and execution status." |
| Unknown dispatch | Lose the Actor launch response after a possible provider acceptance; durable intent remains visible and reconciliation accounts for matching physical executions before replacement dispatch. Record logical batch and safe physical run correlations. | M §§5–7; R: "The SQL-to-Apify handoff needs a precise failure-recovery protocol." |
| Dataset replay and lost acknowledgement | Re-import identical envelopes after commit and a lost acknowledgement; event counts and accepted attempt state remain correct. A conflicting duplicate event ID is quarantined or rejected under the approved contract. | M §§4, 6–7; R: "Change the extraction contract to identify work, observations and delivery separately." |
| Partial or failed Actors | Import successful partial output from failed, aborted, or timed-out runs; reconcile every manifest assignment without inventing observations for missing work. Record emitted outcomes and unresolved assignment counts separately. | M §§5–7; R: "The SQL-to-Apify handoff needs a precise failure-recovery protocol."; R: "Change the extraction contract to identify work, observations and delivery separately." |
| Import outage and checkpoint recovery | Fail ingestion before/after the transaction boundary; resume from the durable raw offset with atomic outcomes/checkpoint and retained quarantine evidence. SQL recovery retries ingestion without unnecessary website refetches. | M §§4, 6–7; R: "Apify datasets need an explicit retention and ingestion policy."; R: "Lease expiry must trigger reconciliation, rather than immediate rescraping." |
| Partial discovery coverage | Incomplete sitemap/category coverage cannot incorrectly retire known URLs. Preserve the coverage evidence used by any retirement policy. | M §§3, 7; R: "Stage 1 needs explicit coverage and URL-identity rules." |
| Semantically invalid extraction | Challenge/login pages, soft 404s, wrong-context pages, missing required fields, and parser/schema regressions cannot count as usable success merely because HTTP returned 200. | M §§5, 7; R: "Stage 2 needs to establish usable extraction before declaring success." |
| Evidence and parser replay | Retrieve selected retained evidence using an approved reference, verify its hash, and replay it through a corrected parser. Record covered observation IDs, parser versions, reproduced fields, and gaps; do not imply all history is replayable when only selected samples are retained. | M §§4, 7; R: "Bronze should preserve enough evidence to explain and repair the data." |
| Source pause and parser rollback | Exercise pause controls and return to an approved pinned parser/build without losing durable work or changing already committed history. | M §§5–7; R: "Rate limits and retries must be controlled across both stages."; R: "Prioritise changes according to correctness first, then measured operating pressure." |
| Database restore | Restore a known backup into an isolated safe environment, verify relevant control/Bronze consistency and recovery reconciliation, and compare observed recovery with the approved recovery objectives. Record backup identity and sanitised verification, not credentials or raw customer data. | M §7; R: "Prioritise changes according to correctness first, then measured operating pressure." |

Use real SQL Server for SQL concurrency, transaction, and restore demonstrations. Mocks can supplement but cannot establish those properties. Use local/synthetic fault injection first, and record separately which provider behaviours were verified against Apify. This standard does not authorise deploying infrastructure or executing production recovery exercises.

## Immutable reports and corrections

Published implementation reports and test result records are historical evidence. Keep their IDs stable and do not overwrite a prior outcome with a later success. A rerun receives a new run ID, links the prior run, and explains the changed conditions. A correction uses a new amendment record that identifies the original report, the corrected fields, the reason, and supporting evidence. Link amendments from the report index without rewriting original observations. Draft templates and unexecuted draft reports can be edited before publication.

Each report index should show the spec revision, latest attempt, latest required-check status, prior attempts, and amendment links. New implementation attempts reference prior failures and show whether each was resolved. Commit related documentation with the implementation where practical; record the final report commit separately if creating the report itself changes the working tree.

ADRs are decision records rather than test logs. Preserve their proposal and approval history. A correction or change of architectural decision uses a new ADR that links the earlier ADR. The earlier record may gain a dated superseded-by reference without deleting its original reasoning or approval evidence.

## ADR lifecycle

- `PROPOSED`: alternatives and consequences documented; the decision has not been accepted.
- `ACCEPTED`: approval authority, explicit approval evidence, date, and affected source/specification revisions are recorded. Architectural changes and source ambiguity resolutions require the user's approval.
- `REJECTED`: the proposal was declined; record the reason and approval evidence if available.
- `SUPERSEDED`: a later accepted ADR replaces the decision; record both directions of the link and preserve history.

Do not create fictional approval evidence. A proposed ADR must not unblock a dependent specification. After an accepted decision, update affected specifications and the dependency graph before implementation proceeds against the changed contract.

## Data handling and retention

Never commit secrets, connection strings with credentials, authentication headers, raw personal data, or full scraped customer content in reports or fixtures. Prefer synthetic fixtures and narrow sanitised excerpts needed to reproduce behaviour. Ensure captured URLs, screenshots, logs, stack traces, database samples, and patch artifacts are checked for sensitive data. Record retention or deletion requirements for external artifacts; a link that has expired or cannot be accessed is an evidence limitation, not durable verification.

