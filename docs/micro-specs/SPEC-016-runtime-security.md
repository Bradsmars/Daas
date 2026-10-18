# SPEC-016 — Runtime configuration and target security

Status: **verified for the approved controlled-fixture HTTP foundation; awaiting user review**. V0.2, 18 October 2026.

The user authorised SPEC-016 and approved both the HTTP-only fixture/environment-secret scope and finite test ceilings. [ADR-0004](../architecture/decisions/ADR-0004-controlled-http-security.md) and [the implementation plan](../architecture/plans/SPEC-016.md) govern this revision. Real-source approval, hosted Apify/Crawlee enforcement, storage guarantees and actual SQL grants/binding remain downstream checks; they are not inferred from local tests. Branch `feat/spec-016-runtime-security`, from clean dev `73d72716b1d2d26150884dbf31c78dce0a03b76f`. No commit/push/merge/next-spec approval.

## Metadata

| Field | Value |
| --- | --- |
| ID / version / updated | SPEC-016 / 0.2 / 2026-10-18 |
| Owner / acceptance authority | Specification engineering / user or explicitly delegated reviewer |
| Priority / state | First-pipeline prerequisite / approved controlled HTTP scope |
| Sources | [M §§2–3, 6–7](../architecture/master-architecture.md); [R: private SQL, SSRF, evidence and shared budgets](../architecture/architecture-review.md) |
| Decisions | G0; D-01, D-02, D-04–D-08 in the [approval register](../architecture/approval-register.md), relevant portions open |
| Plan / graph | [Implementation plan](../architecture/implementation-plan.md); [DAG](../architecture/dependency-graph.md), v0.3 |
| Implementation / test evidence | [REPORT-20261018-04](../../reports/implementation/SPEC-016/REPORT-20261018-04.md) / [RUN-20261018-04](../../reports/tests/SPEC-016/RUN-20261018-04.md); 795 tests pass, lint/types and fresh locked install/check pass |

## Objective and scope

Provide validated runtime configuration and enforce approved outbound-target, credential and permission boundaries before crawling or dispatch. Protect the existing Crawlee/Apify/MSSQL design without provisioning new infrastructure.

In scope: typed configuration, secret references, source scope, outbound destination validation, evidence-reference safety and permission verification. Shared scheduling/site admission belongs to SPEC-009/014; evidence lifecycle belongs to SPEC-017. Authentication bypass, proxy evasion and a generalized policy platform are out of scope.

Source status: controls derive from M/R. The user approved controlled HTTP fixtures, role-scoped environment-variable loading, explicit caller policies and test ceilings. Real-source/runtime/network/storage/SQL operating decisions remain approval-gated.

### Approved v0.2 scope and plan

1. Implement strict non-mutating runtime configuration and opaque validated sessions in `packages/shared`. Require source/context/version/scope, rate group, finite budgets, explicit evidence policy, role and secret references. Snapshots/fingerprints contain no secret values; role-scoped environment loading never exposes SQL secrets to Actors. Development/test environments are supported; production startup remains unsupported until its deployment/secret policies are approved. No environment file is loaded automatically.
2. Use SPEC-004 normalization at intake/fetch and add authorization without changing identity. Reject encoded path separators, percent nesting and controls that make literal scope ambiguous. Permit only direct GET over HTTP(S), with strict origin/port/path policy. Browser/proxy/unknown modes reject rather than bypass enforcement.
3. Validate all resolved addresses before any connection. Use Node IP parsing/BlockList, conservative IPv4 ordinary-unicast/IPv6 global-unicast policy with explicit IANA special/transition/metadata exclusions. Deny a whole DNS set if any answer is malformed/restricted, and bound answers to 16. Bind each actual Node connection to one validated literal IP, preserving original Host and TLS SNI/certificate hostname; isolate the agent from proxy/global pooling behavior.
4. Manually authorize/re-resolve every redirect. Bound the full operation, including DNS/connect/headers/body, using wall-clock cancellation plus shared run/request/rate budgets. Count redirects/retries against the same request ceiling; no automatic retries, session rotation or restarts are added. Stream-cap compressed wire and decompressed bytes; reject unknown encodings. Fixed 16 KiB response-header ceiling supplements explicit runtime byte caps.
5. Controlled local success requires both trusted environment `DAAS_ENV=test` and a separately supplied exact loopback/origin/port capability. An untrusted JSON flag cannot grant this exception. Test capabilities never authorize another private range or an unlisted origin/port. Actual local HTTP/HTTPS fixtures prove connection binding, TLS hostname checks, redirects, aborts and streaming limits; production/public-only policy denies the same loopback targets before connecting.
6. Validate evidence descriptors using SPEC-002 plus exact approved location/policy/context/retention/key-prefix ownership. No storage is provisioned/retrieved and no reference proves existence/durability. Validate declared role capabilities (Actors no SQL; integration no Bronze update/delete/admin). Actual grants and SQL parameter binding remain with first SQL adapters/007/008, rather than dummy SQL implementation here.
7. Record meaningful red/green tests, all relevant regressions, native package verification and clean locked install. Verify only this Node/config/policy boundary and stop for user review; no crawler/Actor work begins.

