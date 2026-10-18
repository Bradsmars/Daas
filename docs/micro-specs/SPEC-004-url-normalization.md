# SPEC-004 - Source-aware URL normalization and request-context identity

Status: **draft for review; implementation not started**. Version 0.1. Updated 18 October 2026.
Owner: unassigned. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §3-4; R: Stage 1 needs explicit coverage and URL-identity rules.; R: Separate URL lifecycle, attempt outcome and execution status.
Blocking approvals: [D-02, D-03, D-05; G0](../architecture/approval-register.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: not started / NOT RUN. Review recommendations remain proposed until G0 and relevant decisions are accepted.

## Objective and scope

Give discovery and ingestion the same deterministic fetch-target identity without merging distinct resources or contexts.

Pure normalization, validation result, context key and hash input construction. Excludes fetching, DNS enforcement (016), product/entity resolution, automatic redirect alias merging and database migrations.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-004-FR-01 | Resolve relative URLs only with an explicit validated base, accept HTTP(S) only, and preserve original URL alongside normalized output and normalization version. | M §3; R: URL identity |
| SPEC-004-FR-02 | Apply explicitly approved source rules for query parameters, routing fragments, trailing slash and canonical hints; preserve path case, meaningful variants and request context. | R: request context; D-05 |
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

## Inputs and outputs

Input: raw URL string, explicit optional base, target source rule version and request_context_id. Output: original_url, canonical_url, normalization_version, canonical identity bytes/hash OR typed rejection. Equivalent/inequivalent golden vectors are versioned fixtures; no side effects.

## Dependencies and entry gate

Direct prerequisites: [SPEC-002](SPEC-002-contracts.md).
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is the pure approved identity-vector suite and contract-byte compatibility at CP2. Real SQL collision/index and Actor/importer reuse checks belong to 007/008/015 and do not introduce a reverse dependency.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-004-AC-01 | Each approved equivalent vector normalizes identically and N(N(url)) = N(url); relative URLs without a valid base are rejected. | FR-01, FR-03, NFR-01 | Golden/property vectors across base resolution, Unicode and percent encoding. | CP2: Actor/importer use shared outputs byte-for-byte. |
| SPEC-004-AC-02 | Distinct product query values, path case and contexts remain distinct unless a specific approved rule says otherwise; canonical tags/fragments/redirects cannot silently merge identities. | FR-02, NFR-02 | Variant, repeated/order-sensitive query, fragment routing, slash and context fixtures. | CP2/CP3: SQL identities match exact vector bytes. |
| SPEC-004-AC-03 | Malformed, non-HTTP(S), credentialed and over-limit input returns a safe reason; a forced hash collision yields explicit unequal-canonical handling, never equality. | FR-04, NFR-03 | Malformed/injection/size vectors plus forced hash function seam. | CP3: discovery importer collision case retains both evidence and existing row without merge. |

## Unit and integration test requirements

TDD first: meaningful variant query parameters do not collapse. Test IPv6/IDN, ports, host normalization, dot segments, reserved escapes, empty query values, duplicate query names, fragments, newline/control characters and source-rule version mismatch. Use the standard URL parser's defined semantics rather than inventing a parser.

No independent external-service integration required for the pure module. Consumer contract tests at CP2 compare 003 and 008 results; real SQL tests in 008 verify collision/case handling and identity uniqueness.

Use [test-strategy](../standards/test-strategy.md); commands are established by 001 and actual results recorded later. All checks in this draft are planned, not executed.

## Error handling and recovery

Unsupported rule version, ambiguous canonical hint or invalid base returns explicit rejection, not best-effort mutation. Hash collision creates a reviewable conflict in the importer; no overwrite or automatic merge. Rule revision cannot rewrite inventory in place without an approved migration.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Open: D-02, D-03, D-05; G0. The register identifies the information needed and the authority. Contract changes update affected dependents before implementation.

- [ ] Approved vector suite complete; idempotence/determinism/security edge cases pass; exact identity encoding agreed with 002/007; no fetch or entity matching behavior introduced.
- [ ] All FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [ ] Required real-boundary checks pass; skipped, blocked or failing required checks remain unverified.
- [ ] Shared contracts, security, failure recovery and relevant integration checkpoint reviewed.
- [ ] No unapproved infrastructure or deviations; implementation/test reports and any accepted ADRs linked.
- [ ] Verification recorded separately from acceptance; current state remains draft until actual gates pass.

Completion record: report none; tested revision none; reviewer/date pending; acceptance pending.
Change history: v0.1 initial source-traced draft, 18 October 2026.

