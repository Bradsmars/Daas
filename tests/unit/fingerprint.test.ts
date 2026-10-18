import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compareEvents, fingerprint, manifestFingerprint } from '../../packages/contracts/src/fingerprint.ts';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

describe('RFC 8785 event fingerprinting', () => {
  it('hashes canonical object key order recursively, not the insertion order', () => {
    const left = { z: 2, a: { y: false, b: 1 }, array: ['b', 'a'] };
    const right = { array: ['b', 'a'], a: { b: 1, y: false }, z: 2 };
    const expected = sha256('{"a":{"b":1,"y":false},"array":["b","a"],"z":2}');
    expect(fingerprint(left)).toEqual({ ok: true, value: expected });
    expect(fingerprint(right)).toEqual({ ok: true, value: expected });
  });

  it('uses ECMAScript number serialization including negative zero and exponents', () => {
    expect(fingerprint([Number('333333333.33333329'), 1e30, 4.50, 2e-3, 1e-27, -0])).toEqual({
      ok: true,
      value: sha256('[333333333.3333333,1e+30,4.5,0.002,1e-27,0]'),
    });
  });

  it('sorts member names by UTF-16 units and preserves Unicode strings', () => {
    const names = ['\r', '1', '\u0080', 'ö', '€', '😀', 'דּ'];
    const value = Object.fromEntries([...names].reverse().map((name) => [name, name]));
    const expected = `{${names.map((name) => `${JSON.stringify(name)}:${JSON.stringify(name)}`).join(',')}}`;
    expect(fingerprint(value)).toEqual({ ok: true, value: sha256(expected) });
    expect(fingerprint('é')).not.toEqual(fingerprint('e\u0301'));
  });

  it('preserves array order and every envelope field', () => {
    expect(fingerprint({ event_id: 'event-a', records: [1, 2] })).not.toEqual(fingerprint({ event_id: 'event-a', records: [2, 1] }));
    expect(fingerprint({ event_id: 'event-a', observed_at: 'original' })).not.toEqual(fingerprint({ event_id: 'event-a', observed_at: 'changed' }));
  });

  it('does not mutate or invoke serialization hooks', () => {
    const value = Object.freeze({ b: Object.freeze([2, 1]), a: 'raw' });
    expect(fingerprint(value).ok).toBe(true);
    expect(value).toEqual({ b: [2, 1], a: 'raw' });
    let called = false;
    const withHook = { toJSON() { called = true; return null; } };
    expect(fingerprint(withHook).ok).toBe(false);
    expect(called).toBe(false);
  });

  it('does not consult an inherited serialization getter', () => {
    const original = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON');
    let called = false;
    let result;
    try {
      Object.defineProperty(Object.prototype, 'toJSON', { configurable: true, get() { called = true; return () => null; } });
      result = fingerprint({ a: 1 });
    } finally {
      if (original) Object.defineProperty(Object.prototype, 'toJSON', original);
      else Reflect.deleteProperty(Object.prototype, 'toJSON');
    }
    expect(called).toBe(false);
    expect(result).toEqual({ ok: true, value: sha256('{"a":1}') });
  });

  it.each([undefined, NaN, Infinity, 1n, '\ud800', { invalid: undefined }])('rejects non-JSON input rather than hashing a lossy substitute', (value) => {
    expect(fingerprint(value).ok).toBe(false);
  });
});

describe('manifest fingerprints', () => {
  it('excludes only the own manifest_fingerprint field and keeps every other launch setting', () => {
    const original = { run_id: 'run-a', limits: { requests: 2 }, manifest_fingerprint: 'old-digest' };
    expect(manifestFingerprint(original)).toEqual(fingerprint({ run_id: 'run-a', limits: { requests: 2 } }));
    expect(manifestFingerprint({ ...original, manifest_fingerprint: 'new-digest' })).toEqual(manifestFingerprint(original));
    expect(manifestFingerprint({ ...original, limits: { requests: 3 } })).not.toEqual(manifestFingerprint(original));
    expect(original.manifest_fingerprint).toBe('old-digest');
  });

  it('does not exclude nested fields or lose a __proto__ data key', () => {
    const value = JSON.parse('{"__proto__":"data","nested":{"manifest_fingerprint":"retained"},"manifest_fingerprint":"omit"}') as unknown;
    const expected = JSON.parse('{"__proto__":"data","nested":{"manifest_fingerprint":"retained"}}') as unknown;
    expect(manifestFingerprint(value)).toEqual(fingerprint(expected));
    expect(manifestFingerprint({ nested: { manifest_fingerprint: 'a' } })).not.toEqual(manifestFingerprint({ nested: { manifest_fingerprint: 'b' } }));
  });

  it.each([null, [], 'manifest', 1, { manifest_fingerprint: NaN }])('rejects invalid JSON or a non-object manifest', (value) => {
    expect(manifestFingerprint(value).ok).toBe(false);
  });
});

describe('pure event replay classification', () => {
  const previous = { event_id: 'event-a', records: [{ raw: '019.90', available: false }], metadata: { a: 1, b: 2 } };

  it('recognizes the same full envelope after object-key reordering as replay', () => {
    const incoming = { metadata: { b: 2, a: 1 }, records: [{ available: false, raw: '019.90' }], event_id: 'event-a' };
    expect(compareEvents(previous, incoming)).toEqual({ ok: true, value: 'replay' });
  });

  it('classifies any changed envelope field under the same event ID as conflict', () => {
    expect(compareEvents(previous, { ...previous, metadata: { a: 1, b: 3 } })).toEqual({ ok: true, value: 'conflict' });
    expect(compareEvents(previous, { ...previous, extra: true })).toEqual({ ok: true, value: 'conflict' });
  });

  it('recognizes a new event ID even when business values are identical', () => {
    expect(compareEvents(previous, { ...previous, event_id: 'event-b' })).toEqual({ ok: true, value: 'new_event' });
  });

  it('validates both inputs before classifying different identities', () => {
    expect(compareEvents(previous, { event_id: 'event-b', value: NaN }).ok).toBe(false);
    expect(compareEvents({ event_id: 'event-old', value: undefined }, previous).ok).toBe(false);
  });

  it.each([null, [], 1, {}, { event_id: 1 }])('rejects a JSON value that has no own string event identity without throwing', (value) => {
    expect(compareEvents(value as { event_id: string }, previous).ok).toBe(false);
    expect(compareEvents(previous, value as { event_id: string }).ok).toBe(false);
  });
});
