# Architectural decision records

The SPEC-001 repository foundation and SPEC-002 offline contracts are verified and integrated into `dev`. The user has now authorised SPEC-004's scoped offline URL/context identity implementation. Scoped approvals and remaining architectural choices live in [the approval register](../approval-register.md); SPEC-004 commit/push/merge and later specifications require further approval.

| ADR | Date | Status | Scope |
|---|---|---|---|
| [ADR-0001 — Repository foundation toolchain](ADR-0001-repository-toolchain.md) | 2026-10-18 | Accepted | SPEC-001 only: strict TypeScript, npm workspaces, Node 24 LTS, Vitest and ESLint. |
| [ADR-0002 — Shared contracts and bounded offline validation](ADR-0002-shared-contracts.md) | 2026-10-18 | Accepted for implementation start | SPEC-002 only: Ajv, contract identity/fingerprints, explicit trusted synthetic profiles and finite offline limits. |
| [ADR-0003 - Source-independent URL identity with explicit trusted policy](ADR-0003-url-identity.md) | 2026-10-18 | Accepted for scoped implementation start | SPEC-004 only: pure `preserve-v1`, synthetic vectors, caller-supplied trusted source/context/version/scope policy and exact UTF-8 identity tuple comparison. |

ADR-0001 includes measured compatible foundation pins and linked SPEC-001 evidence. ADR-0002 records start authorisation; [the SPEC-002 report](../../../reports/implementation/SPEC-002/REPORT-20261018-02.md) records its offline verification. ADR-0003 and [the SPEC-004 plan](../plans/SPEC-004.md) record scoped authority, not a test pass. Full pipeline/domain verification and real-source, SQL/control, evidence-storage and operational choices remain outstanding.

Create `ADR-NNNN-<short-title>.md` from [the template](../../templates/adr-template.md) when a concrete architectural decision is proposed or accepted. Record actual authority, date, affected source/spec revisions and approval evidence. Do not mark a recommendation accepted merely because it appears in this framework.

Keep an index here as decisions are recorded. Preserve rejected and superseded decisions, link later replacements, and update affected contracts/specifications and graph before dependent implementation. Routine choices already authorised by a ready spec belong in implementation reports unless they change a lasting cross-component constraint.
