# Shared contracts

SPEC-002 v0.2 owns this private, offline package. It depends on no Actor, SQL adapter, network client or storage service. All current source profiles and example URLs in tests are synthetic.

Import `@daas/contracts` from a workspace consumer. Exports point to TypeScript source using erasable syntax supported by the pinned Node 24 runtime; Vitest consumes the same entry point. Actor packaging/build compatibility belongs to the Actor specifications. Schemas use JSON Schema draft-07; exported TypeScript types are inferred from those definitions rather than maintained separately.

```ts
import {
  parseContract, createExtractionValidator, manifestFingerprint,
  fingerprint, compareEvents,
} from '@daas/contracts';

// Parse the ORIGINAL JSON text at the transport boundary to detect duplicate keys.
const parsed = parseContract('ExtractionEvent', originalText);
if (!parsed.ok) return quarantineWithoutLoggingValues(parsed.issues);

// These are trusted configuration and persisted assignment/execution metadata,
// supplied independently of the untrusted event. No built-in profile grants approval.
const validateExtraction = createExtractionValidator(approvedProfile);
const checked = validateExtraction(parsed.value, committedManifest, expectedApifyRunId);
if (!checked.ok) return quarantineWithoutLoggingValues(checked.issues);

const contentDigest = fingerprint(checked.value);
// A consumer can compare to an already validated previous immutable envelope:
const disposition = compareEvents(previousValidatedEvent, checked.value);
// Construct the full launch input first, then attach its digest:
const launchDigest = manifestFingerprint(unsignedLaunchInput);
```

The names supplied by a consumer in this example are illustrative; this package performs no quarantine, persistence or launch. A manifest digest is SHA-256 over every field except its own `manifest_fingerprint`; event digests include the complete envelope and are stored outside it. Digests are integrity/replay identifiers, not authentication signatures. Verify manifests against trusted persisted assignments, never an event-supplied manifest.

`validateContract(name, value)` and `parseContract(name, text)` validate shape and intrinsic invariants only. **They do not establish source approval, assignment ownership or usable extraction.** Use `createExtractionValidator(profile)` with the expected manifest/physical run for extraction. Use `validateDiscoveryCandidate(candidate, expectedInput)`, `validateDiscoveryCoverage(coverage, expectedInput)` and `validateExecutionSummary(summary, expectedManifest, expectedRun)` at their boundaries. Each contextual validator checks its supplied expected contract too. Successful validation returns the original input reference without modifying it; it does not freeze or copy caller-owned event data. Consumers must avoid modifying validated envelopes before hashing/persisting them.

`createExtractionValidator` snapshots trusted profile configuration, including record schema, accepted source/context/page/version, cardinality and allowed evidence locations/policy. Invalid configuration throws a fixed safe error. Individual event failures return `{ok:false,issues:[{path,code}]}`. Diagnostics redact unknown business keys and never include rejected values. Only approved schemas are compiled; there is no remote schema loader or registry service. Record schema validation preserves raw strings/numbers/zero/false/null. A declared page type is checked here; validating actual HTML and detecting challenge pages belong to SPEC-005/006.

`parseJson` rejects malformed JSON, decoded duplicate object keys, comments and trailing commas before ordinary parsing; `inspectJson` checks plain parsed data without getters, proxies, cycles or lossy JSON substitutes. Already parsed objects cannot reveal duplicate keys discarded by an upstream parser. Neither function supplies the original transport bytes or position: the caller retains those independently for quarantine/evidence. RFC 8785 hashing preserves Unicode (without normalizing it) and array order, rejects lone surrogates/non-finite values, and uses ECMAScript number serialization. Precision-sensitive decimal values must be strings in the approved source schema.

Finite limits and timestamp/identity rules are in [SPEC-002](../../docs/micro-specs/SPEC-002-contracts.md) and exported `JSON_LIMITS`/`CONTRACT_LIMITS`. A complete coverage report requires every expected seed partition, consistent counts and `finished`; an interrupted run is partial/failed rather than evidence of deletion. A finished execution summary accounts for all assigned attempts as processed/emitted. Missing summaries are permitted operationally; no synthetic result is manufactured.

URL checks cover absolute HTTP(S) syntax without credentials, not normalization or SSRF safety. Evidence checks cover bounded descriptors and trusted location/policy membership, not object existence, access, durability or retention. Fingerprint/replay helpers allocate no IDs and implement no database authority transitions. Producers must reuse event IDs for redelivery and allocate new UUIDs for genuine refetches; later Actor/SQL tests verify those lifecycles. Real source selection, policies and external compatibility remain downstream gates.

Run `npm run check` at the repository root for lint, strict type checks and the harness/unit/contract suites. Test fixtures live in `tests/contracts/fixtures.ts`; no synthetic profile is exported as a usable production default.
