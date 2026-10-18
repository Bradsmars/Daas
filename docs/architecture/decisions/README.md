# Architectural decision records

The user has approved the SPEC-001 repository foundation start and its tooling only. Open architecture choices and the limits of G0/D-01 approval live in [the approval register](../approval-register.md); later specifications require their own start approval.

| ADR | Date | Status | Scope |
|---|---|---|---|
| [ADR-0001 — Repository foundation toolchain](ADR-0001-repository-toolchain.md) | 2026-10-18 | Accepted | SPEC-001 only: strict TypeScript, npm workspaces, Node 24 LTS, Vitest and ESLint. |

ADR-0001 now includes measured compatible foundation pins and linked SPEC-001 evidence. SPEC-001 is verified pending user review; full CP1/domain validation and all later architectural decisions remain outstanding.

Create `ADR-NNNN-<short-title>.md` from [the template](../../templates/adr-template.md) when a concrete architectural decision is proposed or accepted. Record actual authority, date, affected source/spec revisions and approval evidence. Do not mark a recommendation accepted merely because it appears in this framework.

Keep an index here as decisions are recorded. Preserve rejected and superseded decisions, link later replacements, and update affected contracts/specifications and graph before dependent implementation. Routine choices already authorised by a ready spec belong in implementation reports unless they change a lasting cross-component constraint.
