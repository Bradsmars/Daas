export const fixtureEnvironment = {
  DAAS_ENV: 'test',
  DAAS_APIFY_TEST_TOKEN: 'CANARY_APIFY_SPEC016',
  DAAS_MSSQL_TEST_CONNECTION_STRING: 'CANARY_SQL_SPEC016',
};

export const fixtureEvidenceLocation = {
  storage_provider: 'fixture-provider', location_id: 'fixture-location', retention_class: 'test-only',
  key_prefix: 'sources/2/', max_bytes: 1_048_576,
};

export function fixtureConfig(patch: Record<string, unknown> = {}) {
  return {
    schema_version: 1, environment: 'test', role: 'discovery_actor', execution_mode: 'direct_http',
    config_version: 'fixture-v1', rate_group_id: 'fixture-site', user_agent: 'daas-controlled-fixture/1',
    source_policy: {
      source_id: '2', request_context_id: 'synthetic-context-v1', normalization_version: 'fixture-v1',
      mode: 'preserve-v1', allowed_origins: ['http://fixture.example.test'], allowed_path_prefixes: ['/'],
    },
    limits: {
      max_requests: 5, max_candidates: 10, max_depth: 1, max_concurrency: 1, min_request_interval_ms: 1000,
      max_redirects: 3, max_wire_bytes: 1_048_576, max_response_bytes: 1_048_576,
      request_timeout_ms: 20_000, run_timeout_ms: 120_000, dns_timeout_ms: 1000,
      max_retries: 1, max_session_rotations: 0, max_actor_restarts: 0,
    },
    secret_refs: { apify_token: 'DAAS_APIFY_TEST_TOKEN' }, sql_permissions: [] as string[],
    evidence_policy: { policy_id: 'fixture-only', policy_version: 'v1', required: false, retention_seconds: 0, locations: [] as (typeof fixtureEvidenceLocation)[] },
    ...patch,
  };
}
