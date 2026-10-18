import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import { inspectJson, parseJson, type Result, type ValidationIssue } from './json.ts';
import { manifestFingerprint } from './fingerprint.ts';
import { schemas, CONTRACT_LIMITS, type ContractName, type Contracts, type ExtractionEvent, type WorkManifest } from './schemas.ts';

function fail(path: string, code: string): { ok: false; issues: ValidationIssue[] } {
  return { ok: false, issues: [{ path, code }] };
}

function utcTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

function httpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /[\s\\]/u.test(value) || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || /%(?![a-fA-F0-9]{2})/.test(value)) return false;
  const authority = value.slice(value.indexOf('//') + 2).split(/[/?#]/)[0];
  if (authority?.includes('@')) return false;
  try {
    const parsed = new URL(value);
    return !!parsed.hostname && !parsed.username && !parsed.password;
  } catch { return false; }
}

function makeAjv(): Ajv {
  const ajv = new Ajv({ strict: true, allErrors: false, coerceTypes: false, useDefaults: false, removeAdditional: false, ownProperties: true, messages: false, logger: false });
  ajv.addFormat('sql-bigint', (value: string) => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
  ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  ajv.addFormat('utc-time', utcTime);
  ajv.addFormat('http-url', httpUrl);
  ajv.addFormat('hostname', (value: string) => value.length <= 253 && value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)));
  ajv.addFormat('object-key', (value: string) => /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/.test(value) && !value.split('/').some((part) => part === '..' || part === '.' || part === ''));
  return ajv;
}

// Field paths may describe the schema, never arbitrary rejected business keys/values.
const safeFields = new Set<string>();
function collectFields(schema: unknown): void {
  if (!schema || typeof schema !== 'object') return;
  if (Array.isArray(schema)) { schema.forEach(collectFields); return; }
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && value && typeof value === 'object') Object.keys(value).forEach((name) => safeFields.add(name));
    collectFields(value);
  }
}
Object.values(schemas).forEach(collectFields);

function schemaIssue(error: ErrorObject | undefined, prefix = ''): Result<never> {
  const parts = (error?.instancePath ?? '').split('/').filter(Boolean).map((part) => safeFields.has(part) ? part : '*');
  const missing: unknown = error?.keyword === 'required' ? error.params.missingProperty : undefined;
  if (typeof missing === 'string' && safeFields.has(missing)) parts.push(missing);
  return fail(`${prefix}/${parts.join('/')}`.slice(0, 256), `schema_${error?.keyword ?? 'invalid'}`);
}

const ajv = makeAjv();
const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)])) as Record<ContractName, ValidateFunction>;

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length; }
function countsMatch(value: { raw: number; accepted: number; duplicate: number; rejected: number }): boolean {
  return value.raw === value.accepted + value.duplicate + value.rejected;
}

