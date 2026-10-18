# DaaS specification baseline

Version: 0.1. Date: 18 October 2026. Status: **draft for user review**.

This is an implementation planning synthesis, not a replacement for either source document. Proposed resolutions become binding only after user approval of the affected scope/decisions. SPEC-001/002/004 are verified and integrated into dev. SPEC-016's controlled HTTP, environment-secret and explicit fixture-policy scope is authorised under [ADR-0004](decisions/ADR-0004-controlled-http-security.md). The [approval register](approval-register.md) records these limited decisions; remaining specifications and real-source/SQL/hosted-runtime policies retain their gates.

## Authoritative inputs and provenance

The user supplied `C:\Users\Bradley\Downloads\daas_architecture_codex_pack.zip`. Its two documents were extracted without modification. SHA-256 hashes:

| Input | SHA-256 |
|---|---|
| Archive | `7F2D55D488EC0A400B59E1D6CE447986B8F62AEF13F723C15624BCAD16955AE6` |
| [M: master-architecture.md](master-architecture.md) | `DE85374230824CD2AF37BD98BC47ECC9CDEF9DA4428518CA9FE317B4E5A4B9D3` |
| [R: architecture-review.md](architecture-review.md) | `ECF031BDBE9BC9C0F89A75D8B8BE2166DD5D3788F963D8F38515DCCB058851B5` |

References such as `M §4` mean a numbered section of the original architecture. `R: Lease expiry` refers to the review paragraph beginning with those words. Examples in either source are illustrative, not an approved niche or field contract. Source documents are design evidence; their embedded historical prompts do not authorise implementation.

User constraints take precedence. Read M and R together: R refines M, but a material incompatibility must receive an explicit resolution in [the approval register](approval-register.md), rather than silently selecting one. Accepted ADRs record those resolutions and the affected spec revisions. External vendor references validate mechanisms, not business requirements.

## Agreed architectural boundaries

- Two workloads: URL discovery and source-specific extraction, using Crawlee Actors on Apify.
- A single integration service with internal modules for import, scheduling, dispatch, reconciliation and operations.
- One private MSSQL database initially, separating operational `control` metadata from append-only `bronze` history.
- SQL owns durable inventory, scheduled work, ownership and committed progress. Crawlee queues own execution within a run.
- Actors do not connect to MSSQL. Actor success is independent of SQL ingestion success.
- First deliver one approved source, one request context and one extraction profile end to end. Silver/Gold, customer delivery and entity resolution are outside this stage.

## Component decomposition and traceability

| Component / implementation location (planned) | Source requirement | Micro-specifications |
|---|---|---|
| Repository and test harness | M §8; R: implementation approach | 001 |
| Versioned messages / `packages/contracts` | M §3, §5; R: Change the extraction contract | 002 |
| URL/context identity / `packages/shared` | M §3-4; R: Stage 1, SQL identity | 004 |
| Approved source adapter | M §5; R: usable extraction | 005 |
| Discovery Actor / `apps/discovery-actor` | M §3; R: discovery coverage | 003 |
| Extraction Actor / `apps/extraction-actor` | M §5; R: work-aware queue and validation | 006 |
| MSSQL schema / `database` | M §4; R: separate lifecycle, attempt, execution | 007 |
| Discovery inventory import | M §3-4; R: preserve ownership and coverage | 008 |
| Atomic claim, lease fencing, shared site admission | M §5-6; R: handoff and lease expiry | 009 |
| Apify transport adapter | M §6; R: explicit physical run IDs | 010 |
| Durable dispatch and run binding | R: SQL-to-Apify handoff | 011 |
| Raw dataset reader, quarantine and checkpoint protocol | M §4, §7; R: retention and ingestion policy | 012 |
| Atomic Bronze and outcome commit | M §4-6; R: event identity and atomic ingestion | 013 |
| Reconciler, scheduling and bounded retry | M §6-8; R: manifest and lease reconciliation | 014 |
| First end-to-end acceptance | M §8; R: production sign-off demonstrations | 015 |
| Runtime configuration, permissions and target security | M §7; R: SSRF and domain budgets | 016 |
| Selected evidence retention and parser replay | M §7; R: Bronze evidence | 017 |
| Operational handover and restore verification | M §7; R: metrics and sign-off | 018 |

Numbers are stable identifiers, not a linear execution order. See the [DAG](dependency-graph.md).

## Proposed reconciliation of master and review

