import { describe, expect, test } from 'vitest';
import { createUrlNormalizer } from '@daas/shared';
import { fingerprint, validateContract } from '@daas/contracts';
import { candidate } from './fixtures.ts';

const policy = {
  source_id: '2', request_context_id: 'synthetic-context-v1', normalization_version: 'fixture-v1',
  mode: 'preserve-v1', allowed_origins: ['https://target.example.test'], allowed_path_prefixes: ['/products'],
} as const;
const normalize = createUrlNormalizer(policy);
const input = (url: string, extra: Record<string, unknown> = {}) => ({ url, request_context_id: policy.request_context_id, normalization_version: policy.normalization_version, ...extra });

function normalized(url: string, extra: Record<string, unknown> = {}) {
  const result = normalize(input(url, extra));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Synthetic golden URL failed normalization.');
  return result.value;
}

describe('SPEC-004-AC-02: source variants retain distinct identity', () => {
  test('meaningful variant query values must not collapse', () => {
    const normalize = createUrlNormalizer(policy);
    const first = normalize({ url: 'https://target.example.test/products/item?variant=A', request_context_id: policy.request_context_id, normalization_version: policy.normalization_version });
    const second = normalize({ url: 'https://target.example.test/products/item?variant=B', request_context_id: policy.request_context_id, normalization_version: policy.normalization_version });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.value.canonical_url).not.toBe(second.value.canonical_url);
  });
});

