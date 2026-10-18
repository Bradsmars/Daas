# SPEC-012 — Raw dataset reader and atomic checkpoint protocol

| Metadata | Value |
|---|---|
| Version / date | 0.1 / 2026-10-18 |
| State / implementation | **draft** / not started |
| Direct dependencies | SPEC-007, SPEC-010 |
| Entry decisions | G0; D-03, D-04, D-07, D-08, D-09 |
| Sources | M §4, §6–7; R: “Apify datasets need an explicit retention and ingestion policy.”; R: “The SQL-to-Apify handoff needs a precise failure-recovery protocol.” |
| Evidence | Implementation and test report under `reports/`; none yet |

## Objective and scope

Supply bounded raw Apify dataset pages with stable transport positions and a reusable local SQL transaction protocol for discovery and extraction consumers. Guarantee that a checkpoint cannot outrun its durable domain writes, replay decisions or quarantine.

Own transport pagination, raw-position accounting, quarantine retention and checkpoint concurrency. SPEC-008 owns discovery mutations; SPEC-013 owns event/outcome/fenced URL mutations. This specification must not create an independent quarantine/checkpoint commit path that bypasses those consumers.

## Requirements

| ID | Requirement |
|---|---|
| SPEC-012-FR-01 | Read run-specific datasets in ascending raw offset order without cleaning, omission, expansion or mutable views. |
| SPEC-012-FR-02 | Preserve each original stored item's complete JSON representation, dataset identity, raw offset and applicable physical/logical run reference through validation. |
| SPEC-012-FR-03 | Expose a transaction-scoped callback protocol so domain writes, receipts, quarantines and next offset commit or roll back together. |
| SPEC-012-FR-04 | Serialize or compare-and-swap checkpoint ownership so concurrent readers cannot skip or contradict positions; retries resume at the committed next raw offset. |
| SPEC-012-FR-05 | Retain rejected raw items and reason before advancing; schema-invalid and conflicting deliveries are not silently discarded. |
| SPEC-012-FR-06 | Report terminal/drain evidence without inferring completion from one empty page or metadata count; final completion additionally requires assignment reconciliation. |
| SPEC-012-NFR-01 | Page/item/byte sizes, request timeouts, storage outage window and retry budgets have explicit approved finite values. |
| SPEC-012-NFR-02 | No Apify/evidence-storage call occurs inside the SQL transaction; a required quarantine failure blocks offset advance. |
| SPEC-012-NFR-03 | Loss of response, process crash and concurrent delivery cannot create a checkpoint gap; diagnostics expose safe locators rather than raw sensitive content. |

## Inputs and outputs

| Direction | Contract |
|---|---|
| Input | Verified physical run/dataset identity, stream/schema/ingestion version, committed next raw offset and bounded raw-page request policy. |
| Input | Domain callback supplied by SPEC-008 or SPEC-013, returning a durable disposition for every consumed raw position. |
| Output | Positioned untransformed items, validation diagnostics and page metadata; `next_offset = start_offset + raw_items_received`, never accepted-item count. |
| Output | A committed receipt/event/provenance/quarantine set plus checkpoint, or rollback with no progress; terminal/drain observations remain distinct from final reconciliation. |

The raw position is a transport locator, not a business event ID. Preserve unknown fields in retained items; a lossless JSON representation of the stored object is required, not a claim to possess the original website's response bytes. Nullable fields and compatibility follow SPEC-002 through the verified dependencies.

## Raw-page and transaction protocol

1. Load the exact dataset identity, its verified execution mapping and committed next raw offset. Reject a different dataset under an existing ingestion identity.
2. Through SPEC-010, fetch one bounded ascending raw page outside SQL. Disable `clean`, `skipEmpty`, `unwind` and changing field/view projections; retain raw array position even for malformed objects.
3. Validate shape/schema without coercing or silently repairing evidence. Prepare provisional dispositions and any required external evidence work outside the SQL transaction. Domain validation may refine the reason or outcome.
4. Open a short local SQL transaction and lock/fence the ingestion row at its expected `next_raw_offset`. A stale reader aborts and reloads; it does not choose a later offset.
5. Invoke the consumer callback with that same transaction handle, positioned items and prepared validation results. The callback performs discovery or Bronze/outcome mutations and returns references for every disposition.
6. Using the same transaction, retain quarantined originals, write per-position receipts referencing domain/replay/quarantine outcomes and advance to the next raw offset only after validating complete contiguous accounting.
7. Commit once through the shared protocol. Any callback, receipt, quarantine, fence or checkpoint error rolls back the entire page. Consumers cannot independently commit, and the helper cannot commit quarantine/checkpoint before their domain writes.

The transaction API should make one owner responsible for begin/commit/rollback and expose only a transaction-scoped persistence interface to the callback. Reject missing/duplicate positions or a callback that cannot prove retained references. Page size is bounded to keep this atomic unit short; do not process an unbounded dataset in one transaction.

