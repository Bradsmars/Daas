# SPEC-016 — Runtime configuration and target security

Status: **DRAFT — G0 and relevant open decisions block implementation.**

## Metadata

| Field | Value |
| --- | --- |
| ID / version / updated | SPEC-016 / 0.1 / 2026-10-18 |
| Owner / acceptance authority | Specification engineering / user or explicitly delegated reviewer |
| Priority / state | First-pipeline prerequisite / draft |
| Sources | [M §§2–3, 6–7](../architecture/master-architecture.md); [R: private SQL, SSRF, evidence and shared budgets](../architecture/architecture-review.md) |
| Decisions | G0; D-01, D-02, D-04–D-08 in the [approval register](../architecture/approval-register.md), relevant portions open |
| Plan / graph | [Implementation plan](../architecture/implementation-plan.md); [DAG](../architecture/dependency-graph.md), v0.1 |
| Implementation / test evidence | Not started / NOT RUN |

## Objective and scope

Provide validated runtime configuration and enforce approved outbound-target, credential and permission boundaries before crawling or dispatch. Protect the existing Crawlee/Apify/MSSQL design without provisioning new infrastructure.

In scope: typed configuration, secret references, source scope, outbound destination validation, evidence-reference safety and permission verification. Shared scheduling/site admission belongs to SPEC-009/014; evidence lifecycle belongs to SPEC-017. Authentication bypass, proxy evasion and a generalized policy platform are out of scope.

Source status: controls derive from M/R; the selected source, runtime secret mechanism, network path and numeric policies remain approval-gated.

## Functional requirements

| ID | Required behaviour | Trace | AC |
| --- | --- | --- | --- |
| SPEC-016-FR-01 | Validate required runtime and source configuration before claiming, dispatching or fetching; reject missing, malformed, incompatible or unbounded required settings with safe field-level errors. | M §7; D-04/D-07 | AC-01 |
| SPEC-016-FR-02 | Resolve credentials only through the approved existing runtime mechanism; keep SQL credentials private to the integration service and prevent secret exposure in Actor inputs, diagnostics, fixtures and reports. | M §§6–7; R: private SQL | AC-02 |
| SPEC-016-FR-03 | Enforce approved HTTP(S) host/path/port rules, reject embedded credentials and disallowed destinations, and preserve the source's URL/context semantics rather than silently rewriting identity. | M §3; R: SSRF and identity | AC-03 |
| SPEC-016-FR-04 | Validate resolved network destinations and every redirect; prevent resolution/connection changes from reaching loopback, private, link-local or metadata-service destinations. Bound redirects and response sizes. | M §§3, 7; R: SSRF | AC-04 |
| SPEC-016-FR-05 | When browser rendering is approved, apply the destination policy to navigations and outbound subresource requests, including requests initiated by scripts; reject an execution mode whose egress cannot enforce the policy. | R: SSRF beyond initial URL | AC-05 |
| SPEC-016-FR-06 | Accept evidence references only within approved storage locations and ownership scope; reject arbitrary local paths, unsupported schemes and references outside approved containers/key prefixes. | R: evidence references | AC-06 |
| SPEC-016-FR-07 | Define least-privilege configuration/role boundaries: Actors receive no SQL access; application roles have no Bronze update/delete or administrative authority. Require parameterized SQL adapters; SPEC-007 verifies actual grants on MSSQL. | M §§6–7; R: private credentials | AC-07 |
| SPEC-016-FR-08 | Expose validated finite limits and source/rate-group identity to consumers; reject inconsistent retry/session/restart budgets and missing required evidence/retention settings. | R: rate limits and retention; D-06/D-07 | AC-01, AC-08 |

## Non-functional requirements

| ID | Constraint and verification | Trace | AC |
| --- | --- | --- | --- |
| SPEC-016-NFR-01 | Invalid configuration or policy denial causes no target request or new work claim; denied egress is observable with sanitized reason and correlation identifiers. | M §7 | AC-01, AC-03, AC-04 |
| SPEC-016-NFR-02 | The same policy semantics apply at intake, dispatch and fetch; source-aware identity remains owned by SPEC-004, avoiding divergent normalization rules. | M §§3–5; R: shared library | AC-03, AC-08 |
| SPEC-016-NFR-03 | Reuse approved platform/network/secret facilities; introducing a new store, proxy, network service or secret manager requires an accepted ADR. | User constraint; D-04/D-06 | AC-02, AC-07 |

## Technical design and boundaries

- Own configuration and destination-policy interfaces in planned `packages/shared`; consume versioned contract definitions from SPEC-002. Consumers inject their network and secret adapters for testability.
- Separate syntactic URL/context validation from destination authorization. Validate parsing, source scope and resolved addresses; bind that decision to the actual connection or an approved enforcing egress boundary so a later DNS answer cannot bypass it.
- Revalidate each redirect target and browser outbound request. Never trust a permitted initial URL to authorize subsequent destinations. HTTP/browser/proxy combinations must demonstrate the same restrictions before use.
- Production crawling blocks local/private/metadata destinations, including relevant IPv4/IPv6 representations. Controlled local fixtures use an isolated test configuration; it cannot be selected accidentally by a live environment.
- Public cloud proxy/resolver behaviour is not assumed to provide SSRF protection. If the chosen runtime cannot verify/enforce destination restrictions, document the gap and block that mode until an approved solution exists.
- Required numeric limits come from D-07, not guessed defaults. Validate units, positive time/size bounds, non-negative retry/session/restart counts and compatible deadlines; configuration version/hash accompanies runs without secret values. The plan's P-TEST values remain proposals until approved.
- Keep role creation/migration declarations with SPEC-007. This spec defines configuration/access expectations and proves allowed/denied operations; it does not provision an environment.

