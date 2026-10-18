# SPEC-002 — Shared-contract implementation and acceptance plan

Date: 2026-10-18. State: **implementation verified; awaiting user review**. Actual evidence: [implementation report](../../../reports/implementation/SPEC-002/REPORT-20261018-02.md) and [test record](../../../reports/tests/SPEC-002/RUN-20261018-02.md).
Scope authority: [ADR-0002](../decisions/ADR-0002-shared-contracts.md) and [approval register v0.3](../approval-register.md).
Work item: [SPEC-002](../../micro-specs/SPEC-002-contracts.md).
Branch: `feat/spec-002-contracts` from verified foundation `dev` at `f5b7cf1`.

## Implementation sequence

1. Confirm SPEC-001's verified package/test boundary and the scoped readiness record. Keep application, SQL and external-service work outside this branch.
2. Define common scalar/message schemas and matching TypeScript representations in `packages/contracts`; add strict, non-mutating Ajv boundary validation with a pinned compatible package version.
3. Use `spec-002-offline-v1`: 1 MiB UTF-8, depth 32, 10,000 object members (not array elements), generic strings 8,192 UTF-16 units, identifier/version 128, URL 2,048, 25 errors/reason 256, seeds/partitions/redirects/evidence references 10, assignments/records 100. Tighter Ajv field lengths count code points; root-container depth is 1. Runtime-limit schema integers are bounded by 1,000,000; only depth/retries/redirects may be zero. Enforce finite raw-input/parsed-object resource checks.
4. Implement pure canonical fingerprints and manifest digests. Full event envelopes have no excluded fields; `WorkManifest` and `ExtractionInput` share the complete immutable extraction-launch schema, with `manifest_fingerprint` excluding only itself and including parser/normalization versions, limits and evidence policy.
5. Require caller-supplied trusted profile, manifest and physical-execution context for source-dependent success/schema/cardinality and assignment checks. Page type is declared in the event and checked against the separate trusted profile. Use explicitly synthetic positive/negative fixtures; do not parse HTML, introduce a registry service or select a real source.
6. Write and observe meaningful failing tests for each behaviour before the minimal implementation; retain the corresponding green results. Refactor only with the relevant checks passing.
7. Verify package exports through the public validation/digest APIs and run relevant repository lint/type/harness checks. Record exact commands, dependency versions, red/green output and the tested working-tree/revision identity honestly.

The package implementation and tests may have separate file owners, but schema names, profile interface and hashing rules need one shared contract owner. No second specification starts in parallel. Root owns the SPEC-002 document update; this plan does not claim it is implemented.

## Acceptance evidence

| SPEC-002 criterion | Required own-boundary evidence |
|---|---|
| AC-01 | Golden inputs/outputs validate; missing IDs, invalid full-range decimal/UUID IDs, UTC/date errors, versions, unknown fields/outcomes and each size boundary reject with safe field-path reasons; original input remains unchanged. |
| AC-02 | Explicit trusted synthetic profiles accept allowed zero/one/many records and valid zero/false/null semantics; required-field, context/version/cardinality mismatch and untrusted self-declared profiles cannot validate as usable success. Real-source parser validity remains SPEC-005 work. |
| AC-03 | Approved canonical vectors cover reordered object keys, array ordering, Unicode and numeric restrictions; replay/conflict classification preserves full event content. Changing any immutable manifest field, including parser/normalization/limits/evidence policy, fails digest verification. |
| AC-04 | Complete/partial/failed/cancelled coverage fixtures account for partitions and bounded counts; limit-hit or missing-partition output cannot claim complete; discovery provenance remains distinct from target ownership. |

Tests must include malformed/duplicate-decoded-key/raw oversized/deep JSON, object-member limits, generic UTF-16 versus field-code-point limits, resource-limit-plus-one cases, valid extreme BIGINT strings and invalid precision-losing numeric forms. Parsed-object input rejects getters/cycles/non-JSON values; raw-input tests cover duplicate keys that parsed objects cannot recover. Error output contains bounded fixed reason codes and schema-known/redacted field paths, without business values or secrets. These are offline tests, not permission to request the example URLs.

## Completion and review

Before marking verified, all own ACs, non-mutation/security checks and relevant foundation checks must have actual passing evidence. Keep unavailable or absent domain/live checks explicitly unverified; do not claim physical producer/consumer or SQL integration. Contract fixtures allow later consumers to implement against one reviewed revision without creating backward verification dependencies.

Document implementation, requirement/AC traceability, red/green results, dependency pins, limitations and later compatibility follow-through under `reports/implementation/SPEC-002/` and `reports/tests/SPEC-002/`. Report whether code and tests are local/uncommitted; do not invent a commit identifier.

Stop with reviewable local changes and a concise result. SPEC-002 commit/push/merge and the next specification need approval. Real source, normalization policy, evidence storage/retention, operational budgets, SQL/control changes and deployment remain outside this authorisation.
