import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

export const CONTRACT_LIMITS = Object.freeze({
  identifiers: 128, urls: 2048, errors: 25, reasons: 256, seeds: 10,
  partitions: 10, assignments: 100, records: 100, redirects: 10, evidence: 10,
});

const version = { type: 'integer', const: 1 } as const;
const id = { type: 'string', minLength: 1, maxLength: CONTRACT_LIMITS.identifiers, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$' } as const;
const sqlId = { type: 'string', pattern: '^[1-9][0-9]{0,18}$', format: 'sql-bigint' } as const;
const uuid = { type: 'string', format: 'uuid' } as const;
const url = { type: 'string', maxLength: CONTRACT_LIMITS.urls, format: 'http-url' } as const;
const time = { type: 'string', format: 'utc-time' } as const;
const hash = { type: 'string', pattern: '^[0-9a-f]{64}$' } as const;
const count = { type: 'integer', minimum: 0, maximum: 1_000_000 } as const;
const positive = { type: 'integer', minimum: 1, maximum: 1_000_000 } as const;
const nullableUrl = { anyOf: [url, { type: 'null' }] } as const;

function object<const P extends Record<string, JSONSchema>, const R extends readonly (keyof P & string)[]>(properties: P, required: R) {
  return { type: 'object', properties, required, additionalProperties: false } as const;
}
function array<const I extends JSONSchema>(items: I, maxItems: number, minItems = 0) {
  return { type: 'array', items, minItems, maxItems } as const;
}

const error = object({ code: id, reason: { type: 'string', minLength: 1, maxLength: CONTRACT_LIMITS.reasons } }, ['code', 'reason']);
const errors = array(error, CONTRACT_LIMITS.errors);
const continuation = object({ version, token: { type: 'string', minLength: 1, maxLength: 1024 } }, ['version', 'token']);
const counts = object({ raw: count, accepted: count, duplicate: count, rejected: count }, ['raw', 'accepted', 'duplicate', 'rejected']);
const limits = object({
  max_requests: positive, max_depth: count, max_redirects: count, max_pages: positive,
  max_candidates: positive, max_bytes: positive, max_runtime_ms: positive, max_retries: count,
  requests_per_minute: positive,
}, ['max_requests', 'max_depth', 'max_redirects', 'max_pages', 'max_candidates', 'max_bytes', 'max_runtime_ms', 'max_retries', 'requests_per_minute']);
const assignment = object({ attempt_id: uuid, url_id: sqlId, canonical_url: url, lease_generation: sqlId }, ['attempt_id', 'url_id', 'canonical_url', 'lease_generation']);
const evidencePolicy = object({ policy_id: id, policy_version: id }, ['policy_id', 'policy_version']);

const DiscoveryInput = object({
  schema_version: version, discovery_run_id: uuid, dispatch_id: uuid, discovery_source_id: sqlId,
  request_context_id: id, profile_version: id, config_version: id, normalization_version: id, scope_version: id,
  seeds: array(object({ partition_id: id, url }, ['partition_id', 'url']), CONTRACT_LIMITS.seeds, 1),
  approved_target_rules: array(object({ target_source_id: sqlId, hostname: { type: 'string', format: 'hostname', maxLength: 253 }, page_type: id }, ['target_source_id', 'hostname', 'page_type']), 10, 1),
  limits, continuation,
}, ['schema_version', 'discovery_run_id', 'dispatch_id', 'discovery_source_id', 'request_context_id', 'profile_version', 'config_version', 'normalization_version', 'scope_version', 'seeds', 'approved_target_rules', 'limits']);

const DiscoveryCandidate = object({
  schema_version: version, discovery_run_id: uuid, discovery_source_id: sqlId, target_source_id: sqlId,
  request_context_id: id, discovered_url: url, canonical_url: url, normalization_version: id,
  found_on_url: url, page_type: id, discovered_at: time, discovery_method: id, config_version: id,
}, ['schema_version', 'discovery_run_id', 'discovery_source_id', 'target_source_id', 'request_context_id', 'discovered_url', 'canonical_url', 'normalization_version', 'found_on_url', 'page_type', 'discovered_at', 'discovery_method', 'config_version']);

const DiscoveryCoverage = object({
  schema_version: version, discovery_run_id: uuid, dispatch_id: uuid, scope_version: id, config_version: id,
  partitions: array(object({ partition_id: id, state: { enum: ['complete', 'partial', 'failed'] }, counts, errors }, ['partition_id', 'state', 'counts', 'errors']), CONTRACT_LIMITS.partitions, 1),
  counts, coverage_state: { enum: ['complete', 'partial', 'failed'] },
  stop_reason: { enum: ['finished', 'page_limit', 'request_limit', 'candidate_limit', 'byte_limit', 'runtime_limit', 'cancelled', 'error'] },
  continuation,
}, ['schema_version', 'discovery_run_id', 'dispatch_id', 'scope_version', 'config_version', 'partitions', 'counts', 'coverage_state', 'stop_reason']);

// The manifest is the full immutable extraction input. Only its own digest is excluded from its hash.
const WorkManifest = object({
  schema_version: version, run_id: uuid, dispatch_id: uuid, actor_type: { const: 'extraction', type: 'string' },
  source_id: sqlId, request_context_id: id, profile_version: id, config_version: id, actor_build_id: id,
  parser_version: id, normalization_version: id, assignments: array(assignment, CONTRACT_LIMITS.assignments, 1),
  limits, evidence_policy: evidencePolicy, manifest_fingerprint: hash,
}, ['schema_version', 'run_id', 'dispatch_id', 'actor_type', 'source_id', 'request_context_id', 'profile_version', 'config_version', 'actor_build_id', 'parser_version', 'normalization_version', 'assignments', 'limits', 'evidence_policy', 'manifest_fingerprint']);

const EvidenceReference = object({
  schema_version: version, storage_provider: id, location_id: id,
  object_key: { type: 'string', minLength: 1, maxLength: 512, format: 'object-key' },
  sha256: hash, byte_length: { type: 'integer', minimum: 0, maximum: 1_048_576 },
  content_type: { type: 'string', minLength: 3, maxLength: 128, pattern: '^[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+$' },
  captured_at: time, kind: { enum: ['response', 'html', 'screenshot', 'fixture'] },
  retention_class: id, policy_id: id, policy_version: id, request_context_id: id,
}, ['schema_version', 'storage_provider', 'location_id', 'object_key', 'sha256', 'byte_length', 'content_type', 'captured_at', 'kind', 'retention_class', 'policy_id', 'policy_version', 'request_context_id']);

const ExtractionEvent = object({
  schema_version: version, event_id: uuid, run_id: uuid, dispatch_id: uuid, attempt_id: uuid,
  lease_generation: sqlId, url_id: sqlId, source_id: sqlId, request_context_id: id,
  apify_run_id: id, actor_build_id: id, requested_url: url, final_url: nullableUrl,
  redirect_history: array(url, CONTRACT_LIMITS.redirects), observed_at: time,
  outcome: { enum: ['success', 'not_found', 'blocked', 'parse_error', 'schema_invalid', 'http_error', 'network_error', 'timeout', 'cancelled'] },
  http_status: { anyOf: [{ type: 'integer', minimum: 100, maximum: 599 }, { type: 'null' }] },
  parser_version: id, profile_version: id, config_version: id, normalization_version: id, page_type: id,
  records: array({ type: 'object', additionalProperties: true }, CONTRACT_LIMITS.records),
  errors, evidence_refs: array(EvidenceReference, CONTRACT_LIMITS.evidence),
}, ['schema_version', 'event_id', 'run_id', 'dispatch_id', 'attempt_id', 'lease_generation', 'url_id', 'source_id', 'request_context_id', 'apify_run_id', 'actor_build_id', 'requested_url', 'final_url', 'redirect_history', 'observed_at', 'outcome', 'http_status', 'parser_version', 'profile_version', 'config_version', 'normalization_version', 'page_type', 'records', 'errors', 'evidence_refs']);

const ExecutionSummary = object({
  schema_version: version, apify_run_id: id, dispatch_id: uuid, assigned_count: count, processed_count: count,
  emitted_count: count, emitted_attempt_ids: array(uuid, CONTRACT_LIMITS.assignments),
  stop_reason: { enum: ['finished', 'limit', 'cancelled', 'error'] },
}, ['schema_version', 'apify_run_id', 'dispatch_id', 'assigned_count', 'processed_count', 'emitted_count', 'emitted_attempt_ids', 'stop_reason']);

export const schemas = {
  DiscoveryInput, DiscoveryCandidate, DiscoveryCoverage, WorkManifest, ExtractionInput: WorkManifest,
  ExtractionEvent, EvidenceReference, ExecutionSummary,
} as const;

export type ContractName = keyof typeof schemas;
export type DiscoveryInput = FromSchema<typeof DiscoveryInput>;
export type DiscoveryCandidate = FromSchema<typeof DiscoveryCandidate>;
export type DiscoveryCoverage = FromSchema<typeof DiscoveryCoverage>;
export type WorkManifest = FromSchema<typeof WorkManifest>;
export type ExtractionInput = WorkManifest;
export type ExtractionEvent = FromSchema<typeof ExtractionEvent>;
export type EvidenceReference = FromSchema<typeof EvidenceReference>;
export type ExecutionSummary = FromSchema<typeof ExecutionSummary>;
export type Contracts = {
  DiscoveryInput: DiscoveryInput;
  DiscoveryCandidate: DiscoveryCandidate;
  DiscoveryCoverage: DiscoveryCoverage;
  WorkManifest: WorkManifest;
  ExtractionInput: ExtractionInput;
  ExtractionEvent: ExtractionEvent;
  EvidenceReference: EvidenceReference;
  ExecutionSummary: ExecutionSummary;
};
