import { describe, expect, it } from 'vitest';
import { createEvidenceReferenceValidator, validateEvidencePolicy } from '../../packages/shared/src/evidence-security.ts';

function policy() {
  return {
    policy_id: 'fixture-evidence', policy_version: 'v1', required: true, retention_seconds: 3600,
    locations: [{ storage_provider: 'fixture', location_id: 'local-fixture', retention_class: 'hour', key_prefix: 'scope/', max_bytes: 1024 }],
  };
}
function owner() { return { request_context_id: 'fixture-context', object_key_prefix: 'scope/run-1/' }; }
function reference() {
  return {
    schema_version: 1, storage_provider: 'fixture', location_id: 'local-fixture', object_key: 'scope/run-1/response.html',
    sha256: 'a'.repeat(64), byte_length: 12, content_type: 'text/html', captured_at: '2026-10-18T00:00:00Z',
    kind: 'fixture', retention_class: 'hour', policy_id: 'fixture-evidence', policy_version: 'v1', request_context_id: 'fixture-context',
  };
}
function validator() {
  const result = createEvidenceReferenceValidator(policy(), owner());
  if (!result.ok) throw new Error('Expected fixture policy.');
  return result.value;
}

describe('evidence location and ownership boundaries', () => {
  it('denies valid descriptor bytes belonging to another owner prefix', () => {
    expect(validator()({ ...reference(), object_key: 'scope/run-2/response.html' }).ok).toBe(false);
  });

  it('accepts an owned descriptor in an explicitly permitted location', () => {
    expect(validator()(reference())).toEqual({ ok: true, value: reference() });
  });

  it.each([
    ['storage_provider', 'arbitrary-store'], ['location_id', 'arbitrary-location'], ['retention_class', 'forever'],
    ['policy_id', 'other-policy'], ['policy_version', 'v2'], ['request_context_id', 'other-context'],
    ['byte_length', 1025], ['object_key', 'scoped/run-1/response.html'], ['object_key', 'scope/run-1-other/response.html'],
    ['object_key', 'scope/run-1'], ['object_key', '/scope/run-1/response.html'],
    ['object_key', 'https://example.test/scope/run-1/response.html'], ['object_key', 'scope/run-1/../run-2/file'],
    ['object_key', 'scope/run-1/%2e%2e/file'], ['object_key', 'scope/run-1//file'], ['object_key', 'scope/run-1/./file'],
    ['object_key', 'scope/run-1/file?token=canary'], ['object_key', 'scope/run-1/file\\name'],
  ])('denies descriptor mismatch or unsafe %s %#', (field, value) => {
    expect(validator()({ ...reference(), [field]: value }).ok).toBe(false);
  });

  it('accepts the configured byte cap exactly and zero-length stored content', () => {
    expect(validator()({ ...reference(), byte_length: 1024 }).ok).toBe(true);
    expect(validator()({ ...reference(), byte_length: 0 }).ok).toBe(true);
  });

  it('snapshots configuration and ownership instead of trusting later caller mutations', () => {
    const mutablePolicy = policy();
    const mutableOwner = owner();
    const result = createEvidenceReferenceValidator(mutablePolicy, mutableOwner);
    if (!result.ok) throw new Error('Expected fixture policy.');
    mutablePolicy.locations[0]!.key_prefix = 'other/';
    mutablePolicy.locations[0]!.max_bytes = 1;
    mutableOwner.object_key_prefix = 'scope/run-2/';
    expect(result.value(reference()).ok).toBe(true);
    expect(result.value({ ...reference(), object_key: 'scope/run-2/response.html' }).ok).toBe(false);
  });

  it('requires an owner prefix inside an approved location prefix', () => {
    expect(createEvidenceReferenceValidator(policy(), { ...owner(), object_key_prefix: 'elsewhere/' }).ok).toBe(false);
    expect(createEvidenceReferenceValidator(policy(), { ...owner(), object_key_prefix: 'scope/' }).ok).toBe(true);
    expect(createEvidenceReferenceValidator(policy(), { ...owner(), extra: true }).ok).toBe(false);
  });

  it('supports explicitly disabled evidence but accepts no descriptors', () => {
    const disabled = { ...policy(), required: false, locations: [], retention_seconds: 0 };
    expect(validateEvidencePolicy(disabled).ok).toBe(true);
    const result = createEvidenceReferenceValidator(disabled, owner());
    if (!result.ok) throw new Error('Expected explicitly disabled policy.');
    expect(result.value(reference()).ok).toBe(false);
  });

  it('returns frozen policy and descriptor snapshots', () => {
    const result = validateEvidencePolicy(policy());
    if (!result.ok) throw new Error('Expected fixture policy.');
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.locations)).toBe(true);
    expect(Object.isFrozen(result.value.locations[0])).toBe(true);
    const input = reference();
    const accepted = validator()(input);
    if (!accepted.ok) throw new Error('Expected fixture descriptor.');
    input.object_key = 'elsewhere/file';
    expect(accepted.value.object_key).toBe('scope/run-1/response.html');
    expect(Object.isFrozen(accepted.value)).toBe(true);
  });
});

