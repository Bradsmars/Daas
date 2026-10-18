# SPEC-002 - Versioned boundary contracts and work identities

Status: **draft for review; implementation not started**. Version 0.1. Updated 18 October 2026.
Owner: unassigned. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §3-6; R: Change the extraction contract to identify work, observations and delivery separately.; R: Separate URL lifecycle, attempt outcome and execution status.
Blocking approvals: [D-01, D-02, D-03, D-05, D-06, D-09; G0](../architecture/approval-register.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: not started / NOT RUN. Review recommendations remain proposed until G0 and relevant decisions are accepted.

## Objective and scope

Define and validate compatible data boundaries before producers, SQL adapters and consumers are implemented.

Actor inputs, discovery candidates/coverage, immutable work manifest, extraction outcomes, evidence references, ingestion decisions and state vocabulary. Excludes business cleansing, entity matching, HTTP customer APIs and a generic schema registry.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-002-FR-01 | Publish strict versioned JSON Schema contracts and compatible typed representations from one package; validate Actor inputs/outputs and importer input without coercing, defaulting or deleting evidence fields. | M §3, §5; R: implementation approach |
| SPEC-002-FR-02 | Distinguish URL/context identity, logical batch/dispatch/attempt ownership, physical execution and emitted event identity; define success/failure envelopes separately from 0/1/many business records. | R: Change the extraction contract |
| SPEC-002-FR-03 | Require discovery provenance and a coverage manifest with scope/configuration versions, partition/seed accounting, counts, stop reason and optional continuation. | R: Stage 1 needs explicit coverage and URL-identity rules. |
| SPEC-002-FR-04 | Emit event IDs stable on redelivery, new on genuine refetch; define identical replay versus conflicting ID content, per-attempt authority and explicit nullable/absent semantics. | R: Change the extraction contract; D-03 |
| SPEC-002-FR-05 | Define source-approved semantic field requirements, page identity and context checks; distinguish network/HTTP/parser/schema/blocked/not-found outcomes and unavailable values from valid zero/false values. | M §5; R: usable extraction; D-02, D-09 |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-002-NFR-01 | Every message carries its supported schema/configuration version and required correlation; unsupported versions are rejected or quarantined, never silently reinterpreted. | M §5; R: contracts; AC matrix below |
| SPEC-002-NFR-02 | All IDs, UTC timestamps, URLs, JSON depth/byte/record counts and enum values have explicit validation; missing numeric limits block readiness rather than create unlimited defaults. | D-03, D-07; AC matrix below |
| SPEC-002-NFR-03 | Envelope validation leaves raw business strings and numbers unchanged; error diagnostics use field paths and reason codes without sensitive values. | R: evidence; M §7; AC matrix below |

## Technical design and boundaries

Own these contracts in `packages/contracts`. Schema implementation is part of this future spec, not this Markdown draft. Producers and consumers import the same revision and maintain golden synthetic examples for each supported schema version. Incompatible meaning changes increment schema_version and coordinate all consumers; changes to normalization/context identity require an explicit migration decision. The contract catalogue below proposes exact common field names; source-specific field definitions and numeric maxima must be completed under D-02/D-07 before `ready`.

## Proposed contract catalogue (D-03 approval required)

This catalogue is the shared interface to implement after approval. It resolves illustrative naming in M into proposed common names; it is not executable JSON Schema. D-02 supplies the first source's business record schema. D-07 supplies the named size/cardinality bounds. No affected contract is ready until those are complete.

### Common scalar and validation rules

| Name | Proposed wire representation / invariant |
|---|---|
| `source_id`, `target_source_id`, `discovery_source_id`, `url_id` | Required positive decimal strings within SQL BIGINT range; no leading zeros. Avoid precision loss in JavaScript. Examples in M using JSON numbers are illustrative; this wire choice requires D-03. |
| `lease_generation` | Positive decimal string backed by SQL BIGINT; increment atomically under 009. |
| `run_id`, `discovery_run_id`, `dispatch_id`, `attempt_id`, `event_id` | Required UUID strings; run IDs identify logical batches, not provider execution. Producers allocate IDs once at the owning lifecycle boundary. |
| `apify_run_id`, `dataset_id`, `actor_build_id` | Opaque nonempty provider identifiers; never substitute logical run ID or use a latest-run alias. |
| `request_context_id` | Required opaque identifier for an immutable approved context revision; resolved dimensions include only source-relevant country/language/store/currency. |
| Version fields | `schema_version`: positive integer; `profile_version`, `parser_version`, `normalization_version`, `config_version`: required nonempty bounded strings in relevant messages. |
| Timestamps | UTC RFC3339 strings ending `Z`; reject invalid dates. Store SQL UTC timestamps distinctly for observation, discovery, check and ingestion. |
| URLs | Absolute HTTP(S) URL strings, no credentials; original/final strings retain provenance. Source normalization and network safety are separate checks. Relative discovered links must be resolved before emission. |
| Hashes | Lowercase hexadecimal SHA-256 strings; evidence hashes cover exact bytes. Event fingerprints cover the canonical full envelope, not a normalized business view. |
| Absent/null | Required fields cannot be absent. Only explicitly nullable fields accept null. An optional field is omitted if unknown; an empty string is not a substitute for null. |
| Envelope extensions | Reject unknown envelope fields for schema v1; future extensions require an explicit compatible schema revision. Source `records` are validated by their own versioned schema and retained unchanged. |

The proposed event fingerprint is SHA-256 of the UTF-8 bytes of the full envelope serialized with [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785). Envelope fields are not excluded; transport coordinates and SQL ingestion timestamps live outside it. Preserve array order and Unicode strings. Reject duplicate object keys, invalid Unicode and non-finite values before fingerprinting. Source values requiring decimal/integer precision beyond JSON's supported numeric model must use approved string representations. Retain original input independently; canonical hashing does not authorise business coercion.

### Actor and dataset messages

All objects require `schema_version`. All named arrays/strings carry finite D-07 bounds.

| Contract | Required fields and meaning | Optional / nullable fields; cardinality |
|---|---|---|
| `DiscoveryInput` | `discovery_run_id`, `dispatch_id`, `discovery_source_id`, `request_context_id`, `profile_version`, `config_version`, `normalization_version`, `seeds[]`, `approved_target_rules[]`, `limits` | Seeds nonempty; rules map candidates to enabled approved target sources. Strategy/continuation only when configured. `limits` explicitly bounds requests/depth/redirects/pages/candidates/bytes/runtime/retries/rate. |
| `DiscoveryCandidate` | `discovery_run_id`, `discovery_source_id`, `target_source_id`, `request_context_id`, `discovered_url`, `canonical_url`, `normalization_version`, `found_on_url`, `page_type`, `discovered_at`, `discovery_method`, `config_version` | Candidate dataset contains candidates only. Zero candidates is valid. An unresolved target owner is rejected/held rather than inventing a target_source_id. |
| `DiscoveryCoverage` | `discovery_run_id`, `dispatch_id`, `scope_version`, `config_version`, `partitions[]` with seed/partition ID + state/counts/errors, aggregate raw/accepted/duplicate/rejected counts, `coverage_state`, `stop_reason` | `continuation` optional and versioned. States `complete/partial/failed`; a cancelled run is partial with cancellation stop reason. Coverage is a separate run-keyed record in known Apify storage, not a candidate row. Missing manifest after crash means unverified coverage. |
| `WorkManifest` | `run_id`, `dispatch_id`, `actor_type`, `source_id`, `request_context_id`, `profile_version`, `config_version`, `actor_build_id`, `assignments[]`, manifest fingerprint | An extraction assignment requires `{attempt_id, url_id, canonical_url, lease_generation}`. All assignments belong to the declared source/context and are unique by attempt_id. Discovery intent references its DiscoveryInput instead. Once committed the manifest is immutable. |
| `ExtractionInput` | `WorkManifest` fields plus `parser_version`, `normalization_version`, `limits`, approved evidence policy reference | Bounded assignments; empty extraction batch is rejected before launch. Large-manifest transport is deferred until measured; no unbounded dataset-reference mechanism added initially. |
| `ExtractionEvent` | `event_id`, `run_id`, `dispatch_id`, `attempt_id`, `lease_generation`, `url_id`, `source_id`, `request_context_id`, `apify_run_id`, `actor_build_id`, `requested_url`, `final_url`, `redirect_history[]`, `observed_at`, `outcome`, `http_status`, `schema_version`, `parser_version`, `profile_version`, `config_version`, `normalization_version`, `records[]`, `errors[]`, `evidence_refs[]` | `final_url` nullable if no resolved response; `http_status` nullable if no HTTP response. Success requires approved semantic invariants and permitted cardinality; failures have no usable business records. `errors[]` empty on success; failure reasons bounded and structured. Evidence list may be empty only when policy permits. |
| `EvidenceReference` | approved storage provider/location ID + immutable object key, exact-byte SHA-256, byte length, content type, capture time, evidence kind, retention class/policy revision | No embedded credentials, signed access tokens, arbitrary fetch URL or public-read assumption. `request_context_id`/event association retained; references allow later durable-copy metadata outside immutable envelope. |
| `ExecutionSummary` | `apify_run_id`, `dispatch_id`, assigned/processed/emitted counts, emitted attempt IDs, stop reason and version | Optional as a whole because a killed Actor cannot guarantee it. Missing summary never authorises manufactured observations or proof of complete import. |

### Outcome, authority and import rules

Proposed envelope outcomes: `success`, `not_found`, `blocked`, `parse_error`, `schema_invalid`, `http_error`, `network_error`, `timeout`, `cancelled`. Structured reasons provide source-specific detail. Retryability is a scheduler policy, not an untrusted Actor instruction. HTTP status by itself does not select success. `cancelled` is emitted only for actually processed work with known cancellation; unstarted work has no observation envelope.

The first valid event committed while matching the assigned manifest and current `(attempt_id, lease_generation)` becomes the attempt's authoritative terminal event. Accept at most one. Other valid events can remain immutable historical evidence, classified as non-authoritative; they cannot clear a new lease or move freshness backwards. Same `event_id` + same fingerprint is replay; same ID + conflicting fingerprint is quarantined as a contract error. A new scheduled capture always has a new attempt/event even when field values match. This deterministic commit rule needs D-03 approval.

Transport coordinates are `(dataset_id, next_raw_offset)` and actual row positions. A position is not an observation's business identity. Reader 012 supplies a transaction-scoped operation; consumers 008/013 commit domain changes, replay/conflict disposition or durable quarantine, and next raw offset atomically. Quarantine includes raw item/reference, dataset/run/offset, reason codes and validator version. No page is silently dropped because validation failed.

Exact state-transition contracts are owned jointly by 007/009/011/014: URL lifecycle `active/paused/retired`; dispatch `pending/submitting/dispatch_unknown/bound`; provider execution state separate; ingestion state separate. Unknown launch, missing result and superseded assignment are operational states, not fabricated HTTP observations.

## Inputs and outputs

Inputs: untrusted JSON Actor inputs, candidate/coverage objects and extraction envelopes. Outputs: unchanged validated typed object OR structured validation reasons and original raw transport identity for quarantine. Validation itself performs no network or SQL writes.

## Dependencies and entry gate

Direct prerequisites: [SPEC-001](SPEC-001-repository.md).
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is strict schema, type, version and fingerprint behavior against approved golden producer/consumer fixtures at CP1. Actual downstream SQL/Actor compatibility in CP2/CP3 is a follow-through obligation of those consuming specs, not a prerequisite for verifying this package.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-002-AC-01 | Every golden input/output validates, while missing IDs, unsupported versions, invalid UTC timestamps, unknown outcomes, malformed URLs and over-limit values are rejected with safe field-path reasons. | FR-01, FR-02, NFR-01, NFR-02, NFR-03 | Golden and one-invalid-dimension fixture matrix, including null versus absent. | CP1: every producer/consumer uses the same schema revision and fixtures. |
| SPEC-002-AC-02 | One assignment can validly produce zero/one/many source-approved records, while a required-field failure or wrong page/context cannot validate as usable success. | FR-02, FR-05 | Approved source schema vectors, zero vs unavailable, blocked HTTP200. | CP1/CP2: adapter and importer fixture compatibility. |
| SPEC-002-AC-03 | Reordered object keys in the same envelope yield the same approved content fingerprint; conflicting data under one event ID is flagged; a refetch with identical fields has a distinct event ID. | FR-04 | Canonical fingerprint vectors, arrays/order, Unicode and numeric edge cases. | CP3: SQL replay and conflict behavior matches contract. |
| SPEC-002-AC-04 | A page-limited discovery run validates only as partial coverage; missing partition results cannot be represented as complete, and source provenance remains distinct from target source ownership. | FR-03 | Complete/partial/failed/cancelled coverage fixtures. | CP2/CP4: Discovery Actor output passes importer contract. |

## Unit and integration test requirements

TDD first meaningful case: reject an envelope missing attempt_id despite containing business fields. Cover strict type/null/absence, ID precision, timestamp, URL, enum and boundary sizes. Check compatibility across golden fixtures and canonical content fingerprints.

Contract tests consume representative outputs from 003/006 and inputs to 008/013 when available. Those tests are CP2/CP3 follow-through, not extra implementation prerequisites for defining the package. No mock-only result is described as live integration.

Use [test-strategy](../standards/test-strategy.md); commands are established by 001 and actual results recorded later. All checks in this draft are planned, not executed.

## Error handling and recovery

Malformed/unsupported boundary input: reject before side effects; ingestion retains raw input in quarantine before offset advancement. Conflicting event ID: contract violation, never overwrite. No HTTP response: http_status is null with a network outcome, not fabricated 200/500. Unknown fields follow the explicit schema policy and cannot be stripped silently.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Open: D-01, D-02, D-03, D-05, D-06, D-09; G0. The register identifies the information needed and the authority. Contract changes update affected dependents before implementation.

- [ ] All common contracts, source field definitions, limits, canonical fingerprint and authority rules resolved/approved; golden normal/failure fixtures pass; producer/consumer ownership documented; CP1 evidence and later compatibility follow-through linked.
- [ ] All FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [ ] Required real-boundary checks pass; skipped, blocked or failing required checks remain unverified.
- [ ] Shared contracts, security, failure recovery and relevant integration checkpoint reviewed.
- [ ] No unapproved infrastructure or deviations; implementation/test reports and any accepted ADRs linked.
- [ ] Verification recorded separately from acceptance; current state remains draft until actual gates pass.

Completion record: report none; tested revision none; reviewer/date pending; acceptance pending.
Change history: v0.1 initial source-traced draft, 18 October 2026.

