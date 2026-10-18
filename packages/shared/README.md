# Shared runtime policy and URL identity

Import the private workspace package `@daas/shared` using the pinned Node 24 runtime or workspace TypeScript tooling. SPEC-004 v0.2 provides pure URL/context identity. SPEC-016 v0.2 adds development/test configuration, evidence descriptor authorization, address policy and a direct Node HTTP(S) enforcing client. The dependency on `@daas/contracts` reuses scalar shapes, bounded JSON inspection and canonical fingerprints; Ajv validates configuration without coercion, defaults or field removal. No database client, Actor or source adapter is implemented.

## Runtime and direct HTTP boundary

Call `prepareRuntime(nonSecretConfiguration, environment)` at trusted startup. It returns `Result<RuntimeSession>`: immutable `config`, `config_fingerprint` and role-controlled `getSecret(kind)`. Every required configuration field and finite budget is explicit. The environment must match `DAAS_ENV` exactly; only `development` and `test`, and only `execution_mode: 'direct_http'`, are supported. Production, browser and proxy modes reject.

Actor roles cannot declare SQL credentials or SQL permissions. An integration-service role declares only control read/write and Bronze insert capabilities, with explicit Apify/SQL environment references. Test and development secret names are separate; values are loaded once into private closures, excluded from configuration/hash/diagnostics and returned only through intentional `getSecret` calls. Callers must protect those returned values. No `.env` file is loaded automatically, and the module does not prove actual MSSQL permissions or provide a query executor.

`createSecureHttpClient(session, options?)` accepts only a session produced by the validated startup boundary. Its `fetch` accepts the same URL/context/version input as the normalizer, plus optional cancellation; successful results contain requested/final URLs, redirect history, HTTP status, content type and decoded `Buffer` body. HTTP status alone says nothing about extraction success. Correlation metadata exposes the source/context/config version and fingerprint without secrets.

The client validates every DNS answer, pins one approved literal connection address and preserves original Host/TLS SNI/certificate hostname. Fresh agents ignore ambient proxy settings and cannot reuse an earlier connection decision. Redirects are handled manually and reauthorized, while wall-clock aborts cover DNS, connect, headers and body. GET requests carry no arbitrary authorization/cookie headers. Gzip, deflate and Brotli responses have independent streaming wire/decoded byte caps; unknown encodings and protocol upgrades reject. Response headers have a fixed 16 KiB ceiling. URL path authorization rejects ambiguous encoded separators/percent nesting/controls without changing the retained identity.

Approved fixture ceilings: 5 physical requests including redirects/retries; 10 candidates; depth 1; concurrency 1; at least 1,000 ms between requests; 3 redirects; 1 MiB wire and decoded bytes; 20,000 ms request and 120,000 ms run. DNS deadlines must fit request deadlines. Request/rate/run/concurrency budgets are shared by clients created from the same session. Candidate/depth/retry settings are validated and exposed for future consumers; this client does not discover links or retry automatically. Session rotation/restart are zero. These are explicit controlled-test bounds, not defaults or permission to crawl a real source.

Successful local fixtures additionally require trusted `DAAS_ENV=test` and a caller-supplied `fixture` capability listing exact allowed origins/ports and only `127.0.0.1`/`::1`. An optional fixture CA is trusted only for those listed endpoints; hostname verification remains enabled. Neither an untrusted input flag nor development mode grants loopback access. The normal public-only policy rejects the same fixture server before connecting. Runtime injection points for controlled resolution do not replace the address policy.

`validateResolvedAddresses(answers, trustedLoopbackExceptions?)` authorizes 1–16 complete address/family pairs, rejects a whole mixed set and returns frozen deduplicated answers. It conservatively excludes special/reserved/metadata addresses and IPv6 translation/tunnel forms. `sameIpAddress` compares a selected address with socket peer representations, including mapped IPv4; that comparison does not grant network authorization. Pure address tests and actual local HTTP/HTTPS tests establish this Node boundary only. Real-source scope, hosted Crawlee/Apify enforcement, shared scheduling between runs and production networking remain downstream gates.

## Evidence descriptors

`validateEvidencePolicy` returns a frozen policy snapshot; `createEvidenceReferenceValidator(policy, owner)` returns a descriptor validator. Policies name exact provider/location/retention class, safe object-key prefix, per-object byte cap and bounded retention seconds. An explicit disabled policy has no locations, zero retention and `required: false`. Required evidence needs a positive retention and approved location; duplicate provider/location mappings reject.

The owner supplies a trusted request context and safe trailing-slash object prefix inside an approved location. References must pass SPEC-002 validation, match context/policy/location/retention, fit the byte cap and lie below both location and ownership prefixes. Arbitrary URLs/local paths, escaped traversal and neighboring prefix names reject. The validator returns frozen descriptor snapshots; it performs no storage access, body archiving, checksum verification, provider existence test or retention enforcement. A consumer must separately require references when its observation policy demands them.

## Pure URL identity

The normalizer and identity comparison below perform no network, DNS, database or clock operations.

