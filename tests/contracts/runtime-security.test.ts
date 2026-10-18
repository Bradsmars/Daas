import { describe, expect, test } from 'vitest';
import { getValidatedRuntime, prepareRuntime } from '../../packages/shared/src/runtime-security.ts';
import { fixtureConfig, fixtureEnvironment } from '../fixtures/runtime-security.ts';

test('SPEC-016-AC-01: missing request budget cannot create runtime state', () => {
  const config = fixtureConfig();
  const incomplete = { ...config, limits: { ...config.limits } };
  Reflect.deleteProperty(incomplete.limits, 'max_requests');
  expect(prepareRuntime(incomplete, fixtureEnvironment).ok).toBe(false);
});

function ready(config: unknown = fixtureConfig(), environment = fixtureEnvironment) {
  const result = prepareRuntime(config, environment);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.value;
}

describe('SPEC-016-AC-01/08: explicit finite startup configuration', () => {
  test('accepts the approved controlled ceiling profile and stricter valid limits', () => {
    expect(prepareRuntime(fixtureConfig(), fixtureEnvironment).ok).toBe(true);
    const config = fixtureConfig();
    config.limits = { ...config.limits, max_requests: 1, max_redirects: 0, max_retries: 0, max_depth: 0, max_wire_bytes: 10, max_response_bytes: 10 };
    expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(true);
  });
  for (const field of Object.keys(fixtureConfig())) {
    test(`requires explicit ${field}`, () => {
      const config = { ...fixtureConfig() };
      Reflect.deleteProperty(config, field);
      expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
    });
  }
  for (const [field, value] of Object.entries(fixtureConfig().limits)) {
    test(`requires explicit limit ${field}`, () => {
      const config = fixtureConfig();
      Reflect.deleteProperty(config.limits, field);
      expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
    });
    test(`rejects coercion/fractional values for ${field}`, () => {
      for (const invalid of [String(value), null, value + 0.5, Infinity, -1]) {
        const config = fixtureConfig();
        Reflect.set(config.limits, field, invalid);
        expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
      }
    });
  }
  const exceeds = {
    max_requests: 6, max_candidates: 11, max_depth: 2, max_concurrency: 2, min_request_interval_ms: 999,
    max_redirects: 4, max_wire_bytes: 1_048_577, max_response_bytes: 1_048_577, request_timeout_ms: 20_001,
    run_timeout_ms: 120_001, dns_timeout_ms: 20_001, max_retries: 2, max_session_rotations: 1, max_actor_restarts: 1,
  };
  for (const [field, value] of Object.entries(exceeds)) {
    test(`rejects out-of-profile ${field}`, () => {
      const config = fixtureConfig();
      Reflect.set(config.limits, field, value);
      expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
    });
  }
  for (const patch of [
    { dns_timeout_ms: 200, request_timeout_ms: 100 },
    { request_timeout_ms: 2_000, run_timeout_ms: 1_000 },
    { max_requests: 2, max_redirects: 2, max_retries: 0 },
    { max_requests: 1, max_redirects: 0, max_retries: 1 },
  ]) {
    test(`rejects incompatible budget ${JSON.stringify(patch)}`, () => {
      const config = fixtureConfig();
      config.limits = { ...config.limits, ...patch };
      expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
    });
  }
  for (const mode of ['browser', 'proxy', 'direct_browser', 'auto', '']) {
    test(`fails closed for execution mode ${mode}`, () => {
      expect(prepareRuntime(fixtureConfig({ execution_mode: mode }), fixtureEnvironment).ok).toBe(false);
    });
  }
  test('does not accept JSON loopback/proxy/secret flags or unknown runtime fields', () => {
    for (const field of ['allow_private', 'proxy_url', 'apify_token', 'production', 'allow_loopback']) {
      const result = prepareRuntime(fixtureConfig({ [field]: true }), fixtureEnvironment);
      expect(result.ok).toBe(false);
    }
  });
  test('rejects wrong environment, production, missing trusted DAAS_ENV and ambient fallbacks', () => {
    expect(prepareRuntime(fixtureConfig(), { ...fixtureEnvironment, DAAS_ENV: 'development' }).ok).toBe(false);
    expect(prepareRuntime(fixtureConfig(), {}).ok).toBe(false);
    expect(prepareRuntime(fixtureConfig({ environment: 'production' }), { DAAS_ENV: 'production' }).ok).toBe(false);
  });
  test('development refs cannot select test credentials', () => {
    const env = { DAAS_ENV: 'development', DAAS_APIFY_TOKEN: 'local-development-canary' };
    expect(prepareRuntime(fixtureConfig({ environment: 'development' }), env).ok).toBe(false);
    expect(prepareRuntime(fixtureConfig({ environment: 'development', secret_refs: { apify_token: 'DAAS_APIFY_TOKEN' } }), env).ok).toBe(true);
  });
  test('reuses source policy validation rather than trusting schema shape alone', () => {
    for (const origin of ['http://fixture.example.test/', 'http://user:password@fixture.example.test', 'file:///tmp/file']) {
      const config = fixtureConfig();
      config.source_policy.allowed_origins = [origin];
      expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
    }
    for (const prefix of ['/a/../', '//evil.test/', '/x?query']) {
      const config = fixtureConfig();
      config.source_policy.allowed_path_prefixes = [prefix];
      expect(prepareRuntime(config, fixtureEnvironment).ok).toBe(false);
    }
  });
  test('never invokes hostile input/environment getters or proxies', () => {
    let calls = 0;
    const hostile = { ...fixtureConfig(), get role() { calls++; return 'discovery_actor'; } };
    expect(prepareRuntime(hostile, fixtureEnvironment).ok).toBe(false);
    const env = { ...fixtureEnvironment, get DAAS_APIFY_TEST_TOKEN() { calls++; return 'hidden'; } };
    expect(prepareRuntime(fixtureConfig(), env).ok).toBe(false);
    const proxy = new Proxy(fixtureConfig(), { get() { calls++; throw new Error('CANARY_PROXY'); } });
    expect(prepareRuntime(proxy, fixtureEnvironment).ok).toBe(false);
    const envProxy = new Proxy(fixtureEnvironment, { getOwnPropertyDescriptor() { calls++; throw new Error('CANARY_PROXY'); } });
    expect(prepareRuntime(fixtureConfig(), envProxy).ok).toBe(false);
    expect(calls).toBe(0);
  });
  test('rejects header controls and invalid evidence retention', () => {
    expect(prepareRuntime(fixtureConfig({ user_agent: 'agent\r\nAuthorization: CANARY' }), fixtureEnvironment).ok).toBe(false);
    expect(prepareRuntime(fixtureConfig({ evidence_policy: { policy_id: 'p', policy_version: 'v', required: true, retention_seconds: 0, locations: [] } }), fixtureEnvironment).ok).toBe(false);
  });
});

