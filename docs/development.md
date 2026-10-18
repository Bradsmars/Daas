# Development setup

Use a feature branch from `dev`, implement one approved micro-specification, prepare review into `dev`, then wait for approval before starting another. `main` holds stable approved releases. SPEC-001/002 are integrated into dev; SPEC-004 uses `feat/spec-004-url-normalization`.

## Runtime and installation

Use Node **24.22.0** and its npm **11.19.1**. The exact runtime pin is in `.node-version`; `package.json` and `.npmrc` reject unsupported Node/npm versions during installation. Download the matching runtime from [Node.js](https://nodejs.org/dist/v24.22.0/) or use your existing version manager. System Node 20 is insufficient for the pinned tooling.

```bash
node --version
npm --version
npm ci
npm run check
```

Use `npm.cmd` instead of `npm` in Windows PowerShell if script execution policy blocks `npm.ps1`. Changing PowerShell execution policy is unnecessary. These are project-local tools installed by the lockfile; global TypeScript, ESLint and Vitest installations are not required. A clean copy needs network access for the first install, while the harness itself performs no website, Apify or SQL requests.

SPEC-001 was verified using the checksum-verified official Windows runtime unpacked under `%TEMP%\daas-tools\node-v24.22.0-win-x64`; the system Node installation was preserved. For this existing temporary runtime, a PowerShell session can select it with:

```powershell
$env:Path = "$env:TEMP\daas-tools\node-v24.22.0-win-x64;$env:Path"
node --version
npm.cmd run check
```

For a fresh checkout, install/select the pinned runtime first; the temporary directory is not a repository dependency or a promised permanent installation.

## Verification commands

| Command | Current behavior |
|---|---|
| `npm run lint` | Lints JavaScript tooling and TypeScript; warnings fail. |
| `npm run typecheck` | Strictly checks tooling, harness tests and future application TypeScript without generating build output. |
| `npm test` | Runs all implemented offline harness, unit and contract suites. |
| `npm run test:harness` | Runs foundation tests, including subprocess probes of test discovery/failure. |
| `npm run check` | Runs lint, strict type checks and all implemented offline suites. |
| `npm run test:unit` | Runs strict JSON, canonical fingerprints/replay and exact URL identity/collision tests. |
| `npm run test:contracts` | Runs shared message validation and URL normalization against synthetic fixtures. |
| `npm run test:integration` | Requires `DAAS_ENV=test` and `DAAS_MSSQL_TEST_CONNECTION_STRING`; otherwise prints BLOCKED and exits 2 before running any test. |
| `npm run test:live` | Requires `DAAS_ENV=test` and `DAAS_APIFY_TEST_TOKEN`; otherwise prints BLOCKED and exits 2. Future tests own additional Actor/source/budget checks. |

External suites remain empty even if configuration is supplied, so they still fail until meaningful tests are implemented. A successful harness assertion about a blocked command does not mean SQL/Apify integration passed. Preflight diagnostics print configuration names only. A child runner's nonzero exit is preserved.

The default `npm test` includes SPEC-002's offline unit/contract tests. Empty suites still fail; external suite gates retain their prior behavior. Vitest discovery is tested using temporary capability probes. Strict type checks include erasable TypeScript syntax, and the private contracts package exports source directly for the pinned Node 24 runtime. See [the package boundary](../packages/contracts/README.md) before consuming validation APIs; structural validation alone cannot establish usable extraction.

## Development, test and production configuration

`.env.development.example`, `.env.test.example` and `.env.production.example` describe separate environments without credentials. Real `.env` files are ignored. No environment file is automatically loaded, and test commands refuse external execution unless `DAAS_ENV` is exactly `test`.

When future integration checks exist, use an isolated test service and explicitly supply test credentials. One option with the selected Node runtime is:

```bash
node --env-file=.env.test scripts/run-external-tests.mjs mssql
```

Copying an example does not create a database, Apify account, approved source or valid credentials. Production configuration/loading/network enforcement is owned by SPEC-016; SPEC-001 provides only safe examples and test-command gates. No production resource is modified by the foundation checks.

## Structure and dependencies

`apps/discovery-actor`, `apps/extraction-actor` and `apps/integration-service` are separate private workspace packages. The integration service remains one deployable. Shared contracts live in `packages/contracts` and pure reusable logic in `packages/shared`.

Contracts do not import Actor/SQL implementations. Actors will consume contracts/shared logic and will not connect to MSSQL. Tests belong to the explicitly selected directory under `tests/`. SQL migrations begin under SPEC-007. Add a dependency only when the active ready spec requires it; Crawlee/Apify/SQL clients are not foundation dependencies.

## Review and evidence

Record real commands, exit codes, runtime and source/spec revisions using [the reporting standard](standards/reporting-and-decisions.md). Preserve red and green evidence and identify any blocked/skipped check truthfully. Do not commit `node_modules`, generated output, runtime storage, personal data or credentials. Each completed specification needs review before the next one starts.