## Inputs and outputs

| Direction | Contract and invariants | Owner |
| --- | --- | --- |
| Input | Versioned non-secret runtime/source profile, approved hosts/paths/ports/context, finite limits and environment designation | SPEC-002; D-02/D-04/D-05/D-07 |
| Input | Secret identifiers, runtime role, resolver/connection metadata and approved evidence-location policy | D-04/D-06/D-08 |
| Output | Validated immutable settings/policy decision or typed configuration/policy error; no raw secret values | Consuming Actors/integration modules |
| Output | Sanitized audit context and permission-verification evidence; rejected requests produce no fetch | Reporting standard |

## Dependencies and entry gate

Direct prerequisite: **SPEC-002**, verified contract version and validation conventions. G0 and relevant D-01/D-02/D-04/D-05/D-06/D-07/D-08 portions must resolve before this spec becomes `ready`. No database or browser mode is assumed merely from this dependency.

Configuration/policy implementation can proceed alongside SPEC-004/005/007 after contracts stabilize. This spec verifies its policy interfaces at CP2; real SQL grant checks belong to SPEC-007/CP3 and live Actor/storage enforcement to their consuming specs at CP4. These later cross-component checks do not introduce a hidden predecessor for SPEC-016. Browser checks are reviewed `NOT APPLICABLE` only when browser fetching is excluded from the slice.

## Acceptance criteria and traceability

IDs below have the full prefix `SPEC-016-`.

| ID | Given / when / then pass condition | Requirements | Verification |
| --- | --- | --- | --- |
| SPEC-016-AC-01 | Given absent secrets, invalid types, incompatible deadlines or unset required limits, validation fails before any claim/launch/fetch and identifies only safe configuration fields. | FR-01, FR-08, NFR-01 | Table-driven unit tests with side-effect spies; CP2 |
| SPEC-016-AC-02 | Given canary credentials, approved loading succeeds, Actor configuration receives no SQL credentials, and captured diagnostics contain no canary value; only approved facilities are used. | FR-02, NFR-03 | Secret-adapter fixture, approved mechanism loading and sanitized-output inspection; CP2 |
| SPEC-016-AC-03 | Given approved and disallowed URL cases, host/path/port/scheme/userinfo decisions match source policy at intake/fetch without changing meaningful URL/context identity. | FR-03, NFR-01, NFR-02 | Shared fixture corpus and policy-consumer contract checks; CP2 |
| SPEC-016-AC-04 | Given public-to-private redirects, mixed DNS results, changed resolution and restricted IPv4/IPv6 destinations, the transport policy prevents disallowed connection attempts and bounds redirects/sizes. | FR-04, NFR-01 | Controlled resolver/transport tests and enforcing-adapter integration; CP2; live consumer evidence at CP4 |
| SPEC-016-AC-05 | Given approved browser-mode request fixtures, forbidden subresources/script navigation are denied and unenforceable modes fail configuration. | FR-05 | Conditional browser interception integration, or reviewed exclusion; CP2; consuming Actor checked at CP4 |
| SPEC-016-AC-06 | Given valid evidence references and out-of-scope/escaped paths/hosts/prefixes, only approved owned locations pass policy and diagnostics reveal no credentials. | FR-06 | Storage-policy boundary fixtures; CP2; SPEC-017 checks actual provider retrieval |
| SPEC-016-AC-07 | Given proposed runtime-role configuration, review shows no SQL access for Actors or Bronze/admin mutation rights for the application; the SQL adapter interface binds values separately from query text. | FR-07, NFR-03 | Configuration/role-contract review and adapter-interface test; CP2; actual grants verified by SPEC-007 |
| SPEC-016-AC-08 | Given accepted consumer profiles, versions/rate groups/finite budgets remain consistent; invalid retry/session/restart combinations are rejected instead of silently widened. | FR-08, NFR-02 | Policy-consumer contract tests; CP2 |

## Tests, failures and recovery

First TDD red case: a disallowed resolved destination reaches the transport. Add meaningful boundary cases for URL parsing, DNS changes, redirects, configuration ranges, secret redaction and evidence ownership; avoid tests that merely mirror configuration declarations.

Policy-adapter integration must name the exercised runtime. Mocks establish decisions but do not prove Apify egress, storage access or SQL grants; consumers must supply those actual-boundary checks before CP4. Unavailable required checks yield `BLOCKED`; policy denial never retries through a weaker route. Secret/configuration failures stop new work until corrected; retained output remains available for authorized ingestion. Logs expose reason codes and safe correlations, never credentials or sensitive payloads.

Store actual evidence under `reports/tests/SPEC-016/` and implementation records under `reports/implementation/SPEC-016/`. **No security or application tests have been run for this draft.**

## Definition of Done

- [ ] Relevant decisions, runtime policy and finite limits are explicit; no unapproved infrastructure added.
- [ ] All FR/NFR/ACs have linked TDD, contract and applicable real-boundary evidence.
- [ ] CP2 policy/configuration boundaries pass; downstream actual SQL, Actor and storage verification obligations are explicit and do not masquerade as completed checks here.
- [ ] Browser applicability and any provider-network limitations are recorded honestly; no required check skipped or blocked.
- [ ] Sanitized reports, decisions, reviewer and acceptance records identify the tested revision.

Completion record: implementation, verification reviewer/date and acceptance authority/date **not started / pending**. Change history: **0.1, 2026-10-18 — initial source-traced draft for G0 review**.
