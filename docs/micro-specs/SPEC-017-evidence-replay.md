# SPEC-017 — Selected evidence retention and parser replay

Version: **0.1**. Updated: **2026-10-18**. State: **draft**. Implementation: **not started**.

Owner: unassigned shared-evidence/integration implementer. Acceptance authority: user or delegated reviewer.
Plan: [dependency graph](../architecture/dependency-graph.md), [implementation plan](../architecture/implementation-plan.md).
Sources: [M](../architecture/master-architecture.md) §§4, 7; [R](../architecture/architecture-review.md): "Bronze should preserve enough evidence to explain and repair the data." and "The implementation approach should minimise operational machinery." Source revisions: [master-spec v0.1](../architecture/master-spec.md).

## Objective and scope

Retain explicitly selected response evidence so a parser defect can be explained and a corrected parser can be tested without refetching the source. Establish the evidence verification barrier required before applicable SQL success.

In scope: evidence selection policy, capture/reference contract, immutable archival keys/checksums, approved retention/access, availability verification, bounded parser replay and safe orphan cleanup. Out of scope: universal historical replay, a new object-storage service, Silver/Gold backfills, automatic correction of committed observations or a general data lake.

**Storage remains unresolved under D-06.** Choose an existing durable object store, or explicitly accept a bounded named-Apify-storage pilot with approved limitations. This specification provisions neither. Sampling cannot promise full historical reprocessing.

## Requirements

| ID | Required behaviour | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-017-FR-01 | Apply a versioned approved selection policy to parser failures and a deterministic sample of successes; record selection reason, retention class and whether durable evidence is a prerequisite for that observation's success. | R: Bronze evidence; D-06 | AC-01 |
| SPEC-017-FR-02 | Capture the evidence needed by the parser: response HTML/JSON and, where required, rendered DOM or relevant response bodies. Record safe content type, byte length, capture time, provenance, parser/build/config versions and checksum in the 002 reference contract. Screenshots alone cannot satisfy parser replay. | M §7; R: Bronze evidence | AC-02 |
| SPEC-017-FR-03 | Archive using immutable approved storage references/keys; verify required evidence content/hash and approved durability/retention before 013 commits its reference and success. Repeating upload/verification is safe; conflicting content under an immutable key is an error. | R: Bronze evidence; D-06 | AC-02, AC-03 |
| SPEC-017-FR-04 | Retrieve only approved evidence references, validate type/size/hash and replay a selected retained item through a specified parser callback without network fetching. Preserve the original record; replay output is a diagnostic candidate with original/replay versions and lineage. | R: Bronze evidence/sign-off | AC-04 |
| SPEC-017-FR-05 | Honour approved access, retention, privacy/deletion and cleanup rules. Identify expired, unavailable or corrupt evidence explicitly; never claim replayability beyond selected retained observations. | M §7; R: Bronze evidence; D-06 | AC-05 |
| SPEC-017-FR-06 | Track safely retryable uploaded-but-uncommitted evidence and clean only demonstrably owned orphan objects after an approved grace/recovery window and reference recheck. Do not delete referenced, active-upload or foreign objects. | R: Bronze evidence | AC-06 |

| ID | Non-functional requirement and verification | Source / decision | AC |
| --- | --- | --- | --- |
| SPEC-017-NFR-01 | Capture/upload/read/replay/cleanup obey D-06/D-07 byte, time, sample, retry and retention limits; stream/bound memory and reject oversize/decompression expansion. | M §7; D-06/D-07 | AC-01–02, AC-05–06 |
| SPEC-017-NFR-02 | Resolve only approved storage locations through 016's permissions; minimise stored sensitive material and redact secrets/personal data from metadata/logs/reports. Test malicious references and access denial. | M §7; R: SSRF/evidence locations | AC-02, AC-05 |
| SPEC-017-NFR-03 | Replay is deterministic for pinned evidence/parser/config fixtures and has no website, SQL-state or original-evidence mutation. Inspect lineage and repeat the same replay. | R: basic replay | AC-04 |

## Technical design and boundaries

Planned owners: a narrow shared evidence helper, an approved storage adapter in the integration service, and a replay harness accepting an injected versioned parser callback over retained bytes/context. 002 owns evidence/reference and result schemas; this spec owns the local replay seam. Real source parser implementation belongs to 005/006; callback fixtures permit this spec to be verified without a hidden direct dependency on 005. Their real parser integration is checked in 006/015.

Actors stage only policy-selected evidence under approved permissions and include evidence metadata in their event envelope. The integration side promotes/archives where the chosen policy requires it, verifies content and retention, then supplies a verification result to 013. No network/object-store operation belongs inside the short SQL ingestion transaction. If required evidence cannot be verified, success remains blocked; it is not downgraded silently to optional.

Use 002's proposed exact-byte SHA-256 checksums and immutable per-capture object references, subject to D-03/D-06 approval. Reuse a prior identical upload on retry; reject a key/content conflict. Archival promotion must not rewrite the immutable event envelope or its canonical fingerprint; persist durable-copy/verification metadata separately under the agreed ingestion model. Keep raw bodies outside SQL scheduling tables. An evidence reference is not permission to fetch an arbitrary URL or follow redirects to unapproved locations.

The D-06 named-Apify pilot must document actual storage retention, access and cleanup capabilities, outage window and durability limitations. An existing object-store option must document those same properties. Required success barriers follow the approved policy; neither a temporary dataset reference nor an unchecked upload acknowledgment proves durable evidence.

Replay retrieves and verifies retained bytes, supplies a fixed parser/config version, and emits a diagnostic comparison. It does not rewrite append-only Bronze or mark an original attempt successful. Historical repair would need a separately approved specification with new lineage. Cleanup uses owned-object provenance, grace time and a fresh committed-reference/active-upload check; race safety must be proven under the chosen storage mechanism before deletion is enabled.

