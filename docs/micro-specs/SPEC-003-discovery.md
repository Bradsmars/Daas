# SPEC-003 - Bounded discovery Actor and coverage manifest

Status: **draft for review; implementation not started**. Version 0.1. Updated 18 October 2026.
Owner: unassigned. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §3; R: Stage 1 needs explicit coverage and URL-identity rules.; R: Rate limits and retries must be controlled across both stages.
Blocking approvals: [D-02, D-05, D-07, D-09; G0](../architecture/approval-register.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: not started / NOT RUN. Review recommendations remain proposed until G0 and relevant decisions are accepted.

## Objective and scope

Discover approved target URLs and prove which configured discovery scope was actually covered.

One source's approved discovery strategy, candidates, provenance and coverage summary. Implement only the selected method initially (feed/sitemap/category); use a source strategy boundary for later additions. Excludes detail-field extraction and durable inventory ownership.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-003-FR-01 | Consume approved source, seeds, target rules, context and run/configuration identity; fetch only approved resources and emit deduplicated candidate records using shared source-aware normalization. | M §3; 004, 016 |
| SPEC-003-FR-02 | Retain discovered/original URL, normalized target, found-on URL, method, discovery-source provenance and separately resolved approved target source. | M §3; R: discovery provenance |
| SPEC-003-FR-03 | Emit a coverage manifest recording each seed/partition attempted, failures, candidate/raw/duplicate counts, config/scope version, stop reason and continuation where supported. | R: discovery coverage |
| SPEC-003-FR-04 | Treat limits, failed partitions and cancellation as partial/failed coverage; never retire missing inventory URLs and avoid loading detail pages merely to discover their links. | R: discovery coverage |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-003-NFR-01 | Request count, depth/pagination, candidate count, sitemap decompressed bytes, redirects, runtime, retries and concurrency are finite approved profile values; cancellation stops enqueueing new work. | M §7; D-07; AC matrix below |
| SPEC-003-NFR-02 | Site admission is shared with extraction through integration-service group ownership (009/011); Actor locally enforces approved per-source request delay and retry bounds. | R: rate limits; AC matrix below |
| SPEC-003-NFR-03 | No SQL credentials or direct database connection; output is confined to run-specific Apify storage and safe correlated diagnostics. | M §2, §6; AC matrix below |

## Technical design and boundaries

Own `apps/discovery-actor`. Use Crawlee's suitable HTTP crawler by default for the chosen source; a browser requires D-02 evidence. Parse links or the approved XML/feed format, normalize/filter before enqueueing and emitting, and use explicit source-aware request keys rather than relying on Crawlee's generic URL normalization. Do not follow arbitrary facets or pagination. Separate crawl traversal identity from emitted target identity. A manifest is a typed separate run output (not an accidental extra candidate row); terminal-run ingestion can handle a missing manifest after a killed Actor. A normal zero-candidate run can be complete if every configured partition was actually checked.

## Inputs and outputs

Input: DiscoveryInput from 002 with discovery_run_id, source/profile/context, approved seeds and numeric bounds. Outputs: Candidate[] (0..bounded count), CoverageManifest, safe run summary and an explicit incomplete status on truncation. The caller handles SQL intake and shared domain admission; the Actor cannot self-authorise execution.

## Dependencies and entry gate

Direct prerequisites: [SPEC-004](SPEC-004-url-normalization.md), [SPEC-016](SPEC-016-runtime-security.md).
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

## Acceptance criteria and traceability

**Verification boundary:** Own verification covers the chosen Crawlee strategy, bounded output and coverage contract. Inventory non-retirement and shared admission in CP3/CP4 are downstream integration obligations; they do not require 008/009 to be implemented before the Actor can be verified.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-003-AC-01 | The controlled index emits exactly two unique in-scope candidate identities, preserves provenance and excludes duplicate/non-target/external links without fetching detail pages unnecessarily. | FR-01, FR-02 | Link/sitemap vectors and strategy fixture. | CP2/CP4: actual Crawlee fixture crawl and Apify output contract. |
| SPEC-003-AC-02 | A request/depth/page/byte limit or failed partition yields partial coverage with reason/counts; a complete empty source yields complete coverage with zero candidates. | FR-03, FR-04, NFR-01 | Cyclic links, repeated pagination, compressed XML expansion, cancellation and empty fixture. | CP4: inventory remains unchanged for absent URLs after partial discovery. |
| SPEC-003-AC-03 | Redirect to a blocked address stops before that request; errors remain source-correlated without secrets, and the Actor never requests SQL connectivity. | NFR-02, NFR-03, FR-01 | Injected redirect/DNS/429 policies and forbidden-import inspection. | CP2/CP4: real runtime target-policy enforcement within approved budget. |

## Unit and integration test requirements

TDD first: duplicate links produce one candidate while raw/discard counts still reconcile. Test relative bases, empty/malformed markup/XML, continuation, scope redirects, rate backoff, pagination cycles and every stopping bound with controllable clocks.

Run actual Crawlee against isolated synthetic content; separately execute hosted Apify against an approved controlled fixture or source after access/budgets are approved. Assert dataset and manifest retrieval by physical run ID. Shared site admission is verified with 009/011 at CP3/CP4, not assumed from local concurrency.

Use [test-strategy](../standards/test-strategy.md); commands are established by 001 and actual results recorded later. All checks in this draft are planned, not executed.

## Error handling and recovery

429/selected 5xx/network failures use bounded approved local retry and report partition failures when exhausted. Unsupported method/configuration fails before fetching. Crashes may leave partial candidates and no final manifest; importer records incomplete coverage. Unknown target ownership is rejected/held for review, not assigned to an arbitrary source.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Open: D-02, D-05, D-07, D-09; G0. The register identifies the information needed and the authority. Contract changes update affected dependents before implementation.

- [ ] Selected strategy and all bounds implemented; fixture counts/coverage and security pass; no inventory retirement logic; actual Actor output compatible with 002 and checkpoint evidence linked.
- [ ] All FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [ ] Required real-boundary checks pass; skipped, blocked or failing required checks remain unverified.
- [ ] Shared contracts, security, failure recovery and relevant integration checkpoint reviewed.
- [ ] No unapproved infrastructure or deviations; implementation/test reports and any accepted ADRs linked.
- [ ] Verification recorded separately from acceptance; current state remains draft until actual gates pass.

Completion record: report none; tested revision none; reviewer/date pending; acceptance pending.
Change history: v0.1 initial source-traced draft, 18 October 2026.

