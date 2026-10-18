# ADR-0004 - Controlled HTTP runtime security foundation

Status: accepted for SPEC-016's controlled-fixture implementation start.
Date: 18 October 2026. Authority: user; owner: Codex.
Spec: [SPEC-016 v0.2](../../micro-specs/SPEC-016-runtime-security.md). Plan: [implementation/acceptance](../plans/SPEC-016.md).
Branch: `feat/spec-016-runtime-security`, from dev `73d72716b1d2d26150884dbf31c78dce0a03b76f`.

The user requested SPEC-016, then approved HTTP-only controlled fixtures, environment-variable secret loading, explicit caller-supplied policies, rejection of browser/proxy modes and a trusted test-only loopback exception. The user separately approved fixture ceilings: 5 requests,10 candidates,depth1,concurrency1,1request/second,3redirects,1MiB wire/decoded bytes,20srequest/120srun,one retry,zero session rotations/restarts. These are ceilings for explicit values, not defaults or live-source approval.

Reuse SPEC-004 source/context identity, declaring its existing verified capability as an explicit prerequisite. Implement a small Node HTTP(S) enforcing client in the same shared package, not another service. Resolve/validate all answers, pin the literal connection IP, preserve Host/TLS hostname, isolate agents, manually validate redirects and stream-cap bytes/deadlines. Controlled actual HTTP/HTTPS servers complement pure denial tests; checking only an allowlisted hostname or mocks is insufficient. Use built-in IP/stream/crypto facilities rather than speculative infrastructure.

Loopback success requires trusted startup test environment plus an exact local fixture capability outside untrusted configuration. Public-only mode still denies loopback/private/metadata/reserved/transition destinations. Production startup and browser/proxy modes remain unsupported. No weaker fallback is permitted. Fixture TLS keys/certificates are generated temporarily with the existing OpenSSL executable; no private key or new service is committed/provisioned. Test setup must fail honestly if that tool is unavailable.

Environment references are role-specific and explicit. Do not load SQL credentials for Actors, copy process environment into Actor payloads or include values in config hashes/logs. Evidence policies validate descriptors, ownership and bounded retention only. Do not implement a fake database executor: actual grants/query binding/storage existence/hosted egress are later consumer checks.

Alternatives: unchecked DNS after preflight permits rebinding; pooled/global/proxy transports may connect outside the checked route; automatic redirects skip authorization. Browser interception and proxy-provider enforcement would widen the runtime surface before a source requires them. The selected narrow direct client supplies a testable enforcing boundary without new infrastructure.

Real D-02 source, D-04 hosting/production secret/network choices, D-05 site semantics, D-06 actual storage/retention, D-07 live budgets and D-08 SQL configuration/grants remain open. Node fixture verification does not prove Crawlee/Apify runtime integration; SPEC-003 must use and demonstrate the enforcing path, and unsupported hosted modes remain blocked before live fetching. No commit/push/merge/deployment/next-spec approval is included.

Primary references: [Node HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html), [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/), [IANA IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/). Conservative special-range denial may also exclude legitimate public special services; future changes require review and vectors.
