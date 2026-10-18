import { types } from 'node:util';
import { Ajv, type ErrorObject } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';
import { fingerprint, inspectJson, schemas, type Result } from '@daas/contracts';
import { createUrlNormalizer, urlNormalizationPolicySchema } from './url-normalization.ts';
import { evidencePolicySchema, validateEvidencePolicy } from './evidence-security.ts';

const id = schemas.WorkManifest.properties.config_version;
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum }) as const;
const limits = {
  max_requests: integer(1, 5), max_candidates: integer(1, 10), max_depth: integer(0, 1),
  max_concurrency: { type: 'integer', const: 1 }, min_request_interval_ms: integer(1_000, 20_000),
  max_redirects: integer(0, 3), max_wire_bytes: integer(1, 1_048_576), max_response_bytes: integer(1, 1_048_576),
  request_timeout_ms: integer(1, 20_000), run_timeout_ms: integer(1, 120_000), dns_timeout_ms: integer(1, 20_000),
  max_retries: integer(0, 1), max_session_rotations: { type: 'integer', const: 0 }, max_actor_restarts: { type: 'integer', const: 0 },
} as const;
const runtimeSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    schema_version: { type: 'integer', const: 1 }, environment: { enum: ['development', 'test'] },
    role: { enum: ['discovery_actor', 'extraction_actor', 'integration_service'] },
    execution_mode: { type: 'string', const: 'direct_http' }, config_version: id, rate_group_id: id,
    user_agent: { type: 'string', minLength: 1, maxLength: 256 },
    source_policy: urlNormalizationPolicySchema,
    limits: {
      type: 'object', additionalProperties: false, properties: limits,
      required: ['max_requests', 'max_candidates', 'max_depth', 'max_concurrency', 'min_request_interval_ms', 'max_redirects', 'max_wire_bytes', 'max_response_bytes', 'request_timeout_ms', 'run_timeout_ms', 'dns_timeout_ms', 'max_retries', 'max_session_rotations', 'max_actor_restarts'],
    },
    secret_refs: {
      type: 'object', additionalProperties: false,
      properties: { apify_token: id, mssql_connection_string: id },
    },
    sql_permissions: {
      type: 'array', maxItems: 3, uniqueItems: true,
      items: { enum: ['control_read', 'control_write', 'bronze_insert'] },
    },
    evidence_policy: evidencePolicySchema,
  },
  required: ['schema_version', 'environment', 'role', 'execution_mode', 'config_version', 'rate_group_id', 'user_agent', 'source_policy', 'limits', 'secret_refs', 'sql_permissions', 'evidence_policy'],
} as const;

export type RuntimeConfig = FromSchema<typeof runtimeSchema>;
export type SecretKind = 'apify_token' | 'mssql_connection_string';
export interface RuntimeSession {
  readonly config: RuntimeConfig;
  readonly config_fingerprint: string;
  getSecret(kind: SecretKind): Result<string>;
}

const ajv = new Ajv({ strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false, ownProperties: true, allErrors: false, messages: false, logger: false });
ajv.addFormat('sql-bigint', (value: string) => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
const validate = ajv.compile<RuntimeConfig>(runtimeSchema);
const sessions = new WeakMap<object, RuntimeConfig>();
const fail = (path: string, code: string): Result<never> => ({ ok: false, issues: [{ path, code }] });
const fields = new Set([
  ...Object.keys(runtimeSchema.properties), ...Object.keys(limits), ...Object.keys(urlNormalizationPolicySchema.properties),
  ...Object.keys(evidencePolicySchema.properties), 'apify_token', 'mssql_connection_string',
  'storage_provider', 'location_id', 'retention_class', 'key_prefix', 'max_bytes',
]);

function schemaFailure(error: ErrorObject | undefined): Result<never> {
  const parts = (error?.instancePath ?? '').split('/').filter(Boolean).map((field) => fields.has(field) ? field : '*');
  const missing: unknown = error?.keyword === 'required' ? error.params.missingProperty : undefined;
  if (typeof missing === 'string' && fields.has(missing)) parts.push(missing);
  return fail(`/${parts.join('/')}`, `runtime_schema_${error?.keyword ?? 'invalid'}`);
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function environmentValue(environment: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  if (!environment || typeof environment !== 'object' || types.isProxy(environment)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(environment, name);
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : undefined;
}

/** Trusted startup boundary. Secret values are loaded once, never included in public configuration/hash. */
export function prepareRuntime(input: unknown, environment: Readonly<Record<string, string | undefined>>): Result<RuntimeSession> {
  const inspected = inspectJson(input);
  if (!inspected.ok) return inspected;
  if (!validate(input)) return schemaFailure(validate.errors?.[0]);
  const config = structuredClone(input);
  if (environmentValue(environment, 'DAAS_ENV') !== config.environment) return fail('/environment', 'environment_mismatch');
  if (/[\p{Cc}\p{Cs}]/u.test(config.user_agent)) return fail('/user_agent', 'invalid_user_agent');
  try { createUrlNormalizer(config.source_policy); } catch { return fail('/source_policy', 'invalid_source_policy'); }
  const evidence = validateEvidencePolicy(config.evidence_policy);
  if (!evidence.ok) return evidence;
  const budget = config.limits;
  if (budget.dns_timeout_ms > budget.request_timeout_ms || budget.request_timeout_ms > budget.run_timeout_ms
    || budget.max_redirects + 1 > budget.max_requests || budget.max_retries + 1 > budget.max_requests) return fail('/limits', 'incompatible_budgets');
  const actor = config.role !== 'integration_service';
  if (actor && (config.secret_refs.mssql_connection_string !== undefined || config.sql_permissions.length)) return fail('/role', 'actor_sql_forbidden');
  if (!actor && (!config.secret_refs.apify_token || !config.secret_refs.mssql_connection_string
    || config.sql_permissions.length !== 3)) return fail('/role', 'integration_capabilities_required');
  const names = config.environment === 'test'
    ? { apify_token: 'DAAS_APIFY_TEST_TOKEN', mssql_connection_string: 'DAAS_MSSQL_TEST_CONNECTION_STRING' }
    : { apify_token: 'DAAS_APIFY_TOKEN', mssql_connection_string: 'DAAS_MSSQL_CONNECTION_STRING' };
  const secrets = new Map<SecretKind, string>();
  for (const kind of ['apify_token', 'mssql_connection_string'] as const) {
    const ref = config.secret_refs[kind];
    if (ref === undefined) continue;
    if (ref !== names[kind]) return fail('/secret_refs', 'secret_reference_forbidden');
    const value = environmentValue(environment, ref);
    if (!value || value.length > 8_192 || /[\p{Cc}\p{Cs}]/u.test(value)) return fail('/secret_refs', 'secret_unavailable');
    secrets.set(kind, value);
  }
  const hash = fingerprint(config);
  if (!hash.ok) return hash;
  const session: RuntimeSession = Object.freeze({
    config: freeze(config), config_fingerprint: hash.value,
    getSecret(kind: SecretKind): Result<string> {
      const value = secrets.get(kind);
      return value === undefined ? fail('/secret_refs', 'secret_unavailable') : { ok: true, value };
    },
  });
  sessions.set(session, config);
  return { ok: true, value: session };
}

/** Internal adapter capability check: plain JSON/forged objects cannot authorize a connection. */
export function getValidatedRuntime(session: unknown): Result<RuntimeConfig> {
  const config = session !== null && typeof session === 'object' ? sessions.get(session) : undefined;
  return config ? { ok: true, value: config } : fail('/', 'invalid_runtime_session');
}
