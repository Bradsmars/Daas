# ADR-NNN: <decision title>

Status: **PROPOSED — DRAFT TEMPLATE**

This is an unaccepted proposal template. No architectural decision or approval is recorded. The authoritative architecture and review are present; conflicts and source-dependent architectural choices remain open until explicit resolutions are recorded.

Save accepted or proposed records at `docs/architecture/decisions/ADR-NNN-<short-title>.md`.

## Identity and authority

| Field | Value |
| --- | --- |
| ADR ID / author | `<ADR-NNN> / <identity>` |
| Created / last status change | `<not recorded; ISO-8601 with time zone>` |
| Status | `PROPOSED` |
| Decision class | `<architecture change / source ambiguity / other lasting cross-cutting decision>` |
| Source architecture and review | `<links and exact revisions; M § references and exact R headings>` |
| Related ambiguity / requirement IDs | `<stable IDs>` |
| Affected specifications | `<IDs and revisions>` |
| Supersedes / superseded by | `<ADR link or none>` |
| Required approval authority | `<user for architectural change or source ambiguity>` |
| Approval evidence | `NONE — not accepted` |

## Context and problem

`<Describe the concrete decision, relevant source statements, constraints, and why the approved baseline does not resolve it. Quote only the necessary source text and cite its location. Identify conflicts explicitly.>`

## Decision drivers and constraints

`<Identify acceptance, security, testability, operations, cost, and maintainability concerns that materially affect this choice. Preserve Crawlee, Apify, and MSSQL unless the user approves a justified change.>`

## Options

| Option | Technical approach | Benefits | Costs / risks | Effect on first end-to-end pipeline |
| --- | --- | --- | --- | --- |
| `<A>` | `<approach>` | `<evidence or explicit assumption>` | `<trade-offs>` | `<impact>` |
| `<B>` | `<approach>` | `<evidence or explicit assumption>` | `<trade-offs>` | `<impact>` |

## Proposed decision and rationale

`<State the proposed choice, evidence, boundaries, and why it is proportionate. Distinguish verified facts from assumptions. This section is a proposal until explicit approval is recorded.>`

## Consequences and verification

`<Describe changes to contracts, persistence, components, dependency graph, tests, migration or rollback where relevant, and which specifications are blocked until this decision is resolved. Identify the evidence required to validate the accepted choice.>`

## Approval and adoption

| Field | Value |
| --- | --- |
| Decision outcome | `NOT DECIDED` |
| Approver | `<not recorded>` |
| Explicit approval / rejection evidence | `<not recorded; reference exact user decision or durable record>` |
| Decision timestamp | `<not recorded>` |
| Accepted baseline / spec revisions | `<not recorded>` |
| Required document updates | `<master spec, affected micro-specs, dependency graph, tests>` |
| Adoption verified | `NOT RUN` |

Architectural changes and resolutions of source ambiguity require user approval. Routine choices within an already approved specification can be recorded in an implementation report without repeated approval. A proposed ADR cannot authorise implementation of a changed architecture.

## Status history

| Timestamp | Status | Authority / evidence | Reason / related record |
| --- | --- | --- | --- |
| `<not recorded>` | `PROPOSED` | `<none>` | `<draft>` |

Allowed statuses: `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`. Preserve reasoning and approval history. Replace an accepted architectural decision with a new ADR and link both records; do not erase the prior decision.

