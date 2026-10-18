# ADR-0003 - Source-independent URL identity with explicit trusted policy

Status: accepted for SPEC-004's scoped offline implementation start.
Date: 18 October 2026. Authority: user. Owner: Codex.
Affected: [SPEC-004 v0.2](../../micro-specs/SPEC-004-url-normalization.md), downstream 003/007/008/015.

The user authorised reviewing and starting the next implementation after merging SPEC-002 into dev, then explicitly selected “Implement the shared module with synthetic fixtures first (Recommended)”. That approval resolves the offline scope, not the first site's URL rules or permission to crawl.

Implement a caller-supplied immutable source/context/version/origin/path policy and one named `preserve-v1` mode. Use Node's standard URL parser/serializer; retain path case, raw serialized query ordering/duplicates/escapes, routing fragments and slash distinctions. Standard host case/default-port/IDNA/dot-segment equivalences apply. Do not invent tracking-removal lists, query sorting, canonical-tag/redirect alias merging, a source registry or a rule language. Additional transformations require approved vectors and explicit version/migration review.

Identity lookup uses SHA-256 of UTF-8 canonical JSON string tuple `["daas-url-identity-v1",source_id,request_context_id,normalization_version,canonical_url]`. SPEC-002's fingerprint helper hashes the same tuple; JSON string-array serialization has identical RFC 8785 bytes. Retain `identity_key` exactly and compare its UTF-8 bytes independently of SQL collation. Digest match with unequal identity is a collision, never proof of equality; inconsistent digests for identical identity fail explicitly. No hash injection seam is added to production code.

Reuse the existing finite contract bounds and exact scalar conventions; additionally bound allowed origins/path prefixes to 10 each and the serialized identity to 4,096 UTF-8 bytes. Trusted configuration is validated and snapshotted. Relative references require a syntactically valid explicit HTTP(S) base; final resolved targets must match policy. Reject unsafe or ambiguous syntax with fixed, value-free diagnostic codes. No network, clock, DNS or database operations occur.

Alternative: wait for a real source before reusable identity engineering. The approved synthetic scope permits useful deterministic shared behavior without making source-specific assumptions. A configurable rewriting system would add unsupported policy choices; the single preservation mode meets the first boundary's needs and can be used for a real source only after approval.

D-02 real source, D-05 real parameter/fragment/slash/alias/rekey policy, D-03 SQL collision/index implementation and D-07 live budgets remain open. Syntactic scope is not SSRF protection: SPEC-016 must enforce actual DNS/connections/redirects/browser egress. Actor/importer reuse and SQL collision behavior are later CP2/CP3 checks; current verification uses synthetic vectors and real shared libraries. Commit/push/merge/deployment approval is not included.

Technical reference: the [WHATWG URL Standard](https://url.spec.whatwg.org/) defines parser/serializer idempotence, host/URL parsing and the URL API. Runtime vectors verify the pinned Node 24 behavior; no assumption about hosted Actor runtime compatibility is made here.
