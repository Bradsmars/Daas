# SPEC-008 — Discovery dataset to URL inventory

| Metadata | Value |
|---|---|
| Version / date | 0.1 / 2026-10-18 |
| State / implementation | **draft** / not started |
| Direct dependencies | SPEC-004, SPEC-007, SPEC-012 |
| Entry decisions | G0; D-02, D-03, D-05, D-07, D-08, D-09 |
| Sources | M §3–4, §6–7; R: “Stage 1 needs explicit coverage and URL-identity rules.”; R: “Separate URL lifecycle, attempt outcome and execution status.” |
| Evidence | Implementation and test report under `reports/`; none yet |

## Objective and scope

Consume discovery datasets into the durable URL inventory with source-aware validation, exact URL/context deduplication and retained discovery provenance. Replays update neither scheduling ownership nor earlier successful observations.

This component owns candidate validation and inventory/provenance changes inside SPEC-012's transaction protocol. It does not crawl, select extraction fields, perform URL retirement, dispatch Actors or create its own dataset checkpoint mechanism.

## Requirements

| ID | Requirement |
|---|---|
| SPEC-008-FR-01 | Revalidate each candidate with SPEC-004 and the approved target source/context policy; reject unsupported schemes, scope violations and mismatched normalization versions. |
| SPEC-008-FR-02 | Idempotently create or locate inventory by approved canonical URL/context identity, retaining original candidate, discovery source, found-on location, method and observed discovery time. |
| SPEC-008-FR-03 | On rediscovery, update only permitted discovery facts; preserve current attempt/generation, lease, retry state, lifecycle pause/retirement, freshness and prior valid observations. |
| SPEC-008-FR-04 | Commit candidate dispositions, discovery provenance, quarantine and next raw offset atomically through SPEC-012; duplicates remain durably accounted for. |
| SPEC-008-FR-05 | Persist discovery coverage/stop/continuation metadata separately from actor success; missing candidates from any scan never trigger retirement here. |
| SPEC-008-NFR-01 | Every consumed raw position has a durable disposition before checkpoint advance; zero silently dropped malformed candidates. |
| SPEC-008-NFR-02 | Memory and transaction size are bounded by approved page/item/byte limits; no network calls occur inside SQL transactions. |
| SPEC-008-NFR-03 | Concurrent intake preserves one canonical identity without merging hash collisions or bypassing target-source permissions. |

## Inputs and outputs

| Direction | Contract and semantics |
|---|---|
| Input | Physical discovery run/dataset identity, source/configuration versions, request context, raw positioned page and discovery records/manifests from SPEC-002/012. |
| Input | Approved source/target mappings, normalization policy and actual SQL configuration; a directory's discovery source is not automatically a target owner. |
| Output | New or existing `control.urls` identity, `control.discovery_observations`, coverage audit, retained receipts/quarantine and atomic checkpoint. |
| Output | Counts for new/known/rejected candidates and bounded error summary correlated with run, ingestion and raw offset. Counts do not redefine completeness. |

Required/optional fields, timestamps and unknown-field compatibility follow SPEC-002. Missing context cannot silently choose a default market. The first source uses one approved context; the adapter boundary can support explicit future contexts without inventing entity identity.

## Technical design

1. Resolve the exact physical run and dataset; obtain a bounded raw page through SPEC-012 outside the SQL transaction.
2. Validate transport/schema shape and apply SPEC-004 to the discovered URL using the approved target policy. Preserve supplied canonical text for audit, independently compute canonical identity and reject an incompatible producer claim.
3. Resolve discovery provenance to an approved target source/context. An unrecognized external target is quarantined or held for manual review; do not automatically enable a new source.
4. Invoke the SPEC-012 transaction-scoped callback with the expected raw offset and page dispositions. In that same transaction, lock the identity bucket, compare exact canonical bytes and reuse/insert the URL using SPEC-007 collision handling.
5. Newly discovered approved URLs become active and due according to the approved initial scheduling policy; do not invent a refresh interval. First/last discovery times use min/max valid observation time, preserving out-of-order imports.
6. Rediscovery writes a deduplicated provenance observation/receipt and changes only permitted discovery fields. Never clear failure counters, advance `last_success_at`, replace `current_attempt_id`, reset a lease or unpause a source/URL.
7. Retain bad raw items with their locator and reason in quarantine inside the same transaction. Advance the raw offset only after every position has a committed disposition.
8. Persist the coverage manifest idempotently, including attempted seeds/partitions, stop reason, partial status and continuation reference. A successful Actor hitting a limit remains partial discovery.

