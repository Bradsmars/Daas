import { describe, expect, it } from 'vitest';
import { fingerprint } from '@daas/contracts';
import { compareUrlIdentities, identityForValidatedUrl, type UrlIdentity } from '../../packages/shared/src/url-identity.ts';

const parts = {
  source_id: '1', request_context_id: 'synthetic:uk',
  normalization_version: 'preserve-v1', canonical_url: 'https://example.test/products/Widget?variant=A',
};

function identity(overrides: Partial<typeof parts> = {}): UrlIdentity {
  const built = identityForValidatedUrl({ ...parts, ...overrides });
  if (!built.ok) throw new Error('Synthetic identity must validate');
  return built.value;
}

describe('URL identity bytes and collision handling', () => {
  it('matches fixed canonical tuple bytes and a separately calculated SHA-256 vector', () => {
    const built = identity();
    const key = '["daas-url-identity-v1","1","synthetic:uk","preserve-v1","https://example.test/products/Widget?variant=A"]';
    expect(built).toEqual({ identity_key: key, identity_hash: '37324637bba2b339e0e6a277c3c6995648550ed4b0ba77af8c0e567d922b07a6' });
    expect(Buffer.byteLength(built.identity_key, 'utf8')).toBe(106);
    expect(fingerprint(JSON.parse(key) as unknown)).toEqual({ ok: true, value: built.identity_hash });
  });

  it('hashes Unicode as exact UTF-8 rather than UTF-16 or escaped JSON substitutions', () => {
    const built = identity({ canonical_url: 'https://example.test/\u96ea/\ud83d\ude00' });
    const key = '["daas-url-identity-v1","1","synthetic:uk","preserve-v1","https://example.test/\u96ea/\ud83d\ude00"]';
    expect(built.identity_key).toBe(key);
    expect(Buffer.byteLength(built.identity_key, 'utf8')).toBe(89);
    expect(built.identity_hash).toBe('e7d1e45122a7d161b4b3855570070046fdd5ab4141a8438baf7dba48fb2160a5');
    expect(fingerprint(['daas-url-identity-v1', '1', 'synthetic:uk', 'preserve-v1', 'https://example.test/\u96ea/\ud83d\ude00'])).toEqual({ ok: true, value: built.identity_hash });
  });

  it('keeps colon-bearing context/version tuples distinct instead of joining ambiguous delimiters', () => {
    const first = identity({ request_context_id: 'synthetic:uk', normalization_version: 'v1' });
    const second = identity({ request_context_id: 'synthetic', normalization_version: 'uk:v1' });
    expect(first.identity_key).not.toBe(second.identity_key);
  });

  it('reports a matching digest with unequal exact keys as a collision rather than equality', () => {
    const first = identity();
    const second = { ...identity({ canonical_url: 'https://example.test/products/Widget?variant=B' }), identity_hash: first.identity_hash };
    expect(compareUrlIdentities(first, second)).toEqual({ ok: true, value: 'hash_collision' });
    expect(compareUrlIdentities(second, first)).toEqual({ ok: true, value: 'hash_collision' });
  });

  it('keeps each source, context, version and canonical URL dimension in both key and hash', () => {
    const variants = [identity(), identity({ source_id: '2' }), identity({ request_context_id: 'synthetic:us' }), identity({ normalization_version: 'preserve-v2' }), identity({ canonical_url: `${parts.canonical_url}&variant=B` })];
    expect(new Set(variants.map((variant) => variant.identity_key)).size).toBe(5);
    expect(new Set(variants.map((variant) => variant.identity_hash)).size).toBe(5);
  });

  it('returns same for independently created equal identities and different for unequal hashes/keys', () => {
    expect(compareUrlIdentities(identity(), identity())).toEqual({ ok: true, value: 'same' });
    expect(compareUrlIdentities(identity(), identity({ source_id: '2' }))).toEqual({ ok: true, value: 'different' });
  });

  it('rejects inconsistent digests for an identical key instead of silently choosing one', () => {
    const first = identity();
    const second = { ...first, identity_hash: '0'.repeat(64) };
    expect(compareUrlIdentities(first, second)).toEqual({ ok: false, issues: [{ path: '/identity_hash', code: 'inconsistent_identity_hash' }] });
  });

  it('accepts the full positive SQL BIGINT and identifier boundaries without losing precision', () => {
    expect(identity({ source_id: '9223372036854775807', request_context_id: 'a'.repeat(128), normalization_version: 'b'.repeat(128) }).identity_key).toContain('9223372036854775807');
  });

  it('enforces the key limit in UTF-8 bytes at the boundary and boundary plus one', () => {
    const baseUrl = 'https://example.test/';
    const remaining = 4096 - Buffer.byteLength(identity({ canonical_url: baseUrl }).identity_key, 'utf8');
    const url = baseUrl + '\u96ea'.repeat(Math.floor(remaining / 3)) + 'a'.repeat(remaining % 3);
    const bounded = identity({ canonical_url: url });
    expect(Buffer.byteLength(bounded.identity_key, 'utf8')).toBe(4096);
    expect(compareUrlIdentities(bounded, bounded)).toEqual({ ok: true, value: 'same' });
    expect(identityForValidatedUrl({ ...parts, canonical_url: `${url}a` })).toEqual({ ok: false, issues: [{ path: '/identity_key', code: 'identity_key_limit' }] });
    expect(compareUrlIdentities({ ...bounded, identity_key: `${bounded.identity_key}a` }, bounded)).toEqual({ ok: false, issues: [{ path: '/identity_key', code: 'identity_key_limit' }] });
  });

  it('does not normalize Unicode strings or collapse canonical URL string variants', () => {
    const composed = identity({ canonical_url: 'https://example.test/\u00e9' });
    const decomposed = identity({ canonical_url: 'https://example.test/e\u0301' });
    expect(compareUrlIdentities(composed, decomposed)).toEqual({ ok: true, value: 'different' });
    expect(composed.identity_hash).not.toBe(decomposed.identity_hash);
  });

  it('does not modify frozen configuration or comparison metadata', () => {
    const original = Object.freeze({ ...parts });
    const built = identityForValidatedUrl(original);
    expect(built.ok).toBe(true);
    expect(original).toEqual(parts);
    const first = Object.freeze(identity());
    expect(compareUrlIdentities(first, first)).toEqual({ ok: true, value: 'same' });
  });

  it.each(['0', '-1', '01', '1.0', '9223372036854775808', '99999999999999999999', 1, null])('rejects invalid source identity %s with a value-free reason', (source_id) => {
    const built = identityForValidatedUrl({ ...parts, source_id } as typeof parts);
    expect(built).toEqual({ ok: false, issues: [{ path: '/source_id', code: 'identity_source_id' }] });
  });

  it.each([
    ['request_context_id', 'a'.repeat(129)], ['request_context_id', ''], ['request_context_id', 'unapproved space'],
    ['normalization_version', 'b'.repeat(129)], ['normalization_version', ''], ['normalization_version', null],
    ['canonical_url', 'https://example.test/' + 'a'.repeat(2048)], ['canonical_url', 'ftp://example.test/'], ['canonical_url', null],
  ] as const)('rejects invalid bounded scalar %s', (field, value) => {
    expect(identityForValidatedUrl({ ...parts, [field]: value } as typeof parts).ok).toBe(false);
  });

  it.each([null, [], 'url', { ...parts, unexpected: 'secret' }, { source_id: '1' }, { ...parts, canonical_url: '\ud800' }, { ...parts, source_id: undefined }])('rejects non-JSON or incorrect builder shapes safely', (value) => {
    const built = identityForValidatedUrl(value as typeof parts);
    expect(built.ok).toBe(false);
    expect(JSON.stringify(built)).not.toContain('secret');
  });

  it.each([null, [], 'metadata', { identity_key: 'malformed', identity_hash: 'secret' }, { identity_hash: '0'.repeat(64) }])('rejects malformed comparison metadata on either side', (value) => {
    const invalid = value as UrlIdentity;
    expect(compareUrlIdentities(invalid, identity()).ok).toBe(false);
    expect(compareUrlIdentities(identity(), invalid).ok).toBe(false);
  });

  it.each(['', '0'.repeat(63), '0'.repeat(65), 'A'.repeat(64), 'g'.repeat(64)])('rejects non-canonical SHA-256 metadata %s', (identity_hash) => {
    expect(compareUrlIdentities(identity(), { ...identity(), identity_hash })).toEqual({ ok: false, issues: [{ path: '/identity_hash', code: 'identity_hash_format' }] });
  });

  it.each([
    'not-json', '{}', 'null', '[]', '["unknown", "1", "synthetic:uk", "v1", "https://example.test/"]',
    '["daas-url-identity-v1","1","synthetic:uk","v1","https://example.test/","extra"]',
    '["daas-url-identity-v1",1,"synthetic:uk","v1","https://example.test/"]',
    '["daas-url-identity-v1","1",{},"v1","https://example.test/"]',
    '["daas-url-identity-v1","1","synthetic:uk","v1","https://example.test/\\ud800"]',
    '["daas-url-identity-v1", "1", "synthetic:uk", "v1", "https://example.test/"]',
    '["\\u0064aas-url-identity-v1","1","synthetic:uk","v1","https://example.test/"]',
  ])('rejects invalid or non-canonical exact identity-key serialization', (identity_key) => {
    expect(compareUrlIdentities(identity(), { ...identity(), identity_key })).toEqual({ ok: false, issues: [{ path: '/identity_key', code: 'identity_key_format' }] });
  });

  it('requires the metadata pair explicitly instead of accepting unrelated normalized fields', () => {
    const extra = { ...identity(), original_url: 'do-not-copy-into-diagnostic' };
    expect(compareUrlIdentities(extra, identity())).toEqual({ ok: false, issues: [{ path: '', code: 'identity_metadata_shape' }] });
  });

  it('rejects accessors and proxies without invoking their traps', () => {
    let called = false;
    const accessor = Object.defineProperty({ ...parts }, 'source_id', { enumerable: true, get() { called = true; return '1'; } });
    expect(identityForValidatedUrl(accessor).ok).toBe(false);
    const accessorMetadata = Object.defineProperty({ ...identity() }, 'identity_key', { enumerable: true, get() { called = true; return 'private'; } });
    expect(compareUrlIdentities(accessorMetadata, identity()).ok).toBe(false);
    const proxy = new Proxy(identity(), { ownKeys() { called = true; throw new Error('must not execute'); } });
    expect(compareUrlIdentities(proxy, identity()).ok).toBe(false);
    expect(called).toBe(false);
  });

  it('does not execute inherited JSON serialization hooks', () => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON');
    let called = false;
    let built;
    let compared;
    try {
      Object.defineProperty(Object.prototype, 'toJSON', { configurable: true, get() { called = true; return () => 'wrong-bytes'; } });
      built = identityForValidatedUrl(parts);
      if (built.ok) compared = compareUrlIdentities(built.value, built.value);
    } finally {
      if (previous) Object.defineProperty(Object.prototype, 'toJSON', previous);
      else Reflect.deleteProperty(Object.prototype, 'toJSON');
    }
    expect(called).toBe(false);
    expect(built).toEqual({ ok: true, value: identity() });
    expect(compared).toEqual({ ok: true, value: 'same' });
  });
});
