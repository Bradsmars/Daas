# SPEC-007 — MSSQL control and Bronze schema

| Metadata | Value |
|---|---|
| Version / date | 0.1 / 2026-10-18 |
| State / implementation | **draft** / not started |
| Direct dependencies | SPEC-002 |
| Entry decisions | G0; D-03, D-05, D-08; inherited contract decisions |
| Sources | M §4–7; R: “Separate URL lifecycle, attempt outcome and execution status.”; R: “Change the extraction contract to identify work, observations and delivery separately.” |
| Evidence | Implementation and test report under `reports/`; none yet |

## Objective and scope

Define the minimum relational foundation for durable discovery inventory, fenced work, recoverable Apify dispatch, immutable extraction history and checkpointed imports in one private MSSQL database.

This specification owns logical schema, constraints, indexes, migration verification and database permissions. It does not implement claim procedures, import logic, source normalization, provision a SQL instance or add another database. SPEC-002 remains authoritative for field types, version identifiers, context representation and content-fingerprint rules; the columns below implement those contracts rather than redefining them.

## Requirements

| ID | Requirement |
|---|---|
| SPEC-007-FR-01 | Separate source/URL lifecycle, logical run, physical execution, attempt and ingestion state; preserve relationships and immutable manifests. |
| SPEC-007-FR-02 | Store URL/context identity with exact canonical equality and explicit hash-collision handling; concurrent equal identities cannot create two inventory rows. |
| SPEC-007-FR-03 | Support immutable success/failure events, globally unique event identity, one accepted terminal event per attempt and auditable conflicting deliveries. |
| SPEC-007-FR-04 | Support atomic claims, dispatch intent, ownership fences, per-position dispositions, quarantine and raw checkpoint advancement without external transactions. |
| SPEC-007-FR-05 | Provide repeatable versioned migration and least-privilege application roles; migration failure must not leave an apparently current partial schema. |
| SPEC-007-NFR-01 | Default SQL collation must not silently merge distinct canonical bytes; full URL/payload bodies must not be scheduling-index keys. |
| SPEC-007-NFR-02 | Validate locking and transaction behaviour against the actual D-08 isolation/RCSI settings using independent SQL connections. |
| SPEC-007-NFR-03 | Bronze application access cannot update/delete committed events; credentials and sensitive payloads never appear in migration/test logs. |

## Logical design

The following is a schema specification, not executable DDL. Exact SQL types, lengths and check constraints are completed from SPEC-002 and D-08 before readiness. Use UTC instants with documented precision; preserve observation and ingestion times separately.

The current SPEC-002 proposal maps positive decimal-string source/URL IDs and lease generations to SQL `BIGINT`, UUID work/event IDs to `uniqueidentifier`, and UTC RFC3339 timestamps to UTC `datetime2`. Apify IDs and context/profile identifiers remain opaque strings. Preserve integer precision at every adapter boundary; confirm these mappings with the final approved contract before migration.

| Logical entity | Required columns and invariants |
|---|---|
| `control.sources` | `source_id`, name, approved scope/profile/configuration versions, enabled/pause reason, target ownership, `rate_limit_group_id`, freshness/retry policy reference, creation/update timestamps. Keep discovery provenance distinct from target source. |
| `control.request_contexts` | `request_context_id`, source ownership or approved shared scope, versioned immutable context representation and content fingerprint. A changed context creates an explicit new identity/version. |
| `control.rate_limit_groups` | Group ID, policy version, pause state/reason, current admission/logical-run ID, admission generation and bounded execution deadline; serialize fetching admission across both stages. |
| `control.urls` | `url_id`, target source/context, normalization version, canonical URL and exact identity bytes, URL hash, collision discriminator, original URL, page type, lifecycle `active/paused/retired`, discovery timestamps, `last_success_at`, last meaningful check time, `next_scrape_at`, failure count, `current_attempt_id`, `lease_generation`, lease owner/expiry, creation/update timestamps. |
| `control.scrape_runs` | Logical `run_id`, unique immutable `dispatch_id` from SPEC-002, stage, source/context, immutable submitted manifest and fingerprint, configuration/profile/build references, dispatch intent/state, admission generation, dispatch deadline, coverage manifest for discovery, reconciliation state, creation/finalization timestamps and counters. Do not reduce physical executions to one mutable Apify ID. |
| `control.actor_executions` | Execution ID, logical run FK, unique Apify run ID, run-specific dataset/storage IDs, Actor/build ID, provider status, start/end/check timestamps and drain state. Multiple physical executions may reference one logical run. |
| `control.url_attempts` | Immutable `attempt_id`, URL/run/context FKs, assigned lease generation, attempt timestamps/status, nullable accepted terminal event FK, outcome/error information and observation timestamp. An attempt belongs to its immutable run manifest. |
| `control.dataset_ingestions` | Ingestion ID, unique dataset identity and stream/version, logical/physical execution linkage, next raw offset, ingestion status/version, progress timestamp, terminal/drain observations and completion state. Offset is never a transformed item count. |
| `control.dataset_item_receipts` | Dataset-ingestion ID plus raw offset, disposition (`event/replay/quarantine/discovery`), durable event/quarantine/inventory audit reference and content fingerprint. Unique transport position records exactly how it was accounted for. |
| `control.discovery_observations` | Dataset/offset or approved stable discovery identity, discovery run/source, approved target source/context/URL, found-on URL, discovery method/time and coverage reference. Preserve repeated discovery provenance without replacing current scheduling state. |
| `bronze.extraction_events` | Event ID, canonical event-content fingerprint, logical/physical run, dispatch and attempt IDs, URL/source/context/generation, requested/final URL and redirect provenance, observed/ingested times, nullable HTTP status, outcome/reasons, schema/parser/config/build versions, records/payload JSON and evidence references/hashes. Valid failure envelopes are retained too. |
| `bronze.quarantined_items` | Quarantine ID, dataset/raw offset or transport locator, original retained item, content fingerprint, safe reason/error classification, schema/ingestion version, timestamp and review status/owner. Retain rejected content under the approved privacy/retention policy. |

