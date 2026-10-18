# ADR-0002 — Shared contracts and bounded offline validation

Status: **accepted for SPEC-002 implementation start only**.
Decision date: 2026-10-18. Authority: user; implementation owner: Codex.
Branch: `feat/spec-002-contracts` from `dev` at `f5b7cf1`.
Affected specification: [SPEC-002](../../micro-specs/SPEC-002-contracts.md).
Approval: [register v0.3](../approval-register.md), scoped G0/D-01/D-03/D-07.
Plan: [SPEC-002 implementation and acceptance](../plans/SPEC-002.md).

## Context and approval

[M §3–6](../master-architecture.md) and [R: “Change the extraction contract to identify work, observations and delivery separately.”](../architecture-review.md) require shared boundary contracts before producers and persistence. SPEC-001 provides the verified strict-TypeScript/npm test foundation.

On 2026-10-18 the user authorised starting SPEC-002. This decision records that start within the concrete offline scope below; it does not record a commit/push/merge approval or acceptance of later architecture implementations. Real source selection is deliberately deferred to SPEC-005 rather than inferred from illustrative product examples.

## Decision

- Implement the shared JSON Schema/type/validation boundary and pure identity/digest helpers in `packages/contracts`, verified by meaningful offline tests. Use Ajv with coercion, default insertion and field removal disabled; select, verify and pin a compatible exact version.
- Preserve SPEC-002's distinction among source/URL/context, logical run/dispatch/attempt/generation, physical Apify execution and immutable event identity. Positive decimal-string IDs must retain full SQL BIGINT precision; opaque context/provider IDs remain opaque. SQL types and operations are future implementation.
- Fingerprint the complete event envelope with SHA-256 of UTF-8 RFC 8785 canonical JSON. Exclude no envelope fields. Transport position and SQL ingestion time live outside it. Stable redelivery retains event ID/content; identical source values from a genuine refetch do not imply the same event.
- `WorkManifest` and `ExtractionInput` use one complete immutable extraction-launch schema (`actor_type=extraction`). Its `manifest_fingerprint` uses the same canonical-hash rules, excluding only that digest field to avoid self-reference. Include parser version, normalization version, limits and evidence-policy reference as well as assignment, profile, build and context fields. Tampering with any included field invalidates the digest. The trusted page/source profile is supplied separately at validation, never chosen by the envelope.
- Define first-valid-committed manifest/current-fence matching authority as a contract invariant; SQL acceptance, locking, claims, dispatch and quarantine/checkpoint implementation remain separately gated work.
- Require an explicit trusted source-validation profile from the caller at relevant boundaries. It supplies the accepted source/context/version, business-record schema and cardinality/semantic checks. An envelope's own profile declaration cannot grant trust. Use only synthetic fixture profiles now; no source registry service or approved real business schema is introduced.

## Finite offline profile

Profile name: `spec-002-offline-v1`. These are message/fixture-validation maxima, not site-access approval, crawler settings, production capacity or retention guarantees.

| Limit | Maximum and counting rule |
|---|---|
| Encoded message | 1,048,576 UTF-8 bytes (1 MiB) |
| JSON depth | 32 nested object/array containers; root container has depth 1 |
| Aggregate object members | 10,000 object properties across the message; array elements do not count as object members |
| Generic string guard | 8,192 UTF-16 code units before schema validation, subject to tighter field rules below |
| Generic identifiers/version strings | 128 Unicode code points; stricter UUID/positive-decimal/provider rules still apply |
| URL | 2,048 Unicode code points; absolute HTTP(S), no embedded credentials |
| Structured errors / reason | 25 errors; each reason at most 256 Unicode code points |
| Discovery seeds / partitions | 10 seeds; 10 coverage partitions |
| Assignments / business records | 100 assignments per manifest/input; 100 records per event |
| Redirects / evidence references | 10 redirects; 10 evidence references |
| Runtime-limit schema values | Positive integers at most 1,000,000; depth/retries/redirects may be zero. This bounds the offline schema, not any live operating policy. |

Ajv field `maxLength` rules count Unicode code points, while the preliminary generic string guard counts UTF-16 code units. Reject unsupported schema versions, unknown v1 envelope fields, absent required values, invalid dates/Unicode, duplicate decoded JSON object keys, non-finite numbers and applicable over-limit values without modifying evidence. Explicitly test boundary and limit-plus-one cases. Raw JSON intake enforces resource limits before ordinary parsing; parsed-object input still needs structural bounds and must be plain JSON data without getters, cycles or non-JSON objects.

Evidence-reference syntax is validated without fetching or promising storage. Outcome vocabulary and synthetic semantics are validated without selecting real retry, retirement or access-control policies. URL syntax/identity fields are validated without implementing source normalization or network SSRF controls belonging to later specifications.

## Alternatives and consequences

Waiting for a live niche would block reusable contract engineering despite no permitted site or credentials being needed for this boundary. A trusted caller-supplied profile allows meaningful synthetic schema/cardinality/context tests while keeping real-source approval explicit. A profile registry service would add infrastructure and is unnecessary.

Hashing only part of the input could permit a validated manifest to acquire different parser, limits or evidence obligations after signing. Hashing all immutable fields except the digest itself avoids that ambiguity. Event fingerprints remain full-envelope hashes with no self-hash field inside the event.

The offline profile supplies finite, reviewable limits; it does not automatically become a live Actor policy. Future changes to contract limits or meaning require a versioned compatibility review and affected consumer tests.

## Verification and remaining gates

Record actual failing/passing tests for validation, identity precision, canonical fingerprinting, manifest tampering, trusted-profile/manifest/physical-execution matching and non-mutation. Verify through the package's public boundary and rerun relevant foundation checks. No test results are asserted by this start record.

SPEC-002's own verification uses synthetic fixtures and no external services. Real producer/consumer integration, source adaptation, SQL authority enforcement, evidence durability and live crawling remain downstream obligations. D-02 real source is deferred to 005; D-04/05/06/08/09 and operational portions of D-03/D-07 remain open.

Completion is reviewable local work plus linked implementation/test evidence. Commit, push, merge, production changes and the next specification require the user's subsequent approval.

## Change history

2026-10-18: accepted scoped SPEC-002 start, identity/fingerprint rules, trusted synthetic-profile boundary and finite offline profile. No superseded decisions; ADR-0001 remains the foundation decision.
