import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { inspectJson, type JsonValue, type Result } from './json.ts';

/** Prevent even inherited serialization hooks from running inside the JCS library. */
function dataSnapshot(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const copy: JsonValue[] = new Array<JsonValue>(value.length);
    for (let index = 0; index < value.length; index++) copy[index] = dataSnapshot(value[index] as JsonValue);
    Object.setPrototypeOf(copy, null);
    return copy;
  }
  const copy = Object.create(null) as Record<string, JsonValue>;
  for (const key of Object.keys(value)) copy[key] = dataSnapshot(value[key] as JsonValue);
  return copy;
}

function digest(value: JsonValue): Result<string> {
  try {
    const serialized = canonicalize(dataSnapshot(value));
    if (serialized === undefined) return { ok: false, issues: [{ path: '', code: 'json_canonicalization' }] };
    return { ok: true, value: createHash('sha256').update(serialized, 'utf8').digest('hex') };
  } catch {
    return { ok: false, issues: [{ path: '', code: 'json_canonicalization' }] };
  }
}

export function fingerprint(value: unknown): Result<string> {
  const inspected = inspectJson(value);
  return inspected.ok ? digest(inspected.value) : inspected;
}

export function manifestFingerprint(value: unknown): Result<string> {
  const inspected = inspectJson(value);
  if (!inspected.ok) return inspected;
  if (inspected.value === null || typeof inspected.value !== 'object' || Array.isArray(inspected.value)) {
    return { ok: false, issues: [{ path: '', code: 'json_manifest_object' }] };
  }
  const manifest = Object.create(null) as Record<string, JsonValue>;
  for (const key of Object.keys(inspected.value)) {
    if (key !== 'manifest_fingerprint') manifest[key] = inspected.value[key] as JsonValue;
  }
  return digest(manifest);
}

export function compareEvents<Previous extends { event_id: string }, Incoming extends { event_id: string }>(previous: Previous, incoming: Incoming): Result<'new_event' | 'replay' | 'conflict'> {
  const left = fingerprint(previous);
  const right = fingerprint(incoming);
  if (!left.ok) return left;
  if (!right.ok) return right;
  if (previous === null || typeof previous !== 'object' || Array.isArray(previous) || incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: false, issues: [{ path: '/event_id', code: 'json_event_identity' }] };
  }
  const previousId: unknown = Object.getOwnPropertyDescriptor(previous, 'event_id')?.value;
  const incomingId: unknown = Object.getOwnPropertyDescriptor(incoming, 'event_id')?.value;
  if (typeof previousId !== 'string' || typeof incomingId !== 'string') {
    return { ok: false, issues: [{ path: '/event_id', code: 'json_event_identity' }] };
  }
  return { ok: true, value: previousId !== incomingId ? 'new_event' : left.value === right.value ? 'replay' : 'conflict' };
}