function intrinsic<N extends ContractName>(name: N, value: Contracts[N]): Result<Contracts[N]> {
  if (name === 'WorkManifest' || name === 'ExtractionInput') {
    const manifest = value as WorkManifest;
    if (!unique(manifest.assignments.map((item) => item.attempt_id)) || !unique(manifest.assignments.map((item) => item.url_id))) return fail('/assignments', 'duplicate_assignment');
    const digest = manifestFingerprint(manifest);
    if (!digest.ok) return digest;
    if (digest.value !== manifest.manifest_fingerprint) return fail('/manifest_fingerprint', 'fingerprint_mismatch');
  }
  if (name === 'DiscoveryInput') {
    const input = value as Contracts['DiscoveryInput'];
    if (!unique(input.seeds.map((seed) => seed.partition_id))) return fail('/seeds', 'duplicate_partition');
    if (!unique(input.approved_target_rules.map((rule) => `${rule.hostname}/${rule.page_type}`))) return fail('/approved_target_rules', 'ambiguous_target_rule');
  }
  if (name === 'ExtractionEvent') {
    const event = value as ExtractionEvent;
    if (event.outcome === 'success') {
      if (event.errors.length || event.http_status === null || event.http_status < 200 || event.http_status > 299 || event.final_url === null) return fail('/outcome', 'invalid_success');
    } else if (event.records.length || !event.errors.length) return fail('/outcome', 'invalid_failure');
    if (event.outcome === 'network_error' && (event.http_status !== null || event.final_url !== null)) return fail('/http_status', 'network_has_response');
    if (event.http_status === null && !['network_error', 'timeout', 'cancelled', 'blocked'].includes(event.outcome)) return fail('/http_status', 'response_required');
    if (event.http_status !== null && event.final_url === null) return fail('/final_url', 'response_url_required');
    if (event.outcome === 'http_error' && (event.http_status === null || event.http_status < 400)) return fail('/http_status', 'invalid_http_error');
    if (event.evidence_refs.some((ref) => ref.request_context_id !== event.request_context_id)) return fail('/evidence_refs', 'context_mismatch');
  }
  if (name === 'DiscoveryCoverage') {
    const report = value as Contracts['DiscoveryCoverage'];
    if (!unique(report.partitions.map((partition) => partition.partition_id))) return fail('/partitions', 'duplicate_partition');
    if (!countsMatch(report.counts) || report.partitions.some((partition) => !countsMatch(partition.counts))) return fail('/counts', 'invalid_accounting');
    for (const key of ['raw', 'accepted', 'duplicate', 'rejected'] as const) {
      if (report.counts[key] !== report.partitions.reduce((sum, partition) => sum + partition.counts[key], 0)) return fail('/counts', 'aggregate_mismatch');
    }
    if (report.partitions.some((partition) => partition.state === 'complete' && partition.errors.length || partition.state === 'failed' && !partition.errors.length)) return fail('/partitions', 'invalid_partition_state');
    const allComplete = report.partitions.every((partition) => partition.state === 'complete');
    const allFailed = report.partitions.every((partition) => partition.state === 'failed');
    if (report.coverage_state === 'complete' && (!allComplete || report.stop_reason !== 'finished' || report.continuation !== undefined)) return fail('/coverage_state', 'invalid_complete_coverage');
    if (report.coverage_state === 'failed' && (!allFailed || report.stop_reason !== 'error')) return fail('/coverage_state', 'invalid_failed_coverage');
    if (report.coverage_state === 'partial' && (report.stop_reason === 'finished' || allFailed)) return fail('/coverage_state', 'invalid_partial_coverage');
  }
  if (name === 'ExecutionSummary') {
    const summary = value as Contracts['ExecutionSummary'];
    if (!unique(summary.emitted_attempt_ids) || summary.emitted_count !== summary.emitted_attempt_ids.length || summary.emitted_count > summary.processed_count || summary.processed_count > summary.assigned_count) return fail('/emitted_count', 'invalid_execution_counts');
    if (summary.stop_reason === 'finished' && (summary.processed_count !== summary.assigned_count || summary.emitted_count !== summary.processed_count)) return fail('/stop_reason', 'incomplete_finished_execution');
  }
  return { ok: true, value };
}

/** Shape and local invariants only. Use the contextual validators before accepting producer output. */
export function validateContract<N extends ContractName>(name: N, value: unknown): Result<Contracts[N]> {
  if (!Object.hasOwn(validators, name)) return fail('/', 'unsupported_contract');
  const inspected = inspectJson(value);
  if (!inspected.ok) return inspected;
  const validate = validators[name];
  if (!validate) return fail('/', 'unsupported_contract');
  if (!validate(value)) return schemaIssue(validate.errors?.[0]);
  return intrinsic(name, value as Contracts[N]);
}

export function parseContract<N extends ContractName>(name: N, text: string): Result<Contracts[N]> {
  const parsed = parseJson(text);
  return parsed.ok ? validateContract(name, parsed.value) : parsed;
}

function sameFields(actual: object, expected: object, fields: readonly string[]): Result<never> | undefined {
  const left = actual as Record<string, unknown>;
  const right = expected as Record<string, unknown>;
  const key = fields.find((field) => left[field] !== right[field]);
  return key ? fail(`/${key}`, 'correlation_mismatch') : undefined;
}

export function validateDiscoveryCandidate(value: unknown, expected: unknown): Result<Contracts['DiscoveryCandidate']> {
  const input = validateContract('DiscoveryInput', expected);
  if (!input.ok) return input;
  const result = validateContract('DiscoveryCandidate', value);
  if (!result.ok) return result;
  const item = result.value;
  const mismatch = sameFields(item, input.value, ['discovery_run_id', 'discovery_source_id', 'request_context_id', 'config_version', 'normalization_version']);
  if (mismatch) return mismatch;
  const host = new URL(item.canonical_url).hostname;
  const rawHost = new URL(item.discovered_url).hostname;
  if (!input.value.approved_target_rules.some((rule) => rule.target_source_id === item.target_source_id && rule.hostname === host && rule.hostname === rawHost && rule.page_type === item.page_type)) return fail('/target_source_id', 'unapproved_target');
  return result;
}

export function validateDiscoveryCoverage(value: unknown, expected: unknown): Result<Contracts['DiscoveryCoverage']> {
  const input = validateContract('DiscoveryInput', expected);
  if (!input.ok) return input;
  const result = validateContract('DiscoveryCoverage', value);
  if (!result.ok) return result;
  const mismatch = sameFields(result.value, input.value, ['discovery_run_id', 'dispatch_id', 'scope_version', 'config_version']);
  if (mismatch) return mismatch;
  const expectedIds = new Set(input.value.seeds.map((seed) => seed.partition_id));
  if (result.value.partitions.length !== expectedIds.size || result.value.partitions.some((partition) => !expectedIds.has(partition.partition_id))) return fail('/partitions', 'partition_set_mismatch');
  return result;
}