| Topic | Master | Review | Proposed baseline; approval required |
|---|---|---|---|
| URL state | Mixed pending/leased/succeeded/failure states | Separate lifecycle, attempt and execution | Use lifecycle `active/paused/retired`; due time and fenced current ownership separately; attempt outcomes do not make success terminal for recurring URLs. D-03 |
| Bronze model | Successful-only `raw_extractions` | All immutable envelopes plus observations/quarantine | `bronze.extraction_events` holds all valid outcome envelopes; successful observation records are retained within envelope records for MVP. No duplicate competing authoritative table. D-03 |
| Event identity | Includes dataset-item identity as example | Actor emits explicit event ID; raw offsets are transport positions | Globally unique event ID, stable on redelivery, separate attempt and physical execution identities. D-03 |
| Run model | `scrape_runs` with one Apify ID | Logical intent plus possibly multiple physical executions | Add `control.actor_executions`; retain durable intent/manifest in `scrape_runs`; no broker. D-03 |
| Evidence | Optional external HTML if needed | Selected retained evidence and replay are MVP essentials | Explicit policy and existing-platform storage decision before live acceptance; no new object service provisioned by this framework. D-06 |
| Runtime | TypeScript or Python unresolved | TypeScript, JSON Schema/Ajv recommended | Recommend TypeScript throughout, shared JSON Schema without coercion; await D-01. |
| Notification | Webhooks possible | Polling sufficient | Poll run-specific outputs; no public webhook endpoint initially. D-04 |

## Proposed message and state invariants

These requirements originate in the review; details are specified in 002, 007, 009 and 013. They must be approved together to avoid contract/schema disagreement.

1. Fetch-target identity is `(target_source_id, request_context_id, normalization_version, canonical_url)` under approved source rules, not a downstream product identity. Version changes require an explicit migration/rekey decision, not silent duplicates.
2. A logical batch has an immutable manifest. Each assignment has `attempt_id`, `url_id`, context and `lease_generation`. One batch may have more than one physical Apify execution.
3. An outcome envelope has a producer-generated `event_id`, execution identity, work identity, observation time, nullable HTTP status, versions, records and evidence references. Redelivery preserves identity and content. A real refetch creates a new event.
4. SQL uniqueness rejects conflicting event identity. Only one terminal event can become authoritative for an attempt. Other valid physical observations may remain historical without changing current ownership.
5. Successful completion requires valid usable extraction, required evidence availability, immutable Bronze commit, accepted attempt outcome and a matching current ownership fence. These SQL changes and raw checkpoint advancement share one short transaction.
6. Expired leases and ambiguous launches go to reconciliation, not automatic rescraping. A killed Actor may leave assignments without events; do not manufacture observations for them.
7. Dataset input uses ascending raw offsets with no omission/expansion transforms. Every consumed position is durably represented by an event, replay decision or quarantine record before its checkpoint advances.
8. Discovery upserts update discovery facts without overwriting leases, retry policy or previous valid observations. Partial discovery cannot retire absent URLs.
9. All terminal physical executions are drainable, including failed, aborted and timed-out runs. Completion requires terminal status, stable drain confirmation and assignment reconciliation; item count alone is insufficient.

## MVP boundary and deferred work

The first acceptance milestone includes baseline recovery correctness: concurrent claim safety, unknown dispatch handling, fenced completion, partial Actor output, replay, quarantine and ingestion retry. These cannot be deferred as later hardening.

Keep the integration service as a single deployable. Use polling and one active fetching execution per shared rate-limit group. Use the selected source's least expensive permitted fetch method; browser support is introduced only if that source requires it. Initial discovery implements the approved method only; the adapter boundary supports adding sitemaps or pagination without building all strategies now.

Defer multi-source scale, adaptive refresh, webhook endpoints, marketplace Actor generalisation, generalized workflow languages, distributed rate limiting, bulk warehousing, Silver/Gold and customer APIs. Do not add Airflow, Prefect, Dagster, Temporal, Redis, Kafka, Kubernetes or a new storage service without a justified accepted ADR.

## Readiness and approval

The source analysis is complete at framework level. Source-specific payloads, numeric budgets, SQL isolation settings, evidence retention and runtime access remain unresolved because the source pack explicitly leaves them open. [D-01 to D-09](approval-register.md) identify their effects and proposed choices. An affected spec cannot become `ready` with those details left as placeholders. Approval of the plan is not a claim that any runtime capability has been implemented or tested.
