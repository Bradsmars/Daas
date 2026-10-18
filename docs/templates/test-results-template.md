# Test results: <RUN-ID>

Status: **DRAFT / NOT RUN**

This template records no executed tests. Do not interpret its tables or example identifiers as evidence. The authoritative architecture and review are present; the framework and unresolved architectural choices await user review.

## Run identity and reproducibility

| Field | Value |
| --- | --- |
| Run ID / author | `<RUN-ID> / <identity>` |
| Specification and exact revision | `<SPEC-ID; link; revision/commit/content hash>` |
| Implementation report | `<link or not created>` |
| Start / finish timestamps | `<not recorded; ISO-8601 with time zone>` |
| Baseline / tested commit | `<not recorded>` |
| Branch | `<not recorded>` |
| Dirty tracked / untracked state | `<NOT RECORDED>` |
| Tested-state snapshot | `<sanitised patch and relevant file hashes; exclusions and gaps>` |
| Runtime and dependency versions | `<not recorded; include lockfile revision where applicable>` |
| OS / execution environment | `<safe identifier and versions; not recorded>` |
| Configuration | `<non-secret names and relevant safe settings only>` |
| Fixtures | `<synthetic fixture ID, revision/checksum, and source>` |
| External dependencies | `<real / local / emulated / mocked; versions and safe environment IDs>` |
| Isolation / setup / teardown | `<test database or resource isolation and cleanup expectations>` |
| Prior run / amendment | `<link or none>` |

## Executions

Add a row per command invocation, including setup commands relevant to reproducibility. Store only command text that is safe to publish. Use secret references in the executed command instead of credential values. Include command sequence numbers so dependencies are clear.

| Step / TDD stage | Working directory | Exact safe command | Start / finish | Expected outcome / exit | Observed exit code | Assertions summary | Status | Sanitised evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<1 / red, green, regression, or setup>` | `<path>` | `<not executed>` | `<not recorded>` | `<expected result>` | `NOT RUN` | `<not observed>` | `NOT RUN` | `<none>` |

For a red-stage run, preserve the observed `FAIL` and explain whether it demonstrates the intended missing behaviour. Setup errors and unrelated failures do not establish a valid red stage. If an execution interface does not expose an exit code, use `NOT AVAILABLE` and describe the observable result and limitation.

## Requirement and acceptance coverage

| Requirement / AC | Source trace / accepted resolution | Test case ID / level | Required or optional | Fixture | Execution step / evidence | Status | Coverage limits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<REQ-ID / AC-ID>` | `<M §; exact R heading; ADR if applicable>` | `<unit / contract / integration / end-to-end>` | `<required / optional>` | `<fixture ID>` | `<step / link>` | `NOT RUN` | `<unverified>` |

## Failure-injection and recovery scenario evidence

Complete applicable rows for this run and link later run IDs for required scenarios outside its scope. The final integration record must account for every [required pipeline correctness scenario](../standards/reporting-and-decisions.md#required-pipeline-correctness-evidence).

| Scenario | Fault / controlled ordering | Expected invariant | Observed result and evidence | Status |
| --- | --- | --- | --- | --- |
| Concurrent claims / stale lease fencing | `<not exercised>` | `<current attempt and generation retain ownership>` | `<none>` | `NOT RUN` |
| Unknown dispatch / duplicate physical execution | `<not exercised>` | `<intent reconciled before replacement dispatch>` | `<none>` | `NOT RUN` |
| Replay / lost acknowledgement | `<not exercised>` | `<no duplicate committed event or repeated terminal acceptance>` | `<none>` | `NOT RUN` |
| Partial / failed Actor manifest accounting | `<not exercised>` | `<partial successes retained; every assignment accounted for>` | `<none>` | `NOT RUN` |
| SQL outage / checkpoint recovery | `<not exercised>` | `<atomic durable progress; no unnecessary refetch>` | `<none>` | `NOT RUN` |
| Partial discovery / retirement safety | `<not exercised>` | `<incomplete coverage cannot imply deletion>` | `<none>` | `NOT RUN` |
| Invalid extraction / parser regression | `<not exercised>` | `<invalid content cannot count as usable success>` | `<none>` | `NOT RUN` |
| Evidence / corrected-parser replay | `<not exercised>` | `<verified retained evidence supports stated replay coverage>` | `<none>` | `NOT RUN` |
| Pause / parser rollback | `<not exercised>` | `<controlled fetching and retained durable work>` | `<none>` | `NOT RUN` |
| Isolated database restore | `<not exercised>` | `<verified control/Bronze consistency and approved recovery objectives>` | `<none>` | `NOT RUN` |

## Failure, skip, and blocker details

| Test or check | Observed status | Cause / evidence | Acceptance impact | Required next action / owner |
| --- | --- | --- | --- | --- |
| `<check>` | `NOT RUN` | `<no execution evidence>` | `<unverified criterion>` | `<next action>` |

## Artifacts and data handling

| Artifact | Safe relative path or approved durable reference | Checksum / revision | Sanitisation / redaction | Retention / access limitation |
| --- | --- | --- | --- | --- |
| `<artifact ID>` | `<none captured>` | `<not recorded>` | `<describe type of sensitive content removed; never include original>` | `<retention or limitation>` |

Do not store credentials, connection strings containing secrets, raw personal data, or unreviewed scraped content. State whether sanitisation limits reproduction or diagnosis.

## Observed outcome

| Measure | Observed value |
| --- | --- |
| Required checks: passed / failed / skipped / blocked / not run | `NOT RUN — no counts observed` |
| Optional checks: passed / failed / skipped / blocked / not run | `NOT RUN — no counts observed` |
| Required integration checkpoint | `NOT RUN` |
| Overall required-check status | `NOT RUN` |
| Coverage measurement, if required by the spec | `NOT RUN` |
| Evidence limitations | `<not yet assessed>` |

No final verification pass claim is valid when a required check of the implemented state failed, was skipped, is blocked, or lacks execution evidence. Historical red-stage failures remain visible as TDD evidence and are followed by linked green verification. Count optional checks separately. Test counts alone do not establish requirement coverage.

## Publication / correction

Published at / report commit: `<not published>`

Amends run: `<none; use a new run ID for a rerun or correction>`

Correction reason and supporting evidence: `<not applicable>`

Preserve the original published outcome and link this record from the report index.

