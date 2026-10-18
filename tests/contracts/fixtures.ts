import type { DiscoveryInput, DiscoveryCandidate, DiscoveryCoverage, ExtractionEvent, WorkManifest, EvidenceReference, ExecutionSummary } from '@daas/contracts';

export const ids = {
  run: '00000000-0000-4000-8000-000000000001', dispatch: '00000000-0000-4000-8000-000000000002',
  attempt: '00000000-0000-4000-8000-000000000003', event: '00000000-0000-4000-8000-000000000004',
};
export const limits = { max_requests: 10, max_depth: 0, max_redirects: 0, max_pages: 10, max_candidates: 100, max_bytes: 100000, max_runtime_ms: 1000, max_retries: 0, requests_per_minute: 10 };
export const discoveryInput: DiscoveryInput = {
  schema_version: 1, discovery_run_id: ids.run, dispatch_id: ids.dispatch, discovery_source_id: '1',
  request_context_id: 'synthetic-context-v1', profile_version: 'fixture-v1', config_version: 'fixture-v1', normalization_version: 'fixture-v1', scope_version: 'fixture-v1',
  seeds: [{ partition_id: 'seed-1', url: 'https://discovery.example.test/list' }],
  approved_target_rules: [{ target_source_id: '2', hostname: 'target.example.test', page_type: 'synthetic-item' }], limits,
};
export const candidate: DiscoveryCandidate = {
  schema_version: 1, discovery_run_id: ids.run, discovery_source_id: '1', target_source_id: '2',
  request_context_id: 'synthetic-context-v1', discovered_url: 'https://target.example.test/Item?variant=A', canonical_url: 'https://target.example.test/Item?variant=A',
  normalization_version: 'fixture-v1', found_on_url: 'https://discovery.example.test/list', page_type: 'synthetic-item', discovered_at: '1970-01-01T00:00:00Z', discovery_method: 'fixture-links', config_version: 'fixture-v1',
};
export const coverage: DiscoveryCoverage = {
  schema_version: 1, discovery_run_id: ids.run, dispatch_id: ids.dispatch, scope_version: 'fixture-v1', config_version: 'fixture-v1',
  partitions: [{ partition_id: 'seed-1', state: 'complete', counts: { raw: 1, accepted: 1, duplicate: 0, rejected: 0 }, errors: [] }],
  counts: { raw: 1, accepted: 1, duplicate: 0, rejected: 0 }, coverage_state: 'complete', stop_reason: 'finished',
};
export const unsignedManifest = {
  schema_version: 1, run_id: ids.run, dispatch_id: ids.dispatch, actor_type: 'extraction', source_id: '2',
  request_context_id: 'synthetic-context-v1', profile_version: 'fixture-v1', config_version: 'fixture-v1', actor_build_id: 'build-fixture', parser_version: 'fixture-v1', normalization_version: 'fixture-v1',
  assignments: [{ attempt_id: ids.attempt, url_id: '3', canonical_url: candidate.canonical_url, lease_generation: '1' }],
  limits, evidence_policy: { policy_id: 'fixture-only', policy_version: 'v1' },
} as const;
export const evidence: EvidenceReference = {
  schema_version: 1, storage_provider: 'fixture-provider', location_id: 'fixture-location', object_key: 'captures/item-1.html', sha256: 'a'.repeat(64),
  byte_length: 10, content_type: 'text/html', captured_at: '2024-02-29T23:59:59.123Z', kind: 'fixture', retention_class: 'test-only',
  policy_id: 'fixture-only', policy_version: 'v1', request_context_id: 'synthetic-context-v1',
};
export const event: ExtractionEvent = {
  schema_version: 1, event_id: ids.event, run_id: ids.run, dispatch_id: ids.dispatch, attempt_id: ids.attempt,
  lease_generation: '1', url_id: '3', source_id: '2', request_context_id: 'synthetic-context-v1', apify_run_id: 'physical-fixture', actor_build_id: 'build-fixture',
  requested_url: candidate.canonical_url, final_url: candidate.canonical_url, redirect_history: [], observed_at: '2026-10-18T00:00:00Z', outcome: 'success', http_status: 200,
  parser_version: 'fixture-v1', profile_version: 'fixture-v1', config_version: 'fixture-v1', normalization_version: 'fixture-v1', page_type: 'synthetic-item',
  records: [{ title: '  Synthetic RAW  ', amount: 0, available: false, optional_value: null }], errors: [], evidence_refs: [],
};
export const summary: ExecutionSummary = {
  schema_version: 1, apify_run_id: 'physical-fixture', dispatch_id: ids.dispatch, assigned_count: 1, processed_count: 1, emitted_count: 1, emitted_attempt_ids: [ids.attempt], stop_reason: 'finished',
};
// This schema is exclusively synthetic; it authorises no live source or storage.
export const profile = {
  source_id: '2', request_context_id: 'synthetic-context-v1', page_type: 'synthetic-item', profile_version: 'fixture-v1', parser_version: 'fixture-v1', config_version: 'fixture-v1', normalization_version: 'fixture-v1',
  min_records: 0, max_records: 3,
  record_schema: { type: 'object', additionalProperties: false, properties: { title: { type: 'string', minLength: 1 }, amount: { type: 'number' }, available: { type: 'boolean' }, optional_value: { type: ['string', 'null'] } }, required: ['title', 'amount', 'available', 'optional_value'] },
  evidence_policy: { policy_id: 'fixture-only', policy_version: 'v1', required: false, allowed_locations: [{ storage_provider: 'fixture-provider', location_id: 'fixture-location', retention_class: 'test-only' }] },
};

export function withDigest(fingerprint: string): WorkManifest {
  return { ...structuredClone(unsignedManifest), assignments: unsignedManifest.assignments.map((item) => ({ ...item })), manifest_fingerprint: fingerprint };
}
