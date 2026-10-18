# SPEC-002 - Versioned boundary contracts and work identities

Status: **verified for approved offline scope; awaiting user review**. Version 0.2. Updated 18 October 2026.
Owner: Codex. Reviewer/acceptance authority: user.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §3-6; R: Change the extraction contract to identify work, observations and delivery separately.; R: Separate URL lifecycle, attempt outcome and execution status.
Scoped approvals: shared contracts with synthetic fixtures, strict Ajv, separated identities and RFC 8785 fingerprints, finite offline limits. Real-source D-02/D-05/D-06/D-09 decisions remain downstream gates; see [approval register](../architecture/approval-register.md) and [ADR-0002](../architecture/decisions/ADR-0002-shared-contracts.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: [REPORT-20261018-02](../../reports/implementation/SPEC-002/REPORT-20261018-02.md) / [RUN-20261018-02](../../reports/tests/SPEC-002/RUN-20261018-02.md). Branch: `feat/spec-002-contracts`, from merged SPEC-001 on `dev` at `f5b7cf1`. User approved this scoped implementation on 2026-10-18. The user subsequently saved the in-progress commit `fd6139b`; Codex has not committed, pushed or merged the completion changes.

## Objective and scope

Define and validate compatible data boundaries before producers, SQL adapters and consumers are implemented.

Actor inputs, discovery candidates/coverage, immutable work manifest, extraction outcomes, evidence references and pure replay classification. Ingestion transactions and state transitions remain in their owning SQL/service specs. Excludes business cleansing, entity matching, HTTP customer APIs and a generic schema registry.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-002-FR-01 | Publish strict versioned JSON Schema contracts and compatible typed representations from one package; validate Actor inputs/outputs and importer input without coercing, defaulting or deleting evidence fields. | M §3, §5; R: implementation approach |
| SPEC-002-FR-02 | Distinguish URL/context identity, logical batch/dispatch/attempt ownership, physical execution and emitted event identity; define success/failure envelopes separately from 0/1/many business records. | R: Change the extraction contract |
| SPEC-002-FR-03 | Require discovery provenance and a coverage manifest with scope/configuration versions, partition/seed accounting, counts, stop reason and optional continuation. | R: Stage 1 needs explicit coverage and URL-identity rules. |
| SPEC-002-FR-04 | Define the producer obligation to retain event IDs on redelivery and allocate new IDs on genuine refetch; classify full-envelope replay versus conflicting ID content and define per-attempt authority/null semantics. Package tests use supplied identities; producer allocation/lifecycle is verified in SPEC-006 and SQL authority in SPEC-013. | R: Change the extraction contract; D-03; approved v0.2 boundary |
| SPEC-002-FR-05 | Require a caller-supplied trusted profile with a record schema, allowed cardinality, source/context/page type and exact versions before success is usable. Demonstrate missing-field, page/context and zero/false/null behaviour with an explicitly synthetic profile. Real page-content checks and business fields belong to SPEC-005/006 and D-02, not these fixtures. | User-approved v0.2 scope; M §5; R: usable extraction |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-002-NFR-01 | Every message carries its supported schema/configuration version and required correlation; unsupported versions are rejected or quarantined, never silently reinterpreted. | M §5; R: contracts; AC matrix below |
| SPEC-002-NFR-02 | All IDs, UTC timestamps, URLs, JSON depth/byte/record counts and enum values have explicit validation; missing numeric limits block readiness rather than create unlimited defaults. | D-03, D-07; AC matrix below |
| SPEC-002-NFR-03 | Envelope validation leaves raw business strings and numbers unchanged; error diagnostics use field paths and reason codes without sensitive values. | R: evidence; M §7; AC matrix below |

## Technical design and boundaries

Own these contracts in `packages/contracts`. Producers and consumers import the same revision and golden synthetic examples. Incompatible meaning changes increment schema_version and coordinate all consumers; changes to normalization/context identity require an explicit migration decision. The v0.2 refinements below supersede proposed v0.1 details where stated. Real-source readiness is not inferred from offline fixtures.

### Approved v0.2 implementation plan and acceptance tests

1. Publish draft-07 schemas with TypeScript types inferred from the same definitions. Implement strict Ajv validation, bounded JSON parsing and safe diagnostics; no remote schema loading or value mutation.
2. Test missing attempt identity first, then every golden contract plus invalid shape/version/ID/date/URL/null/limit cases. Preserve business values and reject unknown envelope fields.
3. Validate extraction events against a trusted manifest, physical execution and approved profile, including outcome/cardinality/context invariants. Test zero/one/many records, failure HTTP 200, and forged assignment/profile/page/context.
4. Canonicalize and fingerprint complete events; test RFC 8785 vectors, exact replay/conflict, array order, invalid Unicode, duplicate raw JSON keys and fresh UUID identity supplied by a producer.
5. Validate discovery accounting against the declared seed partitions; test complete/partial/failed/cancelled coverage, count equations, missing/duplicate partitions and distinct discovery/target ownership.
6. Run harness, unit, contract, lint and type checks, a clean locked install and a native workspace-import smoke check. Record red/green evidence and CP1 package compatibility; leave real producer/SQL compatibility to CP2/CP3. Prepare a review report and stop before the next spec.

Owned implementation: `packages/contracts`, `tests/contracts`, `tests/unit`, relevant root scripts/lockfile and SPEC-002 documentation/reports. No Actor, crawler, SQL, storage service or real-source code.

Offline contract ceilings: 1,048,576 UTF-8 bytes; depth 32 (root container depth 1); 10,000 object members across the message; strings at most 8,192 UTF-16 code units unless a tighter field bound applies; identifiers 128, URLs 2,048, error reasons 256; errors 25, seeds/partitions 10, assignments/records 100, redirects/evidence references 10. Numeric runtime limits are positive bounded integers (depth/retries/redirects may be zero); the offline schema ceiling is 1,000,000, not permission for a live run. Real runtime budgets still require D-07.

V0.2 wire refinements: `DiscoveryInput.seeds` contains `{partition_id,url}` and includes `scope_version`; target rules contain `{target_source_id, hostname, page_type}`. Coverage counts satisfy `raw = accepted + duplicate + rejected` per partition and in aggregate. Complete means all expected partitions completed with `stop_reason=finished`, empty errors and no continuation. Limited/cancelled coverage is partial; failed means every partition failed. A failed partition has a reason. A continuation is a bounded `{version,token}` object and is not interpreted here.

`WorkManifest` and `ExtractionInput` share one immutable extraction-launch schema, including parser/normalization versions, limits and evidence policy reference. Its `manifest_fingerprint` hashes every field except that digest itself, avoiding a circular digest or unhashed launch settings. `actor_type` is `extraction`. Assignments are unique by attempt and URL/context within the batch. The event additionally carries `page_type`, checked against the trusted profile; actual HTML identity remains SPEC-005's responsibility. Event fingerprints exclude nothing and live outside events.

Evidence references use a caller-approved location ID, policy revision and retention class, plus opaque immutable object key, exact-byte checksum, byte length, content type, timestamp, kind and context. The trusted profile supplies allowed locations and whether evidence is mandatory; no location is built in. Keys cannot be URLs, paths with traversal, credentials or query/fragment access tokens. No storage existence/durability is claimed. Execution summaries correlate to a manifest and execution and cannot claim more emitted/processed work than assigned.

UTC timestamps accept real dates in years 0001–9999, whole seconds or 1–3 fractional digits, ending `Z`; leap seconds are rejected. UUIDs use canonical lowercase hyphenated representation, versions 1–8 and RFC variant. URLs retain the supplied string: syntax validation does not canonicalize or prove network safety. SQL decimal strings are compared to signed BIGINT maximum without JavaScript numeric conversion.

Raw JSON parsing rejects duplicate decoded keys, comments, trailing commas, invalid Unicode, non-finite values and resource-limit violations before ordinary JSON parsing. Parsed-object APIs cannot recover duplicate keys already discarded upstream; callers needing that assurance use the raw-text API. Parsed values must be plain JSON data; no getters, cycles or non-JSON objects. Diagnostics contain only fixed reason codes and schema-known field paths (unknown business keys are redacted), at most 25 reasons; no rejected values.

The package supplies pure event fingerprint/replay classification, not ID allocation, persistence, quarantine writes, ownership transitions or refetch detection. A producer must reuse its UUID for delivery retries and allocate a fresh UUID for a real refetch; SPEC-006 verifies that producer lifecycle. A caller must validate against the expected manifest/profile/execution before treating an event as usable; no generic registry service is introduced.

## Contract catalogue (approved v0.2 refinements above apply)

This catalogue resolves illustrative naming in M into common names. The approved v0.2 plan supplies finite offline bounds and a synthetic trusted profile. D-02 still supplies the real source's schema and D-07 its runtime budgets before real use. Executable schemas and inferred types live together in `packages/contracts/src/schemas.ts`.

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
Entry satisfied for v0.2 offline scope: SPEC-001 verified and merged by the user into dev; user approved starting SPEC-002 and all three scoped contract decisions. Real-source and external-service gates are explicitly deferred, not waived. See ADR-0002.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is strict schema, type, version and fingerprint behavior against approved golden producer/consumer fixtures at CP1. Actual downstream SQL/Actor compatibility in CP2/CP3 is a follow-through obligation of those consuming specs, not a prerequisite for verifying this package.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-002-AC-01 | Every golden input/output validates, while missing IDs, unsupported versions, invalid UTC timestamps, unknown outcomes, malformed URLs and over-limit values are rejected with safe field-path reasons. | FR-01, FR-02, NFR-01, NFR-02, NFR-03 | Golden and one-invalid-dimension fixture matrix, including null versus absent. | CP1: every producer/consumer uses the same schema revision and fixtures. |
| SPEC-002-AC-02 | With an explicit trusted synthetic profile, one assignment can produce zero/one/many permitted records; missing required fields, unregistered profiles, wrong declared page/context or assignment cannot validate as usable success. Actual page detection is verified by SPEC-005/006. | FR-02, FR-05 | Synthetic schema/cardinality vectors, zero/false/null, blocked HTTP200. | CP1: package fixture consumers; CP2: real adapter/importer compatibility remains downstream. |
| SPEC-002-AC-03 | Reordered object keys yield the same content fingerprint; conflicting content under one event ID is flagged; a supplied new event ID is classified as new even when business fields are identical. Producer refetch-ID allocation remains SPEC-006's obligation. | FR-04 | Canonical vectors, arrays/order, Unicode/numeric edge cases, replay/conflict/new identity fixtures. | CP3: SQL replay and conflict behavior matches contract. |
| SPEC-002-AC-04 | A page-limited discovery run validates only as partial coverage; missing partition results cannot be represented as complete, and source provenance remains distinct from target source ownership. | FR-03 | Complete/partial/failed/cancelled coverage fixtures. | CP2/CP4: Discovery Actor output passes importer contract. |

## Unit and integration test requirements

TDD first meaningful case: reject an envelope missing attempt_id despite containing business fields. Cover strict type/null/absence, ID precision, timestamp, URL, enum and boundary sizes. Check compatibility across golden fixtures and canonical content fingerprints.

Contract tests consume representative outputs from 003/006 and inputs to 008/013 when available. Those tests are CP2/CP3 follow-through, not extra implementation prerequisites for defining the package. No mock-only result is described as live integration.

Actual commands and results are in RUN-20261018-02. Lint, types, 20 harness, 88 unit and 145 contract tests passed in both the working tree and an isolated locked-install copy. CP1 covers this shared package; physical Actor/SQL integration is not claimed.

## Error handling and recovery

Malformed/unsupported boundary input: reject before side effects; ingestion retains raw input in quarantine before offset advancement. Conflicting event ID: contract violation, never overwrite. No HTTP response: http_status is null with a network outcome, not fabricated 200/500. Unknown fields follow the explicit schema policy and cannot be stripped silently.

Validation has no retries or side effects. Real source profiles and runtime policies must be supplied by their owning specs before external use; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Scoped G0/D-01/D-03/D-07 approvals permit v0.2 offline implementation. Real D-02/D-05/D-06/D-09 policies and D-03 persistence behaviour remain open downstream. The register records their authority. Contract changes update affected dependents before implementation.

- [x] Common contracts, synthetic profile boundary, finite offline limits and canonical fingerprint rules implemented; golden normal/failure fixtures pass; producer/consumer ownership and CP1 evidence recorded. Real source/SQL/Actor compatibility stays explicitly assigned downstream.
- [x] All scoped FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [x] Required own-boundary checks pass; external Actor/SQL checks are outside v0.2 and remain downstream, not claimed as passing.
- [x] Shared contracts, security, failure cases and CP1 package boundary reviewed; material findings have regression coverage.
- [x] No unapproved infrastructure or deviations; implementation/test reports and ADR linked.
- [x] Verification recorded separately from acceptance; user acceptance and publication of completion changes remain pending.

Completion record: REPORT-20261018-02; tested baseline `fd6139b` plus linked working-source manifest; Codex/18 October 2026; user acceptance pending.
Change history: v0.1 initial source-traced draft; v0.2 user-approved offline scope, explicit trusted profile and finite limits, then verification evidence; 18 October 2026.