describe('evidence policy configuration', () => {
  it.each([
    undefined, null, {}, { ...policy(), extra: true }, { ...policy(), required: 'true' },
    { ...policy(), retention_seconds: -1 }, { ...policy(), retention_seconds: 31_536_001 },
    { ...policy(), retention_seconds: 1.5 }, { ...policy(), retention_seconds: '3600' },
    { ...policy(), retention_seconds: 0 }, { ...policy(), required: false, retention_seconds: 0 },
    { ...policy(), locations: [] }, { ...policy(), required: false, locations: [] },
    { ...policy(), locations: Array.from({ length: 11 }, () => policy().locations[0]) },
    { ...policy(), locations: [...policy().locations, { ...policy().locations[0], retention_class: 'other' }] },
    ...[0, -1, 1_048_577, '1024'].map((max_bytes) => ({ ...policy(), locations: [{ ...policy().locations[0], max_bytes }] })),
  ])('rejects invalid or inconsistent policy %#', (input) => {
    expect(validateEvidencePolicy(input).ok).toBe(false);
  });

  it.each(['/', '../', 'scope/../', 'scope/./', 'scope//', 'scope', '/scope/', 'scope/%2e/', 'https://host/', 'C:\\folder\\', 'scope/?/', 'scope/#/', 'scope/é/', 'a'.repeat(512) + '/'])('rejects unsafe key prefix %s', (key_prefix) => {
    expect(validateEvidencePolicy({ ...policy(), locations: [{ ...policy().locations[0], key_prefix }] }).ok).toBe(false);
    expect(createEvidenceReferenceValidator(policy(), { ...owner(), object_key_prefix: key_prefix }).ok).toBe(false);
  });

  it('accepts nested prefixes, upper-case paths and finite maximums without rewriting', () => {
    const input = { ...policy(), retention_seconds: 31_536_000, locations: [{ ...policy().locations[0], key_prefix: 'Scope/a_b-1.2/', max_bytes: 1_048_576 }] };
    expect(validateEvidencePolicy(input)).toEqual({ ok: true, value: input });
  });

  it('rejects getters/proxies without executing them and emits only fixed diagnostics', () => {
    let invoked = false;
    const input = { ...policy(), get secretCanary() { invoked = true; return 'secret-value-canary'; } };
    const result = validateEvidencePolicy(input);
    expect(result.ok).toBe(false);
    expect(invoked).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
    const proxy = new Proxy(owner(), { ownKeys() { invoked = true; return []; } });
    expect(createEvidenceReferenceValidator(policy(), proxy).ok).toBe(false);
    expect(invoked).toBe(false);
  });
});
