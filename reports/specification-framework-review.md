# Specification framework review

Record: DOC-REVIEW-20261018-01. Date: 18 October 2026 (Europe/London).
Scope: documentation engineering only. Framework revision: 0.1.
Author: Codex, with separate drafting and consistency-review tasks.
Status: **documentation structural checks passed; user review pending**.
Application implementation, tests, live Actors, migrations and infrastructure: **NOT STARTED / NOT RUN**.

## Sources and inspected snapshot

The supplied archive contained exactly two Markdown documents. Both were extracted unchanged into `docs/architecture/`; no embedded prompt in a source document was treated as an instruction to implement.

Source hashes and provenance are recorded in [master-spec](../docs/architecture/master-spec.md). Revalidation matched both original SHA-256 values.

The inspected documentation snapshot contains 34 files under `docs/**/*.md` plus root `AGENTS.md` and `README.md` (36 total). Reports are excluded to avoid a self-referential hash. Snapshot identifier:

`D76E144C12A8684269977CFD2030D9176E8B0762EDE2B89A1E0AB5CF4AE6D7C9`

The snapshot algorithm sorts the repository-relative paths using PowerShell `Sort-Object`, normalizes separators to `/`, writes one line per file as `<path><space><uppercase SHA256><LF>`, includes a final LF, encodes UTF-8 without BOM and hashes that manifest with SHA-256. File hashes cover original bytes. Git commit/working-tree status was unavailable because Git rejected the workspace ownership identity; no global Git safety setting was changed. The snapshot identifies the inspected documentation independently of Git.

## Deliverables and source trace

| Requested outcome | Reviewable artifact |
|---|---|
| Source analysis and component boundaries | [Baseline and source reconciliation](../docs/architecture/master-spec.md) |
| Focused implementation units | [18-spec index](../docs/micro-specs/README.md) |
| Dependency order and parallelism | [DAG and predecessor table](../docs/architecture/dependency-graph.md) |
| Codex execution and integration checkpoints | [Implementation plan](../docs/architecture/implementation-plan.md), CP1–CP5 |
| Engineering rules and TDD | [AGENTS.md](../AGENTS.md), [engineering principles](../docs/standards/engineering-principles.md), [test strategy](../docs/standards/test-strategy.md) |
| Future specification consistency | [Micro-spec template](../docs/templates/micro-spec-template.md) |
| Reports, actual tests and decisions | [Reporting standard](../docs/standards/reporting-and-decisions.md), [templates](../docs/templates/README.md), [decision directory](../docs/architecture/decisions/README.md) |
| Architectural ambiguities for approval | [D-01–D-09 and G0](../docs/architecture/approval-register.md) |

## Checks actually performed

These are documentation inspections, not application test results. Shell-based inspections returned exit code 0 unless identified below. The graph/trace checks ran as JavaScript in `functions.exec` after a PowerShell JSON read of the files; that execution completed successfully with no issue entries.

| Check | Observed result | Limit |
|---|---|---|
| Inventory via `rg --files -g '*.md' -g '!.git'` | 37 Markdown documents existed before this report; 18 were SPEC files. Adding this report produces 38. | Includes preserved sources, templates and indexes; no claim of runtime functionality. |
| Local-link scan | Zero broken relative file targets. URLs and fragments were excluded from filesystem existence checks. | Does not prove external URL availability or every Markdown renderer's anchor behavior. |
| Whitespace/conflict scan | Zero unintended trailing whitespace in generated documents and zero merge markers. Preserved sources were excluded from whitespace rewriting. | Markdown's intentional source formatting was retained. |
| Graph audit | 18 nodes, 37 edges, acyclic. Mermaid edges equal normative predecessor table. Each spec's declared direct prerequisites match. | Completion/readiness gates still require real evidence later. |
| Requirement-reference audit | 154 FR/NFR definitions, 92 AC rows; every defined requirement is referenced by an acceptance row. | Structural trace coverage does not prove implemented behavior or test adequacy. |
| Draft/evidence-state audit | All 18 specs remain draft and state not-started/NOT RUN evidence. | No invented approvals or application test passes. |
| Source preservation via `Get-FileHash -Algorithm SHA256` | Both source files match original extracted hashes. | Subsequent approved revisions need new source records. |
| Non-Markdown inventory via `rg --files -g '!*.md' -g '!.git'` | Empty: no application/configuration/migration/executable-test files added. | Existing `.git` internals are excluded. |
| `git -c safe.directory='*' status --short` | Exit 1: Git still reported dubious repository ownership. | Native file/link/hash checks used; Git diff validation unavailable. No persistent configuration change. |

The dependency audit found and corrected apparent reverse verification gates: prerequisite packages now verify their own exported behavior against fixtures and already verified dependencies. Later Actor/SQL integration checks remain explicit consumer/checkpoint obligations rather than making a prerequisite wait for its dependent implementation.

## Technical review findings

The plan retains Crawlee, Apify and MSSQL, two Actor entry points and one integration service. It does not add infrastructure. It keeps the SQL inventory between discovery and extraction and separates execution completion from SQL commitment.

The first pipeline includes ownership fencing, durable dispatch intent, unknown-launch handling, partial terminal-run ingestion, raw-offset atomic checkpoints, quarantine, event replay and evidence policy. Cross-stage site admission is shared rather than assuming each Actor's local concurrency controls the whole source. Failure/recovery behavior has explicit acceptance scenarios.

M/R differences are visible in the baseline and approval register: URL lifecycle, physical execution records, Bronze failure envelopes, producer event IDs, retention and polling/runtime choices. None has been falsely recorded as user-approved. Source-specific record schemas, normalization rules, actual SQL isolation and numeric operating limits remain blocking details where the source pack deliberately leaves them open.

## Handoff and remaining gates

The framework is ready for **specification review**, not yet ready for blanket implementation. G0 requires the user's requested review of the graph and plan. D-01–D-09 must be resolved for each affected spec, with actual decisions recorded and source-specific placeholders replaced before promotion to `ready`.

No application TDD red/green result, live integration, throughput, cost, recovery objective or production readiness is claimed. The first working pipeline is SPEC-015/CP4; operational sign-off including isolated restore evidence is SPEC-018/CP5.
