# SPEC-016 implementation and acceptance plan

Date: 18 October 2026. State: approved controlled-fixture plan executed and verified; user review pending. [Implementation report](../../../reports/implementation/SPEC-016/REPORT-20261018-04.md).
Branch: `feat/spec-016-runtime-security`, from dev `73d72716b1d2d26150884dbf31c78dce0a03b76f`.
Authority: [ADR-0004](../decisions/ADR-0004-controlled-http-security.md), [SPEC-016 v0.2](../../micro-specs/SPEC-016-runtime-security.md).

Root owns runtime configuration/session/role-secret/evidence modules, shared exports, scoped spec/reports and root verification scripts as needed. One collaborator owns IP/address policy and unit vectors; another owns the enforcing Node HTTP client and real HTTP/HTTPS fixture tests. A documentation collaborator may own authority/index updates. Shared APIs are agreed before independent code; no other specification is implemented in parallel.

TDD/acceptance sequence:

1. Configuration/secret boundary: invalid/missing limits/modes/env/role fail before work; source/rate-group/version and config fingerprints agree; canary values do not appear in diagnostics/public state; Actor startup cannot load SQL credentials. Evidence ownership/prefix/location/retention mismatches fail.
2. First transport red: public-only allowed hostname resolves to an actual loopback server; assert denial and zero hits, observing the unguarded request reach it before implementation.
3. Address vectors: every restricted/malformed/mixed answer denies; public IPv4/global IPv6 and exact test-only loopback cases; mapped/translated/transition/metadata/documentation ranges; family/answer bounds and no hidden relookup.
4. Actual Node HTTP/HTTPS fixture integration: connection pinning and original Host/SNI/certificate validation; test-only exact endpoint capability; redirects/private targets; header/body/wire/decompressed limits; hung DNS/connect/slow-body deadlines and aborts; request/rate/concurrency/run limits. Browser/proxy/fallback modes fail closed.
5. Full lint/types/offline unit+contract suites, native import, fresh cached locked install/check; exact source manifest, red/green logs, report/AC matrix and stated limits.

Fixture TLS uses existing OpenSSL only to generate short-lived local test keys/certificates; keys are not committed. Actual SQL grants/query binding, evidence provider access and hosted Crawlee/Apify enforcement stay downstream. Full CP2/pipeline correctness is not claimed by this component. Prepare review into dev, then stop for user approval before publication or another spec.
