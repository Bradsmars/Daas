# Micro-specification index

Version 0.3, 18 October 2026. **SPEC-001 is verified and integrated into `dev`; SPEC-002's offline shared-contract scope is verified and awaiting user review.** The remaining 16 specs are draft. No crawler, database or live pipeline implementation has started.

Read [the baseline](../architecture/master-spec.md), [DAG](../architecture/dependency-graph.md) and [implementation plan](../architecture/implementation-plan.md) first. G0 (user review of graph/plan) applies to every implementation task. Open decisions in the register block only the affected work; transitive predecessor gates still apply. The decisions below are a quick index; each spec's complete requirements and entry gates govern readiness.

| ID / specification | Direct predecessors | Main open decisions | State / evidence |
|---|---|---|---|
| [SPEC-001 - Repository and harness](SPEC-001-repository.md) | none | Foundation G0/D-01 resolved | verified / integrated into dev in PR #2 |
| [SPEC-002 - Versioned contracts](SPEC-002-contracts.md) | 001 | Offline scope approved; real-source/SQL decisions stay downstream | verified / [report](../../reports/implementation/SPEC-002/REPORT-20261018-02.md); user acceptance pending |
| [SPEC-003 - Discovery Actor and coverage](SPEC-003-discovery.md) | 004,016 | D-02/05/07/09 | draft / NOT RUN |
| [SPEC-004 - URL/context normalization](SPEC-004-url-normalization.md) | 002 | D-02/03/05 | draft / NOT RUN |
| [SPEC-005 - First source adapter](SPEC-005-source-adapter.md) | 002 | D-02/06/09 | draft / NOT RUN |
| [SPEC-006 - Extraction Actor](SPEC-006-extraction-actor.md) | 004,005,016,017 | D-02/03/06/07/09 | draft / NOT RUN |
| [SPEC-007 - MSSQL logical schema/migrations](SPEC-007-mssql-schema.md) | 002 | D-03/05/08 | draft / NOT RUN |
| [SPEC-008 - Discovery inventory import](SPEC-008-discovery-ingestion.md) | 004,007,012 | D-03/05/08/09 | draft / NOT RUN |
| [SPEC-009 - Atomic claims and fencing](SPEC-009-work-claiming.md) | 007,016 | D-03/04/07/08 | draft / NOT RUN |
| [SPEC-010 - Apify transport](SPEC-010-apify-client.md) | 002,016 | D-04/07 | draft / NOT RUN |
| [SPEC-011 - Durable dispatch and tracking](SPEC-011-durable-dispatch.md) | 009,010 | D-03/04/07 | draft / NOT RUN |
| [SPEC-012 - Raw datasets and quarantine protocol](SPEC-012-dataset-ingestion.md) | 007,010 | D-03/07/08/09 | draft / NOT RUN |
| [SPEC-013 - Atomic Bronze commit](SPEC-013-bronze-commit.md) | 007,012,017 | D-03/06/07/08/09 | draft / NOT RUN |
| [SPEC-014 - Reconciliation and retry scheduling](SPEC-014-reconciliation.md) | 011,013 | D-03/04/07/09 | draft / NOT RUN |
| [SPEC-015 - First end-to-end acceptance](SPEC-015-pipeline-acceptance.md) | 003,006,008,011,013,014 | D-02 through D-09 as applicable | draft / NOT RUN |
| [SPEC-016 - Runtime configuration/security](SPEC-016-runtime-security.md) | 002 | D-04/07/08 | draft / NOT RUN |
| [SPEC-017 - Evidence retention/replay](SPEC-017-evidence-replay.md) | 002,010,016 | D-06/07 | draft / NOT RUN |
| [SPEC-018 - Operational handover](SPEC-018-operational-handover.md) | 015 | D-04/06/07/08/09 | draft / NOT RUN |

The first working pipeline is CP4 / SPEC-015. SPEC-018 completes operational readiness and restore evidence before production sign-off. Correctness mechanisms in 009–014 belong before CP4, including ingestion recovery; they are not deferred hardening.

Each spec defines scope, FR/NFR, technical boundaries, inputs/outputs, direct prerequisites, acceptance/test traceability, failures and Definition of Done. Common conventions are in [the template](../templates/micro-spec-template.md) and [engineering principles](../standards/engineering-principles.md). A ready spec must replace source-specific placeholders and unresolved numeric policies with accepted concrete requirements.

For a future spec, allocate the next unused ID, copy the template, identify one independently verifiable capability, cite M/R or an accepted decision, add explicit graph edges, and review scope/contract changes. Never renumber accepted specs to match a preferred execution order.

