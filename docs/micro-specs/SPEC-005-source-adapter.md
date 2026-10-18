# SPEC-005 - First source extraction adapter and semantic validity

Status: **draft for review; implementation not started**. Version 0.1. Updated 18 October 2026.
Owner: unassigned. Reviewer/acceptance authority: user or delegated reviewer.
Source trace: [M](../architecture/master-architecture.md) / [R](../architecture/architecture-review.md): M §5, §8; R: Stage 2 needs to establish usable extraction before declaring success.
Blocking approvals: [D-02, D-06, D-09; G0](../architecture/approval-register.md).
Plan: [v0.1](../architecture/implementation-plan.md); [graph](../architecture/dependency-graph.md).
Implementation/test reports: not started / NOT RUN. Review recommendations remain proposed until G0 and relevant decisions are accepted.

## Objective and scope

Extract the first approved source's minimum useful field contract and distinguish unusable pages from valid observations.

One source/page type/context/version and pure parsing/semantic validation. Excludes HTTP/browser lifecycle, queueing, SQL writes, cross-source business normalization and a general scraping configuration language.

## Functional requirements

| ID | Required behavior | Source / decision |
|---|---|---|
| SPEC-005-FR-01 | Parse approved retained response/DOM evidence with explicit source profile/version and request context; output the approved zero/one/many record cardinality. | M §5; D-02 |
| SPEC-005-FR-02 | Validate page identity, required fields and source invariants; reject login/challenge/soft404/empty shell/wrong market despite HTTP 200. | R: usable extraction |
| SPEC-005-FR-03 | Keep missing/unavailable distinct from zero/false/out-of-stock; preserve useful source strings alongside parsed values and return structured validation reasons. | R: usable extraction |
| SPEC-005-FR-04 | Support deterministic fixture replay and an explicitly versioned corrected parser without modifying original event history. | R: evidence and source adapters |

## Non-functional requirements

| ID | Observable constraint | Source / verification |
|---|---|---|
| SPEC-005-NFR-01 | Parser has no network, SQL, environment-secret or current-clock dependency; same bytes/context/version produce the same semantic result. | engineering principles; AC matrix below |
| SPEC-005-NFR-02 | Input size/depth/record counts and parser timeout strategy are bounded by approved profile; raw personal/sensitive data is excluded from committed fixtures. | M §7; D-07; AC matrix below |
| SPEC-005-NFR-03 | No coercion into a successful result when page identity, context or required fields are uncertain. | R: usable extraction; AC matrix below |

## Technical design and boundaries

Own a source adapter module shared from `packages/shared` (or a source-adapter submodule, without creating another deployable). A small typed adapter interface receives response/DOM bytes, relevant headers, approved profile and context, returning records or semantic failure reasons. Configuration can express selectors/simple limits; complicated behavior remains understandable tested code. Values stay close to the source; cross-source standardization belongs in future Silver. Maintain sanitized normal, missing-field and deceptive HTTP200 fixtures with provenance, capture permission and checksums. D-02 must supply exact field names/types/examples and cardinality before this spec becomes ready; the architecture's product-price example is not the selected business contract.

## Inputs and outputs

Input: bounded content bytes/DOM, content type, requested/final URL, nullable HTTP status and immutable source/context/parser configuration. Output: typed records (0..approved maximum), validation outcome, reason codes, retained source strings and evidence selection reasons. Fetch timing/provenance envelope belongs to 006; adapter does not invent observation time.

## Dependencies and entry gate

Direct prerequisites: [SPEC-002](SPEC-002-contracts.md).
Required state: predecessor capabilities verified at their applicable checkpoint; this spec reviewed and ready; G0 approved and blocking decisions resolved. See graph for transitive dependencies and parallel work. Writing this draft does not pass an implementation gate.

## Acceptance criteria and traceability

**Verification boundary:** Own verification is approved semantic source fixtures, parser versioning and deterministic byte-to-result replay at CP2. Actual storage retrieval and integration into envelopes are follow-through checks in 006/015, not reverse prerequisites.

Requirement references in this table use this specification's prefix.

| ID | Given / when / then pass condition | Requirements | Unit / inspection | Integration / checkpoint |
|---|---|---|---|---|
| SPEC-005-AC-01 | The normal approved source fixture yields exactly the specified record(s), types and source strings; absent optional values follow explicit null/absence rules. | FR-01, FR-03, NFR-01 | Approved golden record fixture. | CP2: 006/013 golden contract roundtrip without business coercion. |
| SPEC-005-AC-02 | Challenge, login, soft404, wrong-context, empty shell and missing-required-field fixtures yield non-success with specific reasons, including HTTP200 inputs. | FR-02, NFR-03 | One fixture per deceptive-page/invariant failure. | CP4: unusable extraction never advances last_success_at. |
| SPEC-005-AC-03 | Original retained evidence can be passed to a newer parser and produce a separately attributed corrected result; original parsed output and event history remain unchanged. | FR-04, NFR-02 | Versioned parser replay with bounded malformed/large input. | CP4: 017 retrieves/verifies selected evidence and invokes the approved adapter. |

## Unit and integration test requirements

TDD first: HTTP200 challenge page must fail semantic extraction. Cover duplicate candidate values, locale/price strings only if fields require them, empty vs zero, partial markup, malformed encoding, multiple records and wrong context. Use exact field requirements; do not invent domain cases for an unselected niche.

Parser itself needs no external integration. Test its result against 002 schema and the actual chosen crawler's captured representation. Evidence retrieval+corrected parser replay is verified jointly with 017 at CP4.

Use [test-strategy](../standards/test-strategy.md); commands are established by 001 and actual results recorded later. All checks in this draft are planned, not executed.

## Error handling and recovery

Missing required fields/page identity or parser exception produces parse_error/schema_invalid with safe reasons and evidence selection, not partially accepted success. Missing optional values remain explicit. Widespread regression is surfaced for source/parser pause by 014; no selector fallback guesses invented facts.

Apply bounded approved retry policies. Missing numeric/profile details keep the affected criterion blocked; do not invent defaults or log raw secrets/content.

## Decisions and Definition of Done

Open: D-02, D-06, D-09; G0. The register identifies the information needed and the authority. Contract changes update affected dependents before implementation.

- [ ] First niche/fields/context approved; all semantic fixtures and replay checks pass; versioning and bounded behavior documented; corrected output never overwrites immutable Bronze.
- [ ] All FR/NFR and ACs have passing applicable evidence; meaningful behavior has red/green history.
- [ ] Required real-boundary checks pass; skipped, blocked or failing required checks remain unverified.
- [ ] Shared contracts, security, failure recovery and relevant integration checkpoint reviewed.
- [ ] No unapproved infrastructure or deviations; implementation/test reports and any accepted ADRs linked.
- [ ] Verification recorded separately from acceptance; current state remains draft until actual gates pass.

Completion record: report none; tested revision none; reviewer/date pending; acceptance pending.
Change history: v0.1 initial source-traced draft, 18 October 2026.

