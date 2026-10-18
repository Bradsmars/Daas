# SPEC-013 — Atomic Bronze events and accepted outcomes

| Metadata | Value |
|---|---|
| Version / date | 0.1 / 2026-10-18 |
| State / implementation | **draft** / not started |
| Direct dependencies | SPEC-007, SPEC-012, SPEC-017 |
| Entry decisions | G0; D-02, D-03, D-06, D-07, D-08, D-09 |
| Sources | M §4–6; R: “Change the extraction contract to identify work, observations and delivery separately.”; R: “Lease expiry must trigger reconciliation, rather than immediate rescraping.”; R: “Bronze should preserve enough evidence to explain and repair the data.” |
| Evidence | Implementation and test report under `reports/`; none yet |

## Objective and scope

Durably retain valid extraction success/failure envelopes while accepting at most one fenced authoritative terminal outcome per logical attempt. Commit event history, outcome/state changes and the raw dataset checkpoint atomically.

Own extraction-domain validation, event replay/conflict handling and fenced outcome persistence through SPEC-012. Do not launch Actors, manufacture missing fetch observations, transform facts into Silver, overwrite old Bronze or provision evidence infrastructure.

## Requirements

| ID | Requirement |
|---|---|
| SPEC-013-FR-01 | Validate envelope contract, work/context/version identity, execution binding and immutable assignment manifest before considering an event authoritative. |
| SPEC-013-FR-02 | Append valid success and failure envelopes once per global event ID; identical redelivery is replay, differing canonical content under the same ID is a retained contract conflict. |
| SPEC-013-FR-03 | Accept no more than one authoritative terminal event per attempt, using the approved selection policy and current attempt/generation fence. |
| SPEC-013-FR-04 | Preserve valid late/duplicate physical observations as history without clearing newer ownership, changing accepted outcome or regressing freshness. |
| SPEC-013-FR-05 | Require approved source-schema invariants, trusted pinned adapter/version attribution and applicable durable evidence before success; update last success/refresh or failure scheduling only in the same durable SQL transaction. |
| SPEC-013-FR-06 | Commit event/replay/quarantine receipts, accepted outcome, eligible URL changes and next raw offset through the one SPEC-012 page transaction. |
| SPEC-013-NFR-01 | Immutable event content never changes on replay; identity collisions never silently replace data; accepted outcomes and failure increments occur at most once. |
| SPEC-013-NFR-02 | SQL transactions contain no network/evidence calls and remain bounded by approved raw-page limits. |
| SPEC-013-NFR-03 | Observation-time ordering and fence checks prevent delayed ingestion from moving current valid freshness backwards. |

## Inputs and outputs

| Direction | Contract |
|---|---|
| Input | Raw positioned extraction envelopes from SPEC-012 containing SPEC-002 event, attempt, generation, run/execution, source/context, URL, outcome, time/version, record and evidence fields. |
| Input | Assigned immutable manifest, registered physical execution, current ownership, approved freshness/failure classification and evidence-verification result from SPEC-017. |
| Output | Immutable `bronze.extraction_events`, replay/conflict disposition, at most one accepted terminal event pointer, eligible attempt/URL state changes and raw receipts/checkpoint. |
| Output | Safe counts of success/failure/history/replay/quarantine with run/dataset correlation; Actor success remains separate from committed valid observations. |

Zero/one/many records and null semantics follow the approved source contract. HTTP status may be null when no response exists. A valid failure envelope is data to retain, whereas an invalid envelope is quarantined; neither is silently converted into successful extraction.

## Event and authority policy

**Proposed policy, pending D-03:** The first valid terminal event committed for an attempt that matches its assigned manifest, registered execution and the current `(current_attempt_id, lease_generation)` becomes authoritative. Selection order is successful SQL commit order, not dataset order across different executions. Approval must confirm this trade-off; a later success does not overwrite an earlier accepted failure.

Other valid physical events remain immutable historical evidence. An event for a superseded fence cannot become authoritative even when its fetch time is newer. An event claiming another source/context/assignment or unbound execution is quarantined and cannot mutate control state. A logical batch may have multiple registered physical executions without granting multiple accepted outcomes.

The same event ID and canonical event-content fingerprint is replay. Transport-only dataset position and ingestion time do not change event identity; exact canonicalization/fingerprint fields and algorithm belong to SPEC-002 and require D-03 approval. The same ID with different canonical content creates quarantine evidence referencing the existing event; never update that event to the new payload.

## Atomic ingestion design

1. Read the bounded raw page using SPEC-012. Verify registered pinned execution/build and validate envelope, declared outcome and business-record invariants against the approved SPEC-002 source schema. The importer does not parse HTML or rerun SPEC-005; upstream adapter validity is tested at its own boundary and followed through at pipeline checkpoints.
2. Verify/retain any required evidence through SPEC-017 outside SQL, using immutable keys/hashes and the approved selection policy. Required-but-temporarily-unavailable evidence blocks page commit; do not mark success then repair it later.
3. Within the SPEC-012 transaction callback, check registered logical/physical run linkage and manifest membership. Lock event identity and the logical attempt/URL in a consistent order appropriate to the actual isolation settings.
4. Insert a new valid immutable event, link an exact replay, or retain a conflicting/invalid item in quarantine. Keep a receipt for every raw position; no event or error disappears because a sibling item succeeded.
5. If no accepted terminal pointer exists and the manifest/current fence matches, atomically accept the terminal event. A database uniqueness/guard must resolve simultaneous physical-event races; the loser remains history.
6. On accepted success, update successful observation time using the monotonic maximum of valid observation times; compute refresh from approved policy without regressing a newer accepted observation's schedule. Clear only the matching current ownership. Preserve an older valid observation when a refresh fails.
7. On accepted failure, update attempt diagnostics and failure/backoff or pause state exactly once under D-07/09. Keep URL lifecycle distinct; this ingestion component does not infer retirement from absence or a single scan.
8. Return durable dispositions to SPEC-012, which writes receipts/quarantine and advances raw offset inside that same transaction. Commit once; any exception rolls back all page effects.