## Inputs and outputs

| Direction | Contract / type | Validation and semantics | Owner / consumer |
| --- | --- | --- | --- |
| Input | Required response bytes/stream, safe type, event/work correlation and policy/version | Approved scope; bounded bytes; no credentials in reference metadata | 002/006 |
| Input | Approved storage/config/secret references and retention settings | No invented defaults; absent D-06 policy blocks archive/replay readiness | 016 / D-06 |
| Output | Evidence descriptor or explicit not-selected / blocked / failed result | Reference, checksum, retention, selection and success-barrier state; no raw body in logs | 002/006/013 |
| Output | Replay diagnostic and orphan-cleanup audit | Original ID/hash and parser lineage; no source refetch or silent mutation; deletions narrowly owned | 015/018/reports |

## Dependencies and entry gate

Direct dependencies: **[002](SPEC-002-contracts.md), [010](SPEC-010-apify-client.md), [016](SPEC-016-runtime-security.md)**, verified for evidence/replay contracts, required Apify access and approved storage/security boundaries.

Blocked by **G0, D-06 and D-07**, plus **D-04** for the hosted-Apify/access choice used by a pilot. D-01/D-03 apply through 002. Approve storage option, selected evidence classes/sample rule, real byte/retention/outage bounds, access/deletion ownership and pre-success coverage before readiness. Choose existing storage or the explicitly accepted pilot; adding a new service needs a separate justified user-approved ADR.

Parallel opportunity: 011 and 012 after their own gates. Verify this module's selected-storage/callback boundary for **CP3**; reunite it with 006/013 before **CP4**. Real approved-source corrected-parser replay is tested by 015, and retention/operations by 018/**CP5**. Downstream completion is not a hidden prerequisite for verifying 017.

## Acceptance criteria and traceability

AC identifiers below are prefixed `SPEC-017-`.

| ID | Observable pass condition | Requirements | Unit verification | Integration verification |
| --- | --- | --- | --- | --- |
| AC-01 | Fixed event/policy fixtures select exactly the approved failures/success sample and mark required-before-success cases consistently within caps. | FR-01, NFR-01 | Selection/version/boundary fixtures | Inspect synthetic captured selection against approved policy |
| AC-02 | Required HTML/JSON/DOM bytes archive under immutable references with matching checksum/length/provenance; oversize/unapproved input is rejected safely. | FR-02–03, NFR-01–02 | Content/type/hash/reference fixtures | Upload/read back in chosen existing storage or approved pilot |
| AC-03 | Interrupted upload and repeated verification reuse identical content; conflicting key fails; missing required evidence prevents eligibility for 013 success. | FR-03 | Retry/conflict/barrier fixtures | Storage fault injection plus 013 barrier contract; real commit in 013 |
| AC-04 | A selected fixture with a parser defect replays through a corrected callback, yielding expected fields with lineage, zero HTTP calls and unchanged original data. | FR-04, NFR-03 | Pinned callback/bytes deterministic replay | Retrieve real retained test evidence; adapter integration in 006/015 |
| AC-05 | Expired/corrupt/denied/malicious references return distinct safe errors and no success/replay claim; storage settings meet approved retention/access rules. | FR-05, NFR-01–02 | Error/redaction/reference attack fixtures | Approved storage permission/retention checks; document provider limits |
| AC-06 | Cleanup removes only owned unreferenced objects past grace, rechecks current references and preserves referenced, active, racing or foreign objects. | FR-06, NFR-01 | Orphan/reference/race fixtures | Safe isolated storage prefix and concurrent reference/upload case |

## Tests, failures and recovery

First TDD red target: missing required evidence must prevent success eligibility. Unit cases cover deterministic sampling, checksum mismatch, immutable conflicts, wrong storage host, oversize content, expired evidence, replay isolation and cleanup races. Integration uses synthetic evidence in an isolated owned prefix/container/named store; verify actual access/retention capabilities. Do not shorten real customer retention or delete shared data to test cleanup.

| Failure | Observable result / finite retry | Recovery |
| --- | --- | --- |
| Upload timeout / archive unavailable | Pending/failed evidence; required success barrier stays closed | Retry same immutable content within approved window |
| Corruption / immutable key conflict | Typed integrity error; no overwrite | Retain diagnostics; quarantine/review under approved policy |
| Evidence expired or deleted | Explicit unavailable replay; no invented reconstruction | Report coverage gap; any refetch is separate approved work |
| Cleanup ownership/reference uncertain | Preserve object and log safe skip | Reconcile later; never broaden deletion scope |
| Parser fails during replay | Diagnostic failure; original unchanged | Correct/pin callback and rerun with new report ID |

Required test status: **NOT RUN**. Use [reporting standards](../standards/reporting-and-decisions.md) for exact commands/exit codes, evidence checksums, policy/parser revisions, storage capability evidence and AC results; store no sensitive raw responses in reports.

## Definition of Done and completion

- [ ] G0/D-06/D-07 and relevant access choices resolved; direct dependencies verified; no assumed store.
- [ ] All FR/NFR/AC checks pass with meaningful TDD, real chosen-storage round trip and safe cleanup evidence.
- [ ] Exported evidence barrier and callback contract verified without downstream completion; actual source-adapter replay explicitly assigned to 015/CP4.
- [ ] Retention/outage limits, replay coverage gaps, safe access and operator cleanup ownership documented.
- [ ] No new unapproved service, original-data mutation or required missing checks; reports reviewed.

Implementation report: **not started**. Test results: **NOT RUN**. Verification/acceptance: **pending**. Architectural decisions: **none accepted**. Change history: **0.1 / 2026-10-18 / initial source-traced draft**.

