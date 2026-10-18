# Shared URL identity

SPEC-004 v0.2 provides a pure URL/context identity boundary. Import the private workspace package `@daas/shared` using the pinned Node 24 runtime or the workspace TypeScript tooling. No network, DNS, database, clock, Actor or source adapter is used. The dependency on `@daas/contracts` reuses scalar shapes, bounded JSON inspection and canonical fingerprints; Ajv validates policy/input shapes without mutation.

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

Syntactic scope checks do not enforce DNS/connection/redirect/browser restrictions or server-specific decoding of encoded separators. SPEC-016 owns those egress controls. Real source rules and permissions remain unapproved; the examples authorize no fetching. Actor/importer and SQL reuse remain downstream CP2/CP3 evidence.

Run `npm run check` at the root. Synthetic contract vectors live in `tests/contracts/url-normalization.test.ts`; exact byte/collision vectors in `tests/unit/url-identity.test.ts`. See [SPEC-004](../../docs/micro-specs/SPEC-004-url-normalization.md) and [ADR-0003](../../docs/architecture/decisions/ADR-0003-url-identity.md).
