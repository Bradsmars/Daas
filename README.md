# DaaS platform specification workspace

The SPEC-001 repository foundation is merged into `dev`. SPEC-002 adds shared message contracts, strict validation and canonical fingerprints on `feat/spec-002-contracts`. Crawlers, MSSQL migrations and integration behavior belong to later approved specifications.

Start with [development setup](docs/development.md), [the specification baseline](docs/architecture/master-spec.md), [the dependency graph](docs/architecture/dependency-graph.md) and [the execution plan](docs/architecture/implementation-plan.md). Foundation approval is recorded in [the approval register](docs/architecture/approval-register.md); later specifications and architectural choices still require their own gates.

With Node **24.22.0** and npm **11.19.1** available:

```bash
npm ci
npm run check
```

`check` runs lint, strict type checking and the harness, unit and contract suites. Contracts use synthetic fixtures; external suites explicitly report `BLOCKED` without test configuration. On Windows PowerShell, use `npm.cmd` if execution policy prevents `npm.ps1`.

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

The workspace packages are private. [Shared contracts](packages/contracts/README.md) expose the current schemas and trusted validation APIs. `apps/` and `database/` document their future responsibilities; no source Actor or database client exists yet.
