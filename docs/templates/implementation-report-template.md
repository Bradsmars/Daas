# Implementation report: <SPEC-ID> — <short title>

Status: **DRAFT / NOT RUN**

This is an unexecuted template. Replace placeholders only with observed evidence. The authoritative architecture and review are present; the specification framework remains draft until blocking source conflicts and ambiguities are resolved and the user approves the implementation plan.

## Identity and scope

| Field | Value |
| --- | --- |
| Report ID | `<REPORT-ID>` |
| Author / executing agent | `<identity>` |
| Created at | `<ISO-8601 timestamp with time zone; not recorded>` |
| Specification and revision | `<relative link; revision/commit/content hash>` |
| Architecture / review baseline | `<source links and exact revisions; M § references and exact R headings>` |
| Approved scope / exclusions | `<approved requirements; explicit exclusions>` |
| Baseline commit | `<not recorded>` |
| Tested commit | `<not recorded; or working-tree snapshot reference>` |
| Branch | `<not recorded; informational only>` |
| Dirty / untracked state at test time | `<NOT RECORDED; describe tracked and untracked changes>` |
| Tested-state evidence | `<sanitised patch/snapshot and relevant file hashes; exclusions and gaps>` |
| Linked decisions / ambiguities | `<ADR or ambiguity IDs and status>` |
| Prior attempt / amendments | `<links or none>` |
| Implementation outcome | `NOT RUN` |
| Required-check outcome | `NOT RUN` |

## Change and rationale

`<Describe the approved behaviour, components changed, and why the change satisfies the specification. No changes have been made by this template.>`

## Requirements and acceptance traceability

| Requirement / acceptance criterion | Source trace / accepted resolution | Implementation component / evidence | Test case and run link | Observed result | Remaining gap |
| --- | --- | --- | --- | --- | --- |
| `<REQ-ID / AC-ID>` | `<M §; exact R heading; ADR if applicable>` | `<file or component>` | `<test ID and result record>` | `NOT RUN` | `<unverified>` |

## TDD evidence

| Stage | Test run / artifact | Expected observation | Actual result | Interpretation |
| --- | --- | --- | --- | --- |
| Red | `<not run>` | `<specific behaviour missing>` | `NOT RUN` | `<confirm intended failure, not setup failure>` |
| Green | `<not run>` | `<focused assertions pass>` | `NOT RUN` | `<evidence required>` |
| Refactor / regression | `<not run>` | `<relevant checks remain passing>` | `NOT RUN` | `<evidence required; state if no refactor>` |

## Validation and integration

`<Link each test-results record with exact commands, environment, fixtures, exit codes, and sanitised artifacts. State the required integration checkpoint and whether it has actually been observed.>`

| Check / checkpoint | Required or optional | Result | Evidence / reason not run |
| --- | --- | --- | --- |
| `<check>` | `<required / optional>` | `NOT RUN` | `<none>` |

For the final pipeline checkpoint, account for all scenarios in [required pipeline correctness evidence](../standards/reporting-and-decisions.md#required-pipeline-correctness-evidence): claims/fencing, unknown dispatch, replay/lost acknowledgement, partial Actors, ingestion recovery, discovery coverage, invalid extraction, evidence/parser replay, pause/rollback, and database restore. For an individual component, link its applicable scenarios and explain the boundary of its evidence.

## Failures, skipped work, and limitations

`<List observed failures, blocked prerequisites, skips and reasons, acceptance impact, mitigations, and follow-up specification or issue IDs. Use "none observed" only when relevant work was actually executed.>`

## Definition of Done review

- [ ] Approved specification revision and architectural decisions are linked.
- [ ] Every in-scope requirement and acceptance criterion is traced to evidence.
- [ ] Meaningful red, green, and relevant regression evidence is recorded.
- [ ] Required unit, contract, and integration checks passed as applicable to the specification.
- [ ] Required integration checkpoint passed and is linked.
- [ ] Failure handling, security, and non-functional acceptance were checked as specified.
- [ ] Documentation, decisions, and known limitations reflect the implemented state.
- [ ] Reports and artifacts were checked for secrets and personal data.
- [ ] No required failed, skipped, blocked, or unexecuted checks remain unresolved.

Review outcome: **NOT RUN — no completion claim.**

## Publication and amendments

| Field | Value |
| --- | --- |
| Published at / report commit | `<not published>` |
| Corrects or amends | `<prior report ID / none>` |
| Correction details and evidence | `<not applicable unless this is an amendment>` |
| Subsequent amendment index | `<index link once published>` |

Preserve published observations. Reruns and corrections receive new IDs and link this report.