SPEC-012 supplies transaction ownership, offset fencing and rollback; this module supplies the domain callback. Neither module may commit quarantine or checkpoint separately from inventory/provenance writes. Empty pages and terminal coverage reconciliation follow SPEC-012 rather than relying on a dataset count.

The inventory's uniqueness guard protects the entire read/compare/insert operation. Avoid an unprotected select-then-insert or blanket merge that overwrites operational columns. Test the chosen MSSQL operation against D-08 isolation settings; no particular `MERGE` implementation is mandated.

Schema/contract IDs remain strings on the wire where SPEC-002 requires them; database conversion must preserve full BIGINT precision. A new normalization version follows an approved migration/rekey path rather than treating all existing targets as newly discovered.

## Dependencies and integration boundary

| Direct predecessor | Required verified capability |
|---|---|
| SPEC-004 | Canonical URL/context identity and scope validation, including collision-independent equality rules. |
| SPEC-007 | Inventory, provenance, coverage, quarantine, receipts and checkpoint schema with actual SQL constraints. |
| SPEC-012 | Raw positioned pages and transaction-scoped callback/checkpoint protocol. |

Can proceed in parallel with extraction ingestion once these interfaces are verified and migration ownership is fixed. Integrate at the plan's discovery-to-inventory checkpoint before using this intake in SPEC-015.

**Own verification gate:** Use approved SPEC-002 golden discovery fixtures in a controlled dataset through the verified reader and real SQL. SPEC-003's eventual Actor output is downstream compatibility follow-through, not a prerequisite for verifying this importer.

## Acceptance criteria and tests

| Criterion | Requirements | Unit tests | Real SQL integration tests |
|---|---|---|---|
| SPEC-008-AC-01: Approved candidates create exactly one correct URL/context identity with complete provenance. | FR-01, FR-02; NFR-03 | Variant/context, directory-to-target mapping and out-of-scope fixtures. | Import controlled discovery output; inspect URL, source/context and provenance; race two importers. |
| SPEC-008-AC-02: Replayed and out-of-order discovery cannot erase lease, retry, pause or success data. | FR-02, FR-03 | Permitted-field change policy and min/max timestamp cases. | Seed leased/paused/previously successful URLs, rediscover twice and assert protected fields unchanged. |
| SPEC-008-AC-03: Mixed valid/invalid pages account for every raw position atomically. | FR-04; NFR-01, NFR-02 | Malformed/missing-context/version-mismatch dispositions. | Crash before commit; assert no partial URL/provenance/quarantine/offset; retry yields one durable disposition each. |
| SPEC-008-AC-04: A hash collision retains distinct URLs and a repeated canonical URL remains one row. | FR-02; NFR-03 | Forced-collision equality fixture. | Concurrent equal/colliding candidates against real SQL locking; compare exact bytes. |
| SPEC-008-AC-05: Partial or empty discovery does not retire missing URLs. | FR-05 | Limit-hit, failed partition and absent-manifest coverage cases. | Persist partial and complete manifests; verify lifecycle unchanged for all unmentioned existing URLs. |

Integration uses both a controlled run-specific dataset through the verified reader and independent SQL connections. Capture TDD red/green for validation and protected-field behaviour; real SQL evidence proves atomicity and concurrency. Mocked inventories alone cannot satisfy these ACs.

## Failure handling and finite recovery

- Invalid shape, unsafe URL, unapproved target or missing context: quarantine with original transport position and safe reason; commit only with the parent page transaction. No network request is made by intake.
- Contract/normalization migration mismatch affecting the stream: stop/pause that import rather than mass-rekeying existing URLs; resolve policy before bounded retry.
- SQL outage/deadlock or failed quarantine retention: roll back domain writes and checkpoint. Retry the same raw page under the approved finite retry budget; on exhaustion mark blocked and alert.
- Concurrent offset/identity conflict: reload committed position after rollback; never skip to a later offset or overwrite the winning ownership state.
- Incomplete/absent coverage manifest: preserve received candidates and mark coverage unknown/partial; do not claim complete discovery or retire URLs.

## Definition of Done and blockers

Resolve G0, D-02/03/05/07/08/09 and the source-specific candidate/context schema before `ready`. All ACs, checkpoint rollback and concurrent intake must pass with real MSSQL. Record source/run versions, actual test output, protected-field snapshots and acceptance traceability under `reports/`; report any unavailable live boundary as unverified. No retirement engine, extra queue or crawling logic is introduced.