describe('SPEC-016-AC-02/07: role scoped secret capability', () => {
  for (const role of ['discovery_actor', 'extraction_actor']) {
    test(`${role} cannot load/alias SQL secrets or claim SQL permissions`, () => {
      expect(prepareRuntime(fixtureConfig({ role, secret_refs: { mssql_connection_string: 'DAAS_MSSQL_TEST_CONNECTION_STRING' } }), fixtureEnvironment).ok).toBe(false);
      expect(prepareRuntime(fixtureConfig({ role, secret_refs: { apify_token: 'DAAS_MSSQL_TEST_CONNECTION_STRING' } }), fixtureEnvironment).ok).toBe(false);
      expect(prepareRuntime(fixtureConfig({ role, sql_permissions: ['control_read'] }), fixtureEnvironment).ok).toBe(false);
      const session = ready(fixtureConfig({ role }));
      expect(session.getSecret('apify_token')).toEqual({ ok: true, value: fixtureEnvironment.DAAS_APIFY_TEST_TOKEN });
      expect(session.getSecret('mssql_connection_string').ok).toBe(false);
    });
  }
  test('integration declares exactly the minimum intended capabilities and loads its own secrets', () => {
    const config = fixtureConfig({ role: 'integration_service', secret_refs: { apify_token: 'DAAS_APIFY_TEST_TOKEN', mssql_connection_string: 'DAAS_MSSQL_TEST_CONNECTION_STRING' }, sql_permissions: ['control_read', 'control_write', 'bronze_insert'] });
    const session = ready(config);
    expect(session.getSecret('mssql_connection_string')).toEqual({ ok: true, value: fixtureEnvironment.DAAS_MSSQL_TEST_CONNECTION_STRING });
    for (const permissions of [[], ['control_read'], ['bronze_update'], ['bronze_delete'], ['admin'], ['control_read', 'control_read', 'bronze_insert']]) {
      expect(prepareRuntime({ ...config, sql_permissions: permissions }, fixtureEnvironment).ok).toBe(false);
    }
    expect(prepareRuntime({ ...config, secret_refs: { apify_token: 'DAAS_APIFY_TEST_TOKEN' } }, fixtureEnvironment).ok).toBe(false);
  });
  test('local Actors can explicitly require no provider credentials', () => {
    const session = ready(fixtureConfig({ secret_refs: {} }), { ...fixtureEnvironment, DAAS_APIFY_TEST_TOKEN: '' });
    expect(session.getSecret('apify_token').ok).toBe(false);
  });
  test('missing/empty/control-containing/overlong secrets fail without disclosure', () => {
    for (const secret of ['', 'CANARY\r\nLEAK', 'x'.repeat(8193)]) {
      const result = prepareRuntime(fixtureConfig(), { ...fixtureEnvironment, DAAS_APIFY_TEST_TOKEN: secret });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('CANARY');
    }
  });
  test('fingerprints and serialized public state contain no secret values; secrets are snapshotted', () => {
    const env = { ...fixtureEnvironment };
    const first = ready(fixtureConfig(), env);
    const second = ready(fixtureConfig(), { ...env, DAAS_APIFY_TEST_TOKEN: 'SECOND_CANARY' });
    expect(first.config_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.config_fingerprint).toBe(second.config_fingerprint);
    expect(JSON.stringify(first)).not.toContain('CANARY');
    env.DAAS_APIFY_TEST_TOKEN = 'MUTATED_CANARY';
    expect(first.getSecret('apify_token')).toEqual({ ok: true, value: fixtureEnvironment.DAAS_APIFY_TEST_TOKEN });
    const changed = ready(fixtureConfig({ config_version: 'fixture-v2' }));
    expect(changed.config_fingerprint).not.toBe(first.config_fingerprint);
  });
  test('snapshots are deeply frozen and forged sessions carry no network capability', () => {
    const input = fixtureConfig();
    const session = ready(input);
    input.source_policy.allowed_origins.push('http://mutated.example.test');
    input.limits.max_requests = 999;
    expect(session.config.source_policy.allowed_origins).toEqual(['http://fixture.example.test']);
    expect(session.config.limits.max_requests).toBe(5);
    expect(Reflect.set(session.config.limits, 'max_requests', 999)).toBe(false);
    expect(Object.isFrozen(session)).toBe(true);
    expect(getValidatedRuntime(session).ok).toBe(true);
    expect(getValidatedRuntime({ ...session }).ok).toBe(false);
    expect(getValidatedRuntime(new Proxy(session, {})).ok).toBe(false);
    expect(getValidatedRuntime(null).ok).toBe(false);
  });
  test('rejected values and arbitrary property names never appear in diagnostics', () => {
    const result = prepareRuntime(fixtureConfig({ CANARY_ARBITRARY: 'CANARY_VALUE' }), fixtureEnvironment);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('CANARY');
  });
});