describe('SPEC-004-AC-01: approved equivalences and byte compatibility', () => {
  test.each([
    ['HTTPS://TARGET.EXAMPLE.TEST:443/products/item', 'https://target.example.test/products/item'],
    ['https://target.example.test/products/a/../item', 'https://target.example.test/products/item'],
    ['https://target.example.test/products/a/%2e%2e/item', 'https://target.example.test/products/item'],
    ['https://target.example.test/products/./item', 'https://target.example.test/products/item'],
  ])('normalizes %s to its explicit standard equivalent', (raw, expected) => {
    const result = normalized(raw);
    expect(result.original_url).toBe(raw);
    expect(result.canonical_url).toBe(expected);
    const repeated = normalized(result.canonical_url);
    expect(repeated.canonical_url).toBe(result.canonical_url);
    expect(repeated.identity_key).toBe(result.identity_key);
    expect(repeated.identity_hash).toBe(result.identity_hash);
  });

  test.each([
    ['../item', 'https://target.example.test/products/category/page', 'https://target.example.test/products/item'],
    ['?variant=A', 'https://target.example.test/products/item', 'https://target.example.test/products/item?variant=A'],
    ['#section', 'https://target.example.test/products/item?variant=A', 'https://target.example.test/products/item?variant=A#section'],
    ['//TARGET.EXAMPLE.TEST:443/products/item', 'https://directory.example.test/list', 'https://target.example.test/products/item'],
  ])('resolves %s only against an explicit validated base', (raw, base_url, expected) => {
    expect(normalized(raw, { base_url }).canonical_url).toBe(expected);
  });

  test('serializes IDN and Unicode using the standard URL parser', () => {
    const custom = createUrlNormalizer({ ...policy, allowed_origins: ['https://xn--bcher-kva.example'], allowed_path_prefixes: ['/'] });
    const result = custom(input('https://bücher.example/über'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.canonical_url).toBe('https://xn--bcher-kva.example/%C3%BCber');
  });

  test('supports canonical IPv6 syntax without making any network-safety claim', () => {
    const custom = createUrlNormalizer({ ...policy, allowed_origins: ['http://[2001:db8::1]:8080'] });
    const result = custom(input('http://[2001:0db8:0:0:0:0:0:1]:8080/products/item'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.canonical_url).toBe('http://[2001:db8::1]:8080/products/item');
  });

  test('exact identity tuple bytes agree with the shared contract fingerprint', () => {
    const result = normalized('https://target.example.test/products/item?variant=A');
    const key = '["daas-url-identity-v1","2","synthetic-context-v1","fixture-v1","https://target.example.test/products/item?variant=A"]';
    expect(result.identity_key).toBe(key);
    expect(Buffer.from(result.identity_key, 'utf8')).toEqual(Buffer.from(key, 'utf8'));
    expect(fingerprint(JSON.parse(key))).toEqual({ ok: true, value: result.identity_hash });
    expect(validateContract('DiscoveryCandidate', { ...candidate, discovered_url: result.original_url, canonical_url: result.canonical_url }).ok).toBe(true);
    expect(normalized('https://target.example.test/products/item?variant=A').identity_hash).toBe(result.identity_hash);
  });
});

describe('SPEC-004-AC-02: preservation, context and trusted configuration', () => {
  test.each([
    ['?variant=A', '?variant=B'], ['?a=1&b=2', '?b=2&a=1'], ['?a=1&a=2', '?a=2&a=1'],
    ['?a', '?a='], ['?a=1&&b=2', '?a=1&b=2'], ['?a=%20', '?a=+'], ['?a=%2f', '?a=%2F'],
    ['', '?'], ['', '#'], ['#route/A', '#route/B'], ['?a=1', '?a=1&'],
  ])('preserves the distinct suffixes %s and %s', (first, second) => {
    const a = normalized(`https://target.example.test/products/item${first}`);
    const b = normalized(`https://target.example.test/products/item${second}`);
    expect(a.canonical_url).not.toBe(b.canonical_url);
    expect(a.identity_key).not.toBe(b.identity_key);
    expect(a.identity_hash).not.toBe(b.identity_hash);
    expect(normalized(a.canonical_url).identity_key).toBe(a.identity_key);
  });

  test.each([
    ['/products/Item', '/products/item'], ['/products/item', '/products/item/'],
    ['/products/item/', '/products/item//'], ['/products/a%2Fb', '/products/a/b'],
    ['/products/a%2fb', '/products/a%2Fb'],
  ])('preserves distinct paths %s and %s', (a, b) => {
    expect(normalized(`https://target.example.test${a}`).identity_hash).not.toBe(normalized(`https://target.example.test${b}`).identity_hash);
  });

  test('treats source, context and policy version as independent identity dimensions', () => {
    const raw = 'https://target.example.test/products/item';
    const original = normalized(raw);
    for (const patch of [{ source_id: '3' }, { request_context_id: 'another-context' }, { normalization_version: 'fixture-v2' }]) {
      const customPolicy = { ...policy, ...patch };
      const custom = createUrlNormalizer(customPolicy);
      const result = custom({ url: raw, request_context_id: customPolicy.request_context_id, normalization_version: customPolicy.normalization_version });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.identity_key).not.toBe(original.identity_key);
    }
  });

  test('snapshots policy configuration and leaves caller input untouched', () => {
    const config = { ...policy, allowed_origins: policy.allowed_origins.map((origin): string => origin), allowed_path_prefixes: [...policy.allowed_path_prefixes] };
    const custom = createUrlNormalizer(config);
    config.allowed_origins[0] = 'https://outside.example.test';
    const request = Object.freeze(input('https://target.example.test/products/item?tracking=retained'));
    const before = structuredClone(request);
    expect(custom(request).ok).toBe(true);
    expect(request).toEqual(before);
    expect(custom(input('https://outside.example.test/products/item')).ok).toBe(false);
  });

  test.each([
    { request_context_id: 'other-context' }, { normalization_version: 'unapproved-v2' },
    { canonical_hint: 'https://target.example.test/products/other' },
    { redirect_url: 'https://target.example.test/products/other' },
  ])('rejects mismatched or unsupported identity overrides', (extra) => {
    expect(normalize(input('https://target.example.test/products/item', extra)).ok).toBe(false);
  });
});

describe('SPEC-004-AC-03: fail-closed syntax, scope and resource limits', () => {
  test.each([null, [], 'not-an-object', {}, { url: 2 }, input('https://target.example.test/products/item', { base_url: null })])('rejects missing fields and non-JSON-contract input types', (value) => {
    expect(normalize(value).ok).toBe(false);
  });

  test('does not invoke getters or accept a caller-selected policy inside a reference', () => {
    let invoked = false;
    const withGetter = Object.defineProperty(input('https://target.example.test/products/item'), 'url', { enumerable: true, get() { invoked = true; return 'https://target.example.test/products/item'; } });
    expect(normalize(withGetter).ok).toBe(false);
    expect(invoked).toBe(false);
    expect(normalize({ ...input('https://target.example.test/products/item'), mode: 'preserve-v1' }).ok).toBe(false);
  });

  test('bounds trusted origin/prefix lists and common source identifiers', () => {
    const origins = [policy.allowed_origins[0], ...Array.from({ length: 9 }, (_, index) => `https://origin${index}.example.test`)];
    const prefixes = [policy.allowed_path_prefixes[0], ...Array.from({ length: 9 }, (_, index) => `/scope${index}`)];
    expect(createUrlNormalizer({ ...policy, allowed_origins: origins, allowed_path_prefixes: prefixes })(input('https://target.example.test/products/item')).ok).toBe(true);
    expect(() => createUrlNormalizer({ ...policy, allowed_origins: [...origins, 'https://extra.example.test'] })).toThrow('Invalid URL normalization policy.');
    expect(() => createUrlNormalizer({ ...policy, allowed_path_prefixes: [...prefixes, '/extra'] })).toThrow('Invalid URL normalization policy.');
    expect(() => createUrlNormalizer({ ...policy, allowed_origins: [origins[0], origins[0]] })).toThrow('Invalid URL normalization policy.');
    const custom = createUrlNormalizer({ ...policy, source_id: '9223372036854775807', request_context_id: 'a'.repeat(128), normalization_version: 'b'.repeat(128) });
    const result = custom(input('https://target.example.test/products/item', { request_context_id: 'a'.repeat(128), normalization_version: 'b'.repeat(128) }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.source_id).toBe('9223372036854775807');
    expect(() => createUrlNormalizer({ ...policy, request_context_id: 'a'.repeat(129) })).toThrow('Invalid URL normalization policy.');
    expect(() => createUrlNormalizer({ ...policy, normalization_version: 'b'.repeat(129) })).toThrow('Invalid URL normalization policy.');
  });

  test('validates base-length bounds even for an absolute target that ignores the base', () => {
    const prefix = 'https://directory.example.test/';
    const base_url = prefix + 'x'.repeat(2048 - prefix.length);
    expect(normalize(input('https://target.example.test/products/item', { base_url })).ok).toBe(true);
    expect(normalize(input('https://target.example.test/products/item', { base_url: base_url + 'x' })).ok).toBe(false);
  });

  test.each([
    '', '/products/item', 'item', '//target.example.test/products/item',
    'ftp://target.example.test/products/item', 'javascript:alert(1)', 'https:target.example.test/products/item',
    'https:///target.example.test/products/item', 'https://target.example.test\\products\\item',
    'https://user:secret@target.example.test/products/item', 'https://@target.example.test/products/item',
    'https://target.example.test/products/ bad', 'https://target.example.test/products/\nitem',
    'https://target.example.test/products/\u0085item', 'https://target.example.test/products/%zz',
    'https://target.example.test/products/item?x=%', 'https://target.example.test/products/\ud800',
    'https://outside.example.test/products/item', 'http://target.example.test/products/item',
    'https://target.example.test:444/products/item', 'https://target.example.test/products-other/item',
    'https://target.example.test/products/../private/item', 'https://target.example.test/products/%2e%2e/private/item',
  ])('rejects malformed, unbased or out-of-scope reference %j', (url) => {
    const result = normalize(input(url));
    expect(result.ok).toBe(false);
  });

  test.each(['relative/base', 'ftp://target.example.test/', 'https://@target.example.test/', 'https://target.example.test/%zz'])('rejects an invalid explicit base %s', (base_url) => {
    expect(normalize(input('https://target.example.test/products/item', { base_url })).ok).toBe(false);
  });

  test('applies exact raw and serialized URL bounds without truncation', () => {
    const prefix = 'https://target.example.test/products/';
    const boundary = prefix + 'x'.repeat(2048 - prefix.length);
    expect(normalize(input(boundary)).ok).toBe(true);
    expect(normalize(input(boundary + 'x')).ok).toBe(false);
    const expansion = prefix + 'é'.repeat(400);
    expect([...expansion].length).toBeLessThan(2048);
    expect(normalize(input(expansion)).ok).toBe(false);
  });

  test.each([
    { source_id: '0' }, { source_id: '02' }, { source_id: '9223372036854775808' },
    { mode: 'drop-tracking' }, { allowed_origins: [] }, { allowed_origins: ['https://TARGET.example.test'] },
    { allowed_origins: ['https://target.example.test/'] }, { allowed_origins: ['https://@target.example.test'] },
    { allowed_path_prefixes: [] }, { allowed_path_prefixes: ['/products/../private'] },
    { allowed_path_prefixes: ['products'] }, { request_context_id: '' }, { normalization_version: '' },
    { drop_query_parameters: ['tracking'] },
  ])('rejects invalid or unsupported trusted configuration', (patch) => {
    expect(() => createUrlNormalizer({ ...policy, ...patch })).toThrow('Invalid URL normalization policy.');
  });

  test('never includes a rejected URL, credential or arbitrary key in diagnostics', () => {
    const secret = 'SENSITIVE_SENTINEL_SPEC004';
    for (const extra of [{ url: `https://user:${secret}@target.example.test/products/item` }, { [secret]: true }]) {
      const result = normalize({ ...input('https://target.example.test/products/item'), ...extra });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain('https://');
    }
  });
});