Observation timestamps must satisfy approved contract plausibility rules; an untrusted far-future timestamp cannot freeze freshness. Ingestion time measures pipeline latency and is never substituted for fetch time. Meaningful unchanged checks use their separate approved check timestamp, without fabricating new business values.

Evidence uploaded before a rolled-back SQL transaction is retried idempotently through SPEC-017; abandoned evidence cleanup follows its retention rules. No external cleanup runs in the SQL transaction. A dead Actor with missing manifest results is handled by SPEC-014, not a fabricated Bronze event.

## Dependencies and parallel boundary

| Direct predecessor | Required verified capability |
|---|---|
| SPEC-007 | Immutable event/attempt relationships, uniqueness, ownership and receipt/checkpoint schema. |
| SPEC-012 | Raw positions and one transaction-scoped domain/quarantine/checkpoint protocol. |
| SPEC-017 | Approved evidence classification, durability verification and replay-safe references. |

Can proceed in parallel with extraction Actor/discovery intake against verified contracts; SQL migration ownership is serial. Join at the event-to-Bronze checkpoint before reconciliation and SPEC-015 end-to-end acceptance.

**Own verification gate:** Use approved synthetic source envelopes, registered pinned-execution/manifest fixtures, verified evidence references and real SQL. Neither the implemented HTML parser (005), extraction Actor (006), dispatcher (011) nor reconciler (014) is a hidden prerequisite. Actual producer/consumer and recovery follow-through remains required in their later integration checkpoints and 015.

## Acceptance criteria and tests

| Criterion | Requirements | Unit tests | Real SQL integration tests |
|---|---|---|---|
| SPEC-013-AC-01: Valid success and failure envelopes retain complete immutable provenance; invalid assignment/context cannot succeed. | FR-01, FR-02, FR-05 | Contract, manifest, null HTTP, declared outcome/source-schema invariants and cardinality cases. | Import representative envelopes against registered pinned executions/attempts; inspect stored content and invalid-item quarantine. |
| SPEC-013-AC-02: Replays add no event/outcome/failure increments; conflicting same-ID content is quarantined. | FR-02, FR-06; NFR-01 | Canonical fingerprint/equality and transport-only differences. | Replay same page/event via two dataset positions, then conflict; original remains unchanged and offsets are accounted for. |
| SPEC-013-AC-03: Simultaneous physical events yield at most one authoritative terminal outcome. | FR-03; NFR-01 | Proposed first-valid-committed policy including failure-before-success. | Two connections race distinct valid event IDs for one current attempt; one pointer/state update, other history. |
| SPEC-013-AC-04: Stale fences and delayed observation times cannot change newer ownership or regress freshness. | FR-04, FR-05; NFR-03 | Generation mismatch, older/newer time and future-time validation. | Supersede owner, import late result, assert newer fence/state unchanged; import delayed valid history and inspect monotonic timestamps. |
| SPEC-013-AC-05: Evidence failure and SQL interruption cannot leave success ahead of durable records/checkpoint. | FR-05, FR-06; NFR-02 | Missing required evidence and evidence-policy selection. | Inject failures after event/attempt/URL writes and before offset; assert total rollback; retry verified evidence and commit once. |

Record TDD red/green for authority, replay and stale-fence policy. Real MSSQL must prove concurrent uniqueness and full rollback; integrate controlled Apify output plus verified retained evidence for the relevant checkpoint. A mocked repository is insufficient durability evidence.

## Failure handling and finite recovery

Contract/manifest violations and event conflicts retain original item plus safe reason as quarantine in the page transaction. A transient evidence or SQL failure rolls back progress and retries the same committed raw offset under D-07's finite import budget. Permanent evidence-reference violations are quarantined under D-09; the attempt remains unresolved rather than successful.

On deadlock or ambiguous commit acknowledgement, reload the committed checkpoint/event/attempt before retrying; never refetch a website to repair import uncertainty. Retention expiry, exhausted retries or schema-wide regression pauses the affected import/parser for review. Missing outcomes remain for manifest reconciliation; no actor status alone closes them.

## Definition of Done and blockers

Resolve G0 and D-02/03/06/07/08/09, including first-valid authority policy, canonical content fingerprint, actual evidence guarantees and SQL configuration. All ACs pass with actual concurrent SQL and required evidence-boundary results. Report accepted-vs-historical traceability, conflict/quarantine, rollback, monotonic-time and replay evidence under `reports/`. No skipped durability check is accepted as verification; no independent quarantine/checkpoint commit path exists.