`bronze.extraction_events` is the MVP observation store; do not create a competing successful-only observation table. The accepted-event pointer references an event belonging to that attempt; enforce this relationship with suitable composite keys/constraints or a guarded database operation. Do not rely on a code convention alone to permit multiple accepted outcomes.

## Identity, indexing and transaction boundaries

- Recompute identity bytes/hash using the SPEC-002/004 contract at intake. Compare canonical identity by byte value and length, independent of case-insensitive collation and SQL padded-string comparison. Text remains available for inspection.
- Use a narrow hash-bucket lookup index on source/context/normalization version/hash. Under a protected bucket transaction, compare exact bytes, reuse an equal row, or allocate a collision discriminator for a genuinely different canonical identity. Hash equality alone never means URL equality.
- A unique bucket/discriminator key and transactional collision allocation support explicit distinct rows on collision. Validate range/row locking under D-08; do not use a full long URL as a unique index key or silently discard a collision.
- This collision-bucket/discriminator schema is a proposed evolution requiring D-03 approval alongside its SPEC-002 identity encoding; it is not silently introduced as an accepted source requirement.
- Index due active URLs by rate/source group as required, due time and URL ID; index expired ownership, attempts by run and URL/time, physical run identity, unique event ID, dataset-ingestion identity and raw transport positions.
- Keep JSON and full canonical bodies out of index keys. Use included scalar columns only where an actual claim/import query requires them. Record representative query plans without imposing an invented throughput target.
- A normalization-version change requires the approved migration/rekey policy; adding a new version column value must not silently create duplicate inventory for existing targets.
- Ingestion commits receipts, quarantines or domain records, accepted outcomes, fenced URL changes and offset in one local transaction. Apify and evidence-storage network calls occur outside it.
- Check JSON validity, referential integrity, nonnegative offsets/generations and approved state enums. Never default an unknown lifecycle or outcome to success.

## Inputs, outputs and dependencies

Input is the approved SPEC-002 contract revision plus actual SQL version, collation, RCSI/isolation and migration permissions from D-08. Output is a versioned schema, migration manifest, permission matrix and inspection evidence. There is no live schema output during this documentation task.

SPEC-002 is the sole direct graph prerequisite. Consumers 008/009/012/013 may design against the reviewed schema concurrently; migration ownership is serial and consumers merge only after this schema is verified.

**Own verification gate:** Prove schema constraints and guarded operations through fixture-level SQL operations on the real database. Verification does not wait for implemented claim/import/reconciliation modules; their later checkpoints provide consumer follow-through without creating prerequisites back to 008/009/012/013.

## Acceptance and tests

| Criterion | Requirements | Unit / structural verification | Real MSSQL integration verification |
|---|---|---|---|
| SPEC-007-AC-01: All logical relationships, constraints and contract fields are present and versioned. | FR-01, FR-03, FR-04 | Contract-to-column review and migration manifest validation. | Apply to an isolated empty D-08 database; inspect metadata, FKs and JSON/state rejection. |
| SPEC-007-AC-02: Equal URL identities deduplicate; unequal identities sharing a forced hash remain separate. | FR-02; NFR-01 | Byte-equality, case, trailing-space and forced-collision fixtures. | Two connections race same/colliding buckets; assert exact identity preservation and no silent merges. |
| SPEC-007-AC-03: Duplicate event identity and competing accepted outcomes cannot silently overwrite history. | FR-03 | Constraint/guard inspection against SPEC-002. | Attempt conflicting events and a second accepted pointer through authorised operations; reject or quarantine without mutation. |
| SPEC-007-AC-04: Atomic rollback restores all import state and grants deny Bronze mutation. | FR-04, FR-05; NFR-03 | Migration/permission checks. | Roll back event+receipt+offset writes; test application role insert/read versus update/delete denial. |
| SPEC-007-AC-05: Migration failure is visible and actual isolation supports intended consumers. | FR-05; NFR-02 | Version-step failure cases. | Inject a failed migration, rerun safely, inspect version history and document lock/query behaviour under real settings. |

Meaningful schema behaviour requires integration-first red evidence, such as a failing constraint or missing structure before migration. Mocks cannot prove uniqueness, locking, isolation or permissions. Test data and cleanup must remain inside an isolated database or uniquely owned fixture scope.

## Failure handling and bounded recovery

Reject unsupported SQL configuration before migration. On migration error, roll back the supported transactional step and leave its version unapplied; investigate before a bounded explicit retry. Destructive migration or rollback requires a separate approved change, never automatic data removal.

A deadlock/serialization conflict rolls back its transaction; callers use the finite D-07 retry budget. A forced hash collision takes the distinct-identity path or fails explicitly; it never merges records. Contract/schema incompatibility blocks consumers until an approved coordinated revision. No retry loop may conceal an invalid schema.

## Definition of Done and open decisions

G0 and D-03/05/08, including actual collation/isolation, identity bytes and compatible contract types, must be resolved before `ready`. Report the schema revision, actual migration/constraint/permission results, rollback evidence, query plans and consumer interface review under `reports/`. All ACs must pass on real MSSQL; no skipped database check counts as verified. Schema contains no unapproved infrastructure or competing Bronze authority.
