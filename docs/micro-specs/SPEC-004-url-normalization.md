# SPEC-004 - Source-aware URL normalization and request-context identity

Status: **verified for approved offline scope; awaiting user review**. Version 0.2. Updated 18 October 2026.
Owner: Codex. Reviewer/acceptance authority: user.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §3-4; R: Stage 1 needs explicit coverage and URL-identity rules.; R: Separate URL lifecycle, attempt outcome and execution status.
Scoped approvals: user authorised the next implementation and explicitly chose a shared module with synthetic fixtures. Real-source D-02/D-05 rules and SQL D-03 decisions remain open. See [ADR-0003](../architecture/decisions/ADR-0003-url-identity.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Plan: [SPEC-004 scoped implementation plan](../architecture/plans/SPEC-004.md). Evidence: [REPORT-20261018-03](../../reports/implementation/SPEC-004/REPORT-20261018-03.md) / [RUN-20261018-03](../../reports/tests/SPEC-004/RUN-20261018-03.md). Branch `feat/spec-004-url-normalization`, from `dev` at `d98b69f`. Changes are local; commit/push/merge and the next specification are not authorised.

## Objective and scope

Give discovery and ingestion the same deterministic fetch-target identity without merging distinct resources or contexts.

Pure normalization, validation result, context key and hash input construction. Excludes fetching, DNS enforcement (016), product/entity resolution, automatic redirect alias merging and database migrations.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-004-FR-01 | Resolve relative URLs only with an explicit validated base, accept HTTP(S) only, and preserve original URL alongside normalized output and normalization version. | M §3; R: URL identity |
| SPEC-004-FR-02 | Require a trusted, explicit source/context/version/scope policy. In v0.2 implement only the named `preserve-v1` mode: preserve query bytes/order/duplicates, routing fragments, trailing slash and path case after standard URL serialization. Real-source parameter removal, alternate slash/fragment rules and canonical/redirect alias mapping require later approved vectors/version/migration decisions; none is guessed here. | User-approved synthetic-first scope; R: request context; D-05 |
| SPEC-004-FR-03 | Produce identical canonical bytes/hash inputs for approved equivalent URLs and distinct identities for non-equivalent resources/contexts; normalization is idempotent. | M §4; R: URL identity |
| SPEC-004-FR-04 | Return structured invalid/out-of-scope/ambiguous reasons without network activity; hash matches never prove canonical URL equality. | M §4; R: SQL identity |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-004-NFR-01 | Deterministic under runtime locale/timezone and across repeated calls; no network, database or clock dependency. | engineering principles; AC matrix below |
| SPEC-004-NFR-02 | Every normalization change is versioned and requires a rekey/migration decision before existing identities are changed; no silent split/merge. | D-05; AC matrix below |
| SPEC-004-NFR-03 | URL and context maximum lengths and accepted encodings are explicit; ambiguity or unsafe input fails closed. | 002; D-05, D-07; AC matrix below |

## Technical design and boundaries

Own a pure `packages/shared` module. Use the selected runtime's standards-based URL parser plus the approved source rule set; do not lowercase the path or blindly drop/sort meaningful query entries. Include normalized source/context/version in a length-delimited or unambiguous canonical identity representation from 002, then hash with SHA-256 for index lookup. Preserve exact canonical comparison bytes for collision detection independently of SQL collation. Credentials in URLs are rejected. Store request context as an approved stable identifier with immutable versioned dimensions; a market/store/currency change may be a new context. Redirect/final URLs and canonical tags remain provenance unless explicitly mapped by an approved rule.

### Approved v0.2 scope and implementation plan

1. Publish a private `@daas/shared` source entry point with a trusted-policy factory. Policy fields are `source_id`, `request_context_id`, `normalization_version`, `mode=preserve-v1`, `allowed_origins[]`, `allowed_path_prefixes[]`; every field is required and unknown fields rejected. Configuration is snapshotted. No built-in live policy or registry exists.
2. Use failing tests first: distinct `?variant=A`/`?variant=B` must not collapse. Then cover equivalent host case/default ports/dot segments, relative/base handling, idempotence and immutable policy/unchanged input.
3. Require input `{url, request_context_id, normalization_version}` with optional `base_url`. Validate versions/context before use. Resolve with Node's WHATWG URL parser; retain its complete `href` so bare `?`/`#`, encoded reserved characters and ordered duplicate query pairs remain distinct. Do not use URLSearchParams mutation or decode/re-encode paths/queries. Query escapes are opaque bytes; percent triplets must be well formed. Standard IDNA/Unicode serialization and encoded dot-segment resolution are intentional parser equivalences.
4. Require canonical explicit HTTP(S) origins and literal canonical path prefixes with segment boundaries. A validated base need not share the target origin; the final resolved target must match the trusted target policy. Scope uses parsed serialized paths, not raw URL prefixes. This is syntactic scope only; DNS/connection/redirect/browser enforcement remains SPEC-016.
5. Return exact original input, canonical URL, source/context/version and lookup identity. Identity is UTF-8 of the fixed JSON string tuple `["daas-url-identity-v1",source_id,request_context_id,normalization_version,canonical_url]`. `identity_key` retains this exact string; SQL consumers use its UTF-8 bytes, not collation/text equality. Use SPEC-002's RFC 8785 fingerprint helper on the same tuple. No delimiter concatenation or business-entity matching.
6. Compare both digest and exact identity key. Equal digests with unequal keys report `hash_collision`; equal keys with unequal digests report inconsistent metadata. A test-constructed collision proves lookup safety without adding an injectable weak production hash or SQL logic.
7. Run all offline suites, lint/types, native Node import and clean locked-install checks. Record red/green evidence, exact vectors/bytes and downstream consumer obligations. Stop for user review.

Finite v0.2 bounds reuse SPEC-002: raw/base/canonical URLs and path prefixes at most 2,048 Unicode code points; source IDs positive decimal strings through SQL BIGINT max; context/version identifiers follow the shared 128-character identifier shape. At most 10 origins and 10 path prefixes. Identity keys at most 4,096 UTF-8 bytes. Input/config JSON also passes SPEC-002's 1 MiB/depth32/member10,000/8,192-UTF16 generic string guard. Empty URL references, malformed percent escapes, literal whitespace/C0/C1 controls, backslashes, non-HTTP(S), credential markers (even empty), absent/invalid bases and over-limit serialized URLs fail with fixed reasons and known field paths. No input trimming, raw-value diagnostics or retries.

Canonical hints/redirect overrides are not accepted as identity input fields; callers retain that provenance in their owning contracts. This prevents hints from changing identity through this API. The caller is responsible for immutable version registration and approval before using a real source; the module cannot prove approval or inspect an existing SQL inventory. Changing policy meaning under the same version is prohibited, not silently migrated.

## Inputs and outputs

Input: raw URL string, explicit optional base, target source rule version and request_context_id. Output: original_url, canonical_url, normalization_version, canonical identity bytes/hash OR typed rejection. Equivalent/inequivalent golden vectors are versioned fixtures; no side effects.

## Dependencies and entry gate

Direct prerequisites: [SPEC-002](SPEC-002-contracts.md).
Scoped entry satisfied: SPEC-002 passed its own CP1 checks and was merged into dev at `d98b69f`; user authorised the next implementation and approved source-independent synthetic fixtures. The v0.2 plan resolves common byte encoding and finite offline bounds while real-source/SQL decisions remain downstream. This does not approve a live crawl or a real normalization policy.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is the pure approved identity-vector suite and contract-byte compatibility at CP2. Real SQL collision/index and Actor/importer reuse checks belong to 007/008/015 and do not introduce a reverse dependency.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-004-AC-01 | Each approved synthetic equivalent vector normalizes identically and N(N(url)) = N(url); relative URLs without a valid base reject. Identity UTF-8 bytes and digest agree with SPEC-002's tuple fingerprint. | FR-01, FR-03, NFR-01 | Golden/property vectors across base resolution, Unicode and percent encoding. | Own pure/contract boundary; actual Actor/importer reuse remains CP2 follow-through. |
| SPEC-004-AC-02 | Under explicit `preserve-v1`, distinct query values/order/duplicates, path case/slash, fragments, source/context/version remain distinct; canonical/redirect override fields and unsupported modes reject rather than merge. | FR-02, NFR-02 | Synthetic variant/fragment/slash/context fixtures and immutable-policy checks. | Real-source policies and SQL byte/index compatibility remain later approved checks. |
| SPEC-004-AC-03 | Malformed, non-HTTP(S), credentialed and over-limit input returns a safe reason; test-supplied equal digest metadata with unequal identities returns explicit collision, never equality. | FR-04, NFR-03 | Malformed/injection/size vectors and exact-key collision classifier; no production weak-hash seam. | CP3: actual importer collision retention/transaction remains downstream. |

## Unit and integration test requirements

TDD first: meaningful variant query parameters do not collapse. Test IPv6/IDN, ports, host normalization, dot segments, reserved escapes, empty query values, duplicate query names, fragments, newline/control characters and source-rule version mismatch. Use the standard URL parser's defined semantics rather than inventing a parser.

No independent external-service integration required for the pure module. Consumer contract tests at CP2 compare 003 and 008 results; real SQL tests in 008 verify collision/case handling and identity uniqueness.

Actual evidence is in RUN-20261018-03. All 398 offline tests, lint and strict types pass in the working tree and a clean locked-install copy. Native package import/normalization/comparison agree across two timezones; locale-independent code paths were reviewed (Windows kept default locale en-GB despite differing LANG). This verifies the URL boundary's CP2 contribution, not the full multi-spec CP2 or live producer/SQL compatibility.

## Error handling and recovery

Unsupported policy versions/modes, unknown canonical/redirect override fields and invalid bases return explicit rejection, not best-effort mutation. The helper reports collisions; persistence/conflict retention is the importer's responsibility. Rule revision cannot rewrite inventory in place without an approved migration.

The module performs no side effects or retries. Invalid caller policy throws a fixed safe configuration error; invalid references return structured reasons. No rejected values are logged. Real-source policies remain readiness gates before live use.

## Decisions and Definition of Done

Scoped G0/D-03/D-05 and finite offline bounds are approved under ADR-0003. Real-source D-02/D-05, SQL D-03 and live D-07 decisions remain open. Contract changes update affected dependents and require version/migration review.

- [x] Scoped synthetic vector suite, idempotence/determinism/security edge cases pass; exact encoding agrees with SPEC-002 fingerprints and is prescribed for later SQL consumers. No fetch/entity behavior introduced.
- [x] All scoped FR/NFR/ACs have passing applicable evidence and meaningful red/green history.
- [x] Own real-library/runtime boundaries pass; later Actor/SQL checks remain explicitly unverified downstream.
- [x] Shared contracts, security and failure/encoding cases reviewed; URL portion of CP2 verified without claiming the full checkpoint.
- [x] No unapproved infrastructure or deviations; implementation/test reports and ADR linked.
- [x] Verification recorded separately from user acceptance and publication approval.

Completion record: REPORT-20261018-03; `d98b69f` plus linked 45-file working-source manifest; Codex/18 October 2026; user acceptance pending. No commit/push/merge or next-spec work performed.
Change history: v0.1 initial source-traced draft; v0.2 approved synthetic-first `preserve-v1` scope, exact bytes/finite policy and verification, 18 October 2026.

