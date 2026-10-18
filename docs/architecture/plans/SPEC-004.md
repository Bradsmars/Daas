# SPEC-004 implementation and acceptance plan

Date: 18 October 2026. State: verified for scoped offline behavior; awaiting user review. Evidence: [implementation report](../../../reports/implementation/SPEC-004/REPORT-20261018-03.md) and [test record](../../../reports/tests/SPEC-004/RUN-20261018-03.md).
Branch: `feat/spec-004-url-normalization`, from `dev` `d98b69f522e8625bfe5c20bbcce9bc09ff5019e7`.
Scope: [SPEC-004 v0.2](../../micro-specs/SPEC-004-url-normalization.md), [ADR-0003](../decisions/ADR-0003-url-identity.md).

Implement one pure source/context policy normalizer in `packages/shared` and identity helpers using existing contract fingerprints. Only `preserve-v1` is supported: WHATWG parser equivalences apply, while path case, query pair bytes/order, fragments and trailing slash are preserved. Exact allowed origins and segment-aware path prefixes are supplied explicitly; there is no real source profile or generic rule language.

TDD sequence: variant values must remain distinct; equivalent/base/idempotence vectors; full input/policy validation and safe scope failures; exact UTF-8 identity tuple and collision classification; public-package contract compatibility. Tests cover IDN/IPv6/default ports/encoded dots, reserved escapes, bare query/fragment delimiters, duplicate/order-sensitive query keys, credentials/controls/backslashes/limits, version/context mismatch and source/context/version separation.

Ownership: root owns normalizer/schema/public exports/package metadata and spec/report updates; one collaborator may own pure identity helpers and their unit tests. Read-only review covers failure/encoding cases. No other spec is implemented in parallel.

Run `npm run check`, native Node 24 import and clean cached locked install/check. Map AC-01/02/03 to actual evidence, retain red/green logs and source manifest, then prepare for review into dev. Do not commit, push, merge, start SPEC-003/016 or deploy without the required user approval. Real-source rules, operational budgets, SQL and egress controls remain open.