```ts
import { createUrlNormalizer, compareUrlIdentities } from '@daas/shared';

// Synthetic example only; a real source and its exact scope need approval.
const normalize = createUrlNormalizer({
  source_id: '2', request_context_id: 'synthetic-context-v1',
  normalization_version: 'fixture-v1', mode: 'preserve-v1',
  allowed_origins: ['https://target.example.test'],
  allowed_path_prefixes: ['/products'],
});
const result = normalize({
  url: '../item?variant=A#details',
  base_url: 'https://target.example.test/products/category/page',
  request_context_id: 'synthetic-context-v1', normalization_version: 'fixture-v1',
});
if (result.ok) {
  const { identity_key, identity_hash } = result.value;
  const bytesForSql = Buffer.from(identity_key, 'utf8');
  const comparison = compareUrlIdentities(
    { identity_key, identity_hash },
    { identity_key, identity_hash },
  ); // {ok:true, value:'same'}
}
```

The factory validates and snapshots caller-owned policy. All fields are required, with no defaults or unknown extensions. Origins must already be canonical `http(s)://host[:port]` strings, without slash/path/query/fragment/credentials. Prefixes must be canonical literal serialized paths. Prefix matching uses segment boundaries: `/products` allows `/products` and `/products/item`, while `/products/` requires that trailing separator; neither admits `/products-other`. Policy arrays are limited to 10 entries each. Context/version/source scalar conventions match the contracts package.

`preserve-v1` is the only supported mode. Standard WHATWG serialization resolves host case, IDNA, default ports and dot segments; it can serialize Unicode to percent escapes. Preserve the full resulting `href`: path case, slash distinctions, bare `?`/`#`, query order/duplicates/empty segments, routing fragments and reserved escape spellings remain distinct. Nothing drops tracking parameters, sorts queries, follows redirects or applies canonical tags. Override fields and unsupported modes reject. A future transformation needs approved source vectors and version/rekey review, rather than silently changing existing identities.

The output contains `source_id`, `request_context_id`, `normalization_version`, exact `original_url`, absolute `canonical_url`, `identity_key` and `identity_hash`. Original input can be a relative reference; discovery producers must still meet SPEC-002's absolute `discovered_url` contract and retain raw link provenance separately where appropriate. Supplying an explicit base validates it even for absolute references. Bases may be on another origin, but the final resolved target must match the trusted target scope.

`identity_key` is the exact JSON string-array tuple `["daas-url-identity-v1",source_id,request_context_id,normalization_version,canonical_url]`. Its UTF-8 bytes are the identity comparison bytes; hash is SHA-256 over the same tuple through the contracts fingerprint helper. SQL must compare exact bytes and length independently of text collation. `compareUrlIdentities` accepts exactly `{identity_key,identity_hash}` metadata pairs, not the full normalization output: equal key/hash is `same`, unequal keys/hash is `different`, equal hash/unequal key is `hash_collision`. Equal keys with inconsistent hashes return an error. The helper validates canonical tuple shape, not hash authenticity; callers recompute/store trusted hashes at intake. No SQL collision transaction or ownership change happens here.

Input URLs/bases/canonical URLs have a 2,048-code-point ceiling; identity keys 4,096 UTF-8 bytes. Policy paths also have the URL ceiling and must fit a valid bounded URL under their origin. Shared JSON resource bounds apply first. Literal whitespace/C0/C1 controls, backslashes, malformed percent triplets, invalid Unicode, non-HTTP(S), empty credential markers, missing/invalid bases, mismatched context/version and out-of-scope targets fail without trimming or diagnostic values. Percent-encoded path/query bytes remain opaque; native parsing resolves encoded dot segments.

Invalid configuration throws `Invalid URL normalization policy.`. Reference failures return `{ok:false,issues:[{path,code}]}` with only known/redacted paths and fixed codes. Inputs are unchanged; invalid raw values are not logged. The caller retains transport provenance. Configuration approval and immutable version registration are caller responsibilities; this pure module cannot inspect a registry or existing SQL rows.

Syntactic scope checks do not enforce DNS/connection/redirect/browser restrictions or server-specific decoding of encoded separators. Use the enforcing HTTP boundary for the supported execution mode. Browser fetching remains unsupported. Real source rules and permissions remain unapproved; the examples authorize no fetching. Actor/importer and SQL reuse remain downstream CP2/CP3 evidence.

Run `npm run check` at the root. Synthetic URL vectors live in `tests/contracts/url-normalization.test.ts`; exact byte/collision vectors in `tests/unit/url-identity.test.ts`. Runtime/address/evidence suites exercise their own boundaries, and `tests/contracts/secure-http.test.ts` runs actual local HTTP/HTTPS connections. TLS fixtures use existing OpenSSL to generate temporary keys; absent tooling fails honestly, and private keys are never committed. External MSSQL/Apify suites remain unimplemented. See [development setup](../../docs/development.md), [SPEC-004](../../docs/micro-specs/SPEC-004-url-normalization.md), [ADR-0003](../../docs/architecture/decisions/ADR-0003-url-identity.md), [SPEC-016](../../docs/micro-specs/SPEC-016-runtime-security.md) and [ADR-0004](../../docs/architecture/decisions/ADR-0004-controlled-http-security.md).