Controlled-test ceilings (explicit configuration values, no defaults): 5 total requests including redirect/retry attempts; 10 candidates; depth 1; concurrency 1; at least 1,000 ms between requests; at most 3 redirects; 1,048,576 bytes each on wire/decompressed response; 20,000 ms request, 120,000 ms run deadline; at most one local retry; zero session rotations/Actor restarts. DNS timeout must be positive and no greater than request timeout; request timeout must fit run timeout. Retry/redirect budgets must fit request count. Stricter test values are permitted; live-source budgets remain unapproved. Shared JSON/string/identifier limits still apply.

The public startup session keeps secrets in closures and exposes only role-authorized access; no secret values enter hashes, diagnostics or Actor-visible configuration. Evidence disabled in fixtures is explicit (`required=false`, zero retention, no locations); mandatory evidence requires a finite retention and at least one approved location. This declares policy only, not real provider access. No database, proxy, browser or production resources are created or contacted.

The original FR/AC statements below are interpreted at this explicitly approved local boundary. FR-05/AC-05 verify browser/proxy rejection, with no approved rendering mode. FR-07/AC-07 verify configuration/secret-role contracts only; actual grants and parameterized execution are downstream obligations. This v0.2 revision does not claim those real SQL/hosted checks passed.

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
- Required numeric limits come from D-07, not guessed defaults. Validate units, positive time/size bounds, non-negative retry/session/restart counts and compatible deadlines; configuration version/hash accompanies runs without secret values. ADR-0004 approves only the HTTP fixture subset; other P-TEST values remain proposals.
- Keep role creation/migration declarations with SPEC-007. This spec defines configuration/access expectations and proves allowed/denied operations; it does not provision an environment.

## Inputs and outputs

| Direction | Contract and invariants | Owner |
| --- | --- | --- |
| Input | Versioned non-secret runtime/source profile, approved hosts/paths/ports/context, finite limits and environment designation | SPEC-002; D-02/D-04/D-05/D-07 |
| Input | Secret identifiers, runtime role, resolver/connection metadata and approved evidence-location policy | D-04/D-06/D-08 |
| Output | Validated immutable settings/policy decision or typed configuration/policy error; no raw secret values | Consuming Actors/integration modules |
| Output | Sanitized audit context and permission-verification evidence; rejected requests produce no fetch | Reporting standard |

## Dependencies and entry gate

Direct prerequisites: **SPEC-002 and SPEC-004**, both verified and integrated into dev. The additional 004 edge records actual reuse of its normalizer; its gate is already satisfied. G0 and scoped D-04/D-05/D-06/D-07 portions are resolved by the user's fixture decisions/ADR-0004. Real-source, production and SQL/storage portions stay open. No database/browser mode is inferred from these dependencies.

SPEC-004 must pass before this implementation because the runtime reuses its exported normalizer. SPEC-005/007 remain independent candidates for separately approved work. This spec verifies its policy interfaces at CP2; real SQL grant checks belong to SPEC-007/CP3 and live Actor/storage enforcement to their consuming specs at CP4. These later cross-component checks do not introduce a hidden predecessor for SPEC-016. Browser checks are excluded from this HTTP slice; browser-mode rejection is required and verified here.

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

Actual commands and acceptance evidence are in [RUN-20261018-04](../../reports/tests/SPEC-016/RUN-20261018-04.md), with retained artifacts under `reports/artifacts/RUN-20261018-04/`. The enforcing Node adapter is verified against real local HTTP/HTTPS servers; hosted Apify, real SQL and evidence-provider checks have not run.

## Definition of Done

- [x] Relevant decisions, runtime policy and finite limits are explicit; no unapproved infrastructure added.
- [x] All scoped FR/NFR/ACs have linked TDD, contract and applicable real Node-boundary evidence.
- [x] Own CP2 policy/configuration boundaries pass; downstream actual SQL, Actor and storage verification obligations remain explicit.
- [x] Browser/proxy rejection and provider-network limitations are recorded; no required check within v0.2's approved boundary remains skipped or blocked.
- [x] Sanitized reports, decisions and verification records identify the tested snapshot.
- [ ] User acceptance and separate publication/merge/next-spec approvals.

Completion record: Codex implemented/verified on 2026-10-18, with independent read-only security review and final fresh-install verification. User acceptance remains pending. Change history: 0.1, 2026-10-18 — initial source-traced draft; 0.2, 2026-10-18 — user-approved controlled HTTP scope, explicit 004 prerequisite, implementation and linked verification. No subsequent specification has started.
