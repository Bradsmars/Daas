# Architectural decision records

The user has approved the SPEC-001 repository foundation and now the SPEC-002 offline shared-contract start. Scoped approvals and remaining architectural choices live in [the approval register](../approval-register.md); later specifications and SPEC-002 commit/push/merge require further approval.

| ADR | Date | Status | Scope |
|---|---|---|---|
| [ADR-0001 — Repository foundation toolchain](ADR-0001-repository-toolchain.md) | 2026-10-18 | Accepted | SPEC-001 only: strict TypeScript, npm workspaces, Node 24 LTS, Vitest and ESLint. |
| [ADR-0002 — Shared contracts and bounded offline validation](ADR-0002-shared-contracts.md) | 2026-10-18 | Accepted for implementation start | SPEC-002 only: Ajv, contract identity/fingerprints, explicit trusted synthetic profiles and finite offline limits. |

ADR-0001 includes measured compatible foundation pins and linked SPEC-001 evidence. ADR-0002 records authorisation, not a test pass. Full pipeline/domain verification and real-source, SQL/control, evidence-storage and operational choices remain outstanding.

Create `ADR-NNNN-<short-title>.md` from [the template](../../templates/adr-template.md) when a concrete architectural decision is proposed or accepted. Record actual authority, date, affected source/spec revisions and approval evidence. Do not mark a recommendation accepted merely because it appears in this framework.

Keep an index here as decisions are recorded. Preserve rejected and superseded decisions, link later replacements, and update affected contracts/specifications and graph before dependent implementation. Routine choices already authorised by a ready spec belong in implementation reports unless they change a lasting cross-component constraint.
