# Reports

Status: **SPEC-001 foundation is integrated into dev; SPEC-002 offline shared contracts are verified and awaiting user review.** Crawlers, MSSQL and the live pipeline remain unimplemented.

This directory will hold evidence produced while executing approved micro-specifications. The authoritative architecture and architecture review are present; the framework is not yet implementation-ready while blocking architectural choices await user resolution and the implementation plan awaits review. Documentation scaffolding is not evidence of application behaviour.

Follow [reporting and architectural decisions](../docs/standards/reporting-and-decisions.md). Start new records from the [implementation report](../docs/templates/implementation-report-template.md) and [test results](../docs/templates/test-results-template.md) templates. Architectural proposals use the [ADR template](../docs/templates/adr-template.md) and belong under `docs/architecture/decisions/`.

Create directories only when records exist:

```text
reports/
  implementation/<SPEC-ID>/<REPORT-ID>.md
  tests/<SPEC-ID>/<RUN-ID>.md
  artifacts/<RUN-ID>/<sanitised-evidence>
```

Use synthetic fixtures and safe identifiers. Do not commit credentials, sensitive connection strings, raw personal data, or unreviewed scraped content. Every published result must identify the tested specification revision, commit or working-tree snapshot, exact safe commands, observed exit codes, environment, fixtures, acceptance coverage, and evidence limitations.

Keep published reports immutable. Reruns receive new IDs. Corrections receive amendment records linked to the original. Update this index to point to new records and amendments without replacing historical observations. Failed, skipped, blocked, and unexecuted required checks must remain visible and must not be called passing.

## Report index

[Specification framework review](specification-framework-review.md) preserves the earlier documentation-only checks. SPEC-001's foundation evidence is indexed below; it does not establish domain or live integration behavior.

| Specification / revision | Latest implementation attempt | Latest required-check status | Test runs / prior attempts | Amendments |
| --- | --- | --- | --- | --- |
| SPEC-001 / 0.2 | [REPORT-20261018-01](implementation/SPEC-001/REPORT-20261018-01.md) | PASS; subsequently integrated into dev by PR #2 (`f5b7cf1`) | [RUN-20261018-01](tests/SPEC-001/RUN-20261018-01.md), with actual red/green history | Historical report remains unchanged; integration status recorded here |
| SPEC-002 / 0.2 | [REPORT-20261018-02](implementation/SPEC-002/REPORT-20261018-02.md) | PASS for approved offline scope; user review and publication of completion changes pending | [RUN-20261018-02](tests/SPEC-002/RUN-20261018-02.md), with red/green and clean-install evidence | None |