An exact replay retains a receipt linked to the existing event/provenance disposition. Conflicting content is quarantined by the consumer's contract rules in this transaction. If original content cannot be retained within approved item limits, stop/pause at that offset; never discard it to make progress.

Dataset contents remain append-only during import. Finalized runs are not resurrected under D-04; any suspected mutation behind an imported offset is an integrity incident, not permission to rewrite Bronze or rewind history silently. Retention must exceed D-07's approved outage/recovery window.

## Drain and completion contract

An empty page before terminal execution means “no items currently visible”; retain the offset and poll within the approved bound. After a terminal run status, obtain stable drain confirmation using the D-07 approved quiet-period/recheck policy and available run/storage metadata. Do not pick an arbitrary fixed delay here.

Expose `drain_candidate` and evidence to SPEC-014. Final completion requires manifest accounting and no unresolved import/evidence positions; a count, empty response or Actor success alone never marks ingestion complete. Failed, aborted and timed-out runs follow the same readable-output path as successful runs.

## Dependencies and integration boundary

| Direct predecessor | Required verified capability |
|---|---|
| SPEC-007 | Ingestion row, receipts/quarantine schema, atomic SQL transaction and checkpoint concurrency primitives. |
| SPEC-010 | Run-specific dataset reads, metadata and terminal status with bounded transport retry behaviour. |

Can be implemented alongside durable dispatch and evidence retention. Verify the protocol with a fixture callback on real SQL, then require separate SPEC-008/013 rollback integration evidence before their consumers merge.

**Own verification gate:** A transaction-scoped fixture callback plus real SQL and controlled Apify storage proves the reader protocol, including refusal to finalize on incomplete evidence. Implemented consumers 008/013 and reconciler 014 are not required to verify 012. Final manifest reconciliation and pipeline completion remain downstream obligations in 014/015; they cannot be reported as passed by this reader's tests.

## Acceptance criteria and tests

| Criterion | Requirements | Unit tests | Real boundary integration tests |
|---|---|---|---|
| SPEC-012-AC-01: Raw positions remain contiguous across malformed items and page boundaries. | FR-01, FR-02; NFR-01 | Raw-offset arithmetic, forbidden-option and mixed-shape fixtures. | Read a controlled Apify dataset with exact expected raw array order and bounded page sizes. |
| SPEC-012-AC-02: Domain change, quarantine, receipt and checkpoint either all commit or all roll back. | FR-03, FR-05; NFR-02, NFR-03 | Callback missing-disposition/error cases. | Real SQL callback writes a fixture domain row then fails; inject failures before/after quarantine/offset and verify complete rollback. |
| SPEC-012-AC-03: Concurrent readers and lost acknowledgements resume without gaps. | FR-04; NFR-03 | Expected-offset conflict and committed-replay paths. | Two SQL connections race same page; simulate lost commit acknowledgement, reload position and verify one disposition per offset. |
| SPEC-012-AC-04: Invalid retained items are inspectable without sensitive payload logging. | FR-02, FR-05; NFR-02 | Validation reason/redaction and oversize handling. | Confirm original item+locator retained; force quarantine-write failure and prove offset stays unchanged. |
| SPEC-012-AC-05: Early empty/count-lag responses and terminal failures cannot falsely complete ingestion. | FR-06 | Running-empty, delayed metadata and partial failed-run scenarios. | Read controlled terminal outputs with the fixture callback, record drain evidence and assert at most drain-candidate state pending a separate manifest reconciliation decision. |

Use red/green tests for offset/disposition and callback rollback contracts. Real MSSQL proves atomicity; controlled Apify proves untransformed pagination. Transport fault injection may simulate count lag and timeouts, but must be labelled alongside actual API evidence.

## Failure handling and finite recovery

Timeout/429/transient storage errors retry under SPEC-010/D-07 bounds without SQL progress. Missing/expired dataset pauses ingestion with a recovery alert; do not rescrape automatically. SQL/callback/quarantine errors roll back the page and retry its committed starting offset only within the finite import budget.

Malformed item retention allows later valid positions to progress only when the entire page's disposition transaction succeeds. Irrecoverably oversized or privacy-prohibited content blocks/quarantines under approved D-09 handling; never leak it to logs. Deadline exhaustion marks import blocked for operator/reconciler action while preserving the last committed offset.

## Definition of Done and blockers

G0 and D-03/07/08/09 must fix schema/fingerprint rules, raw limits, retention, quiet-period policy and quarantine ownership before `ready`; inherited D-04 fixes finalization behaviour. All ACs pass with real SQL and controlled Apify evidence. Report actual rollback/concurrency/retention results and transaction API review under `reports/`. No separate checkpoint/quarantine commits exist in this reader or its integration contract.
