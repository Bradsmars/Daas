# DaaS platform specification workspace

SPEC-001 repository foundation, SPEC-002 shared contracts and SPEC-004 URL/context identity are integrated into `dev`. SPEC-016 is being implemented on `feat/spec-016-runtime-security`: validated development/test settings, role-scoped environment secrets, evidence descriptor policy and an enforcing Node HTTP(S) client. Real-source crawlers, MSSQL migrations and hosted integration belong to later approved specifications.

Start with [development setup](docs/development.md), [the specification baseline](docs/architecture/master-spec.md), [the dependency graph](docs/architecture/dependency-graph.md) and [the execution plan](docs/architecture/implementation-plan.md). Foundation approval is recorded in [the approval register](docs/architecture/approval-register.md); later specifications and architectural choices still require their own gates.

With Node **24.22.0** and npm **11.19.1** available:

```bash
npm ci
npm run check
```

`check` runs lint, strict type checking and the harness, unit and contract suites. Synthetic contract tests include actual local HTTP/HTTPS servers; they require the existing OpenSSL executable to generate temporary TLS fixtures. These tests contact no real source, Apify service or MSSQL database. External suites explicitly report `BLOCKED` without test configuration and remain unimplemented. On Windows PowerShell, use `npm.cmd` if execution policy prevents `npm.ps1`.

| Resource | Purpose |
|---|---|
| [Original architecture](docs/architecture/master-architecture.md) | Preserved authoritative source, dated 15 October 2026 |
| [Architecture review](docs/architecture/architecture-review.md) | Preserved authoritative review; recommendations requiring choices are identified explicitly |
| [Micro-specification index](docs/micro-specs/README.md) | Scope, dependencies and readiness of each implementation unit |
| [AGENTS.md](AGENTS.md) | Repository instructions for AI-assisted implementation |
| [Engineering principles](docs/standards/engineering-principles.md) | SDD, TDD, security and maintainability rules |
| [Reporting and decisions](docs/standards/reporting-and-decisions.md) | Evidence and ADR conventions |
| [Templates](docs/templates/README.md) | Reusable specification, report and ADR formats |
| [Reports](reports/README.md) | Implementation records, verification evidence and remaining limitations |

The workspace packages are private. [Shared contracts](packages/contracts/README.md) expose schemas and trusted validation APIs; [shared runtime policy and URL identity](packages/shared/README.md) supply URL identity, configuration, evidence and direct transport boundaries. Production, browser and proxy modes are unsupported. `apps/` and `database/` document their future responsibilities; no source Actor or database client exists yet.