export function validateExecutionSummary(value: unknown, expected: unknown, apifyRunId: string): Result<Contracts['ExecutionSummary']> {
  const manifest = validateContract('WorkManifest', expected);
  if (!manifest.ok) return manifest;
  const result = validateContract('ExecutionSummary', value);
  if (!result.ok) return result;
  const summary = result.value;
  if (summary.apify_run_id !== apifyRunId || summary.dispatch_id !== manifest.value.dispatch_id) return fail('/apify_run_id', 'execution_mismatch');
  const attempts = new Set(manifest.value.assignments.map((item) => item.attempt_id));
  if (summary.assigned_count !== attempts.size || summary.emitted_attempt_ids.some((id) => !attempts.has(id))) return fail('/emitted_attempt_ids', 'assignment_mismatch');
  return result;
}

export interface TrustedProfile {
  source_id: string;
  request_context_id: string;
  page_type: string;
  profile_version: string;
  parser_version: string;
  config_version: string;
  normalization_version: string;
  min_records: number;
  max_records: number;
  record_schema: Record<string, unknown>;
  evidence_policy: {
    policy_id: string;
    policy_version: string;
    required: boolean;
    allowed_locations: readonly { storage_provider: string; location_id: string; retention_class: string }[];
  };
}

const profileFields = ['source_id', 'request_context_id', 'profile_version', 'parser_version', 'config_version', 'normalization_version'] as const;

/** The caller supplies an approved profile; an untrusted event cannot choose or register one. */
export function createExtractionValidator(configuration: TrustedProfile) {
  let profile: TrustedProfile;
  let validateRecord: ValidateFunction;
  try {
    if (!inspectJson(configuration).ok) throw new Error();
    profile = structuredClone(configuration);
    if (!Number.isInteger(profile.min_records) || !Number.isInteger(profile.max_records) || profile.min_records < 0 || profile.max_records > CONTRACT_LIMITS.records || profile.max_records < profile.min_records || typeof profile.evidence_policy.required !== 'boolean' || profile.evidence_policy.allowed_locations.length > CONTRACT_LIMITS.evidence) throw new Error();
    for (const field of [...profileFields, 'page_type'] as const) if (typeof profile[field] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(profile[field])) throw new Error();
    for (const location of profile.evidence_policy.allowed_locations) {
      for (const field of ['storage_provider', 'location_id', 'retention_class'] as const) if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(location[field])) throw new Error();
    }
    validateRecord = makeAjv().compile(profile.record_schema);
    if ('$async' in validateRecord && validateRecord.$async) throw new Error();
  } catch { throw new Error('Invalid trusted profile configuration.'); }

  return (value: unknown, expected: unknown, apifyRunId: string): Result<ExtractionEvent> => {
    const manifest = validateContract('WorkManifest', expected);
    if (!manifest.ok) return manifest;
    const result = validateContract('ExtractionEvent', value);
    if (!result.ok) return result;
    const event = result.value;
    const profileMismatch = sameFields(event, profile, [...profileFields, 'page_type']);
    if (profileMismatch) return profileMismatch;
    const mismatch = sameFields(event, manifest.value, [...profileFields, 'run_id', 'dispatch_id', 'actor_build_id']);
    if (mismatch) return mismatch;
    if (event.apify_run_id !== apifyRunId) return fail('/apify_run_id', 'execution_mismatch');
    const assignment = manifest.value.assignments.find((item) => item.attempt_id === event.attempt_id);
    if (!assignment || event.url_id !== assignment.url_id || event.lease_generation !== assignment.lease_generation || event.requested_url !== assignment.canonical_url) return fail('/attempt_id', 'assignment_mismatch');
    const policy = profile.evidence_policy;
    if (manifest.value.evidence_policy.policy_id !== policy.policy_id || manifest.value.evidence_policy.policy_version !== policy.policy_version) return fail('/evidence_policy', 'policy_mismatch');
    if (policy.required && !event.evidence_refs.length) return fail('/evidence_refs', 'evidence_required');
    if (event.evidence_refs.some((ref) => ref.policy_id !== policy.policy_id || ref.policy_version !== policy.policy_version || !policy.allowed_locations.some((location) => location.storage_provider === ref.storage_provider && location.location_id === ref.location_id && location.retention_class === ref.retention_class))) return fail('/evidence_refs', 'unapproved_evidence');
    if (event.outcome === 'success') {
      if (event.records.length < profile.min_records || event.records.length > profile.max_records) return fail('/records', 'invalid_cardinality');
      for (const record of event.records) if (!validateRecord(record)) return schemaIssue(validateRecord.errors?.[0], '/records/*');
    }
    return result;
  };
}
