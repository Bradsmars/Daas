import { describe, expect, it, vi } from 'vitest';
import { inspectJson, JSON_LIMITS, parseJson, type JsonValue } from '../../packages/contracts/src/json.ts';

function nestedArrays(depth: number): JsonValue {
  let value: JsonValue = null;
  for (let index = 0; index < depth; index++) value = [value];
  return value;
}

function exactByteLimit(): string[] {
  const fullString = 'x'.repeat(JSON_LIMITS.maxStringLength);
  const count = Math.floor((JSON_LIMITS.maxBytes - 2) / (fullString.length + 3));
  const values = Array.from({ length: count }, () => fullString);
  const remaining = JSON_LIMITS.maxBytes - Buffer.byteLength(JSON.stringify(values), 'utf8') - 3;
  values.push('x'.repeat(remaining));
  return values;
}

describe('plain JSON inspection', () => {
  it('preserves the original reference and all JSON values without coercion', () => {
    const value = Object.freeze({ raw: ' 019.90 ', zero: 0, negativeZero: -0, available: false, missing: null, items: [true, '😀'] });
    const result = inspectJson(value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(value);
    expect(Object.is(value.negativeZero, -0)).toBe(true);
  });

  it.each([null, true, false, 0, 1.25, '', '€😀'])('accepts the scalar %j', (value) => {
    expect(inspectJson(value)).toEqual({ ok: true, value });
  });

  it('accepts null-prototype data and shared references that are not cycles', () => {
    const shared = { field: 'unchanged' };
    const value = Object.create(null) as Record<string, unknown>;
    value['__proto__'] = 'ordinary data';
    value['left'] = shared;
    value['right'] = shared;
    const result = inspectJson(value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(value);
  });

  it.each([undefined, NaN, Infinity, -Infinity, 1n, Symbol('private'), () => 1])('rejects non-JSON scalars (%s)', (value) => {
    expect(inspectJson(value).ok).toBe(false);
  });

  it.each([new Date(0), /pattern/, new Map(), new Set(), Object.create({ inherited: true })])('rejects non-plain objects', (value) => {
    expect(inspectJson(value).ok).toBe(false);
  });

  it('rejects class instances and array subclasses', () => {
    class DomainObject { field = 1; }
    class DomainArray extends Array<number> {}
    expect(inspectJson(new DomainObject()).ok).toBe(false);
    expect(inspectJson(new DomainArray()).ok).toBe(false);
  });

  it('rejects accessors without invoking them', () => {
    const getter = vi.fn(() => 'must not execute');
    const value = Object.defineProperty({}, 'secret', { get: getter, enumerable: true });
    expect(inspectJson(value).ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects toJSON callbacks without invoking them', () => {
    const toJSON = vi.fn(() => 'not the original data');
    expect(inspectJson({ toJSON }).ok).toBe(false);
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('rejects proxies before invoking inspection traps', () => {
    const trap = vi.fn(() => { throw new Error('trap invoked'); });
    const value = new Proxy({}, { ownKeys: trap, getPrototypeOf: trap });
    expect(inspectJson(value).ok).toBe(false);
    expect(trap).not.toHaveBeenCalled();
  });

  it('rejects cycles rather than overflowing the stack', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;
    expect(inspectJson(value).ok).toBe(false);
  });

  it('rejects symbol and non-enumerable members rather than silently ignoring them', () => {
    expect(inspectJson({ [Symbol('hidden')]: 1 }).ok).toBe(false);
    expect(inspectJson(Object.defineProperty({}, 'hidden', { value: 1 })).ok).toBe(false);
    expect(inspectJson({ nested: undefined }).ok).toBe(false);
  });

  it('rejects sparse arrays, accessor elements and non-index array properties', () => {
    const withProperty: unknown[] & { extra?: boolean } = [];
    withProperty.extra = true;
    const getter = vi.fn(() => 1);
    const withGetter = Object.defineProperty([0], '0', { get: getter });
    expect(inspectJson(new Array(2)).ok).toBe(false);
    expect(inspectJson(withProperty).ok).toBe(false);
    expect(inspectJson(withGetter).ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(['\ud800', '\udfff', 'prefix\ud800suffix', '\udc00\ud800'])('rejects lone surrogates in values and member names', (value) => {
    expect(inspectJson(value).ok).toBe(false);
    expect(inspectJson({ [value]: 1 }).ok).toBe(false);
  });

  it('enforces UTF-16 string limits for member names and values', () => {
    const boundary = '😀'.repeat(JSON_LIMITS.maxStringLength / 2);
    expect(inspectJson(boundary).ok).toBe(true);
    expect(inspectJson(`${boundary}x`).ok).toBe(false);
    expect(inspectJson({ ['k'.repeat(JSON_LIMITS.maxStringLength + 1)]: null }).ok).toBe(false);
  });

  it('counts the root container as depth one', () => {
    expect(inspectJson(nestedArrays(JSON_LIMITS.maxDepth)).ok).toBe(true);
    expect(inspectJson(nestedArrays(JSON_LIMITS.maxDepth + 1)).ok).toBe(false);
  });

  it('bounds object members across the entire message', () => {
    const value = { nested: Object.fromEntries(Array.from({ length: JSON_LIMITS.maxMembers - 1 }, (_, index) => [`key${index}`, null])) };
    expect(inspectJson(value).ok).toBe(true);
    Object.assign(value.nested, { extra: null });
    expect(inspectJson(value).ok).toBe(false);
  });

  it('enforces the exact UTF-8 serialized byte limit, including escaping', () => {
    const value = exactByteLimit();
    expect(Buffer.byteLength(JSON.stringify(value), 'utf8')).toBe(JSON_LIMITS.maxBytes);
    expect(inspectJson(value).ok).toBe(true);
    value[value.length - 1] += 'x';
    expect(inspectJson(value).ok).toBe(false);
    expect(inspectJson(Array.from({ length: 100 }, () => '\u0000'.repeat(JSON_LIMITS.maxStringLength))).ok).toBe(false);
    expect(inspectJson(Array.from({ length: 64 }, () => '€'.repeat(JSON_LIMITS.maxStringLength))).ok).toBe(false);
  });

  it('returns only fixed safe diagnostics, without rejected values or arbitrary keys', () => {
    const result = inspectJson({ 'sensitive-customer-name': () => 'canary-secret-value' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/sensitive-customer-name|canary-secret-value/);
  });
});

describe('strict bounded raw JSON parsing', () => {
  it('parses JSON data without normalization and preserves __proto__ as a data member', () => {
    const result = parseJson('{"__proto__":{"polluted":true},"raw":" 019.90 ","zero":0,"available":false}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    expect(Object.hasOwn(result.value as object, '__proto__')).toBe(true);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(result.value).toEqual(JSON.parse('{"__proto__":{"polluted":true},"raw":" 019.90 ","zero":0,"available":false}'));
  });

  it.each([
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"nested":{"same":1,"same":2}}',
    '{"__proto__":1,"\\u005f_proto__":2}',
  ])('rejects duplicate decoded keys in the same object: %s', (text) => {
    expect(parseJson(text).ok).toBe(false);
  });

  it('allows the same key in different objects', () => {
    expect(parseJson('{"same":1,"nested":{"same":2},"items":[{"same":3},{"same":4}]}').ok).toBe(true);
  });

  it.each(['', 'undefined', '{', 'true false', '{"a":1,}', '[1,]', '{/*comment*/"a":1}', '// comment\n{}', '{"a":NaN}', '{"a":1e999}'])('rejects malformed, non-finite or non-strict JSON', (text) => {
    expect(parseJson(text).ok).toBe(false);
  });

  it.each(['"\\ud800"', '{"\\udfff":1}', '"\ud800"'])('rejects invalid Unicode after escape decoding', (text) => {
    expect(parseJson(text).ok).toBe(false);
  });

  it('bounds nesting before ordinary JSON parsing can reach an unsafe depth', () => {
    const text = `${'['.repeat(50_000)}0${']'.repeat(50_000)}`;
    const ordinaryParse = vi.spyOn(JSON, 'parse');
    try {
      expect(parseJson(text)).toEqual({ ok: false, issues: [{ path: '', code: 'json_depth_limit' }] });
      expect(ordinaryParse).not.toHaveBeenCalled();
    } finally {
      ordinaryParse.mockRestore();
    }
  });

  it('applies message, string and member bounds to parsed input', () => {
    expect(parseJson(JSON.stringify(nestedArrays(JSON_LIMITS.maxDepth))).ok).toBe(true);
    expect(parseJson(JSON.stringify('x'.repeat(JSON_LIMITS.maxStringLength + 1))).ok).toBe(false);
    expect(parseJson(' '.repeat(JSON_LIMITS.maxBytes) + 'null').ok).toBe(false);
    const members = Object.fromEntries(Array.from({ length: JSON_LIMITS.maxMembers + 1 }, (_, index) => [`key${index}`, null]));
    expect(parseJson(JSON.stringify(members)).ok).toBe(false);
  });

  it('accepts the exact raw byte boundary and rejects the next byte', () => {
    const value = exactByteLimit();
    expect(parseJson(JSON.stringify(value)).ok).toBe(true);
    value[value.length - 1] += 'x';
    expect(parseJson(JSON.stringify(value)).ok).toBe(false);
  });

  it('does not leak JSON.parse messages, input snippets or property values', () => {
    const result = parseJson('{"sensitive-customer-name":"canary-secret-value",}');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/sensitive-customer-name|canary-secret-value/);
  });
});
