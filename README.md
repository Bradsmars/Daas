# DaaS platform specification workspace

This repository currently contains specifications and engineering guidance only. No application code, database migrations, dependencies or infrastructure have been created.

Start with [the specification baseline](docs/architecture/master-spec.md), review [the dependency graph](docs/architecture/dependency-graph.md) and [the execution plan](docs/architecture/implementation-plan.md), then resolve [the approval register](docs/architecture/approval-register.md). The framework is **draft for review**; implementation is not authorised by this documentation pass.

| Resource | Purpose |
|---|---|
| [Original architecture](docs/architecture/master-architecture.md) | Preserved authoritative source, dated 15 October 2026 |
| [Architecture review](docs/architecture/architecture-review.md) | Preserved authoritative review; recommendations requiring choices are identified explicitly |
| [Micro-specification index](docs/micro-specs/README.md) | Scope, dependencies and readiness of each implementation unit |
| [AGENTS.md](AGENTS.md) | Repository instructions for AI-assisted implementation |
| [Engineering principles](docs/standards/engineering-principles.md) | SDD, TDD, security and maintainability rules |
| [Reporting and decisions](docs/standards/reporting-and-decisions.md) | Evidence and ADR conventions |
| [Templates](docs/templates/README.md) | Reusable specification, report and ADR formats |
| [Reports](reports/README.md) | Future implementation/test evidence; current documentation review |

The eventual `apps/`, `packages/`, `database/` and `tests/` directories are planned in SPEC-001. They are deliberately not scaffolded during specification engineering.
