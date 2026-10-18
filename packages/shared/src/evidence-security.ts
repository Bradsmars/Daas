import type { FromSchema } from 'json-schema-to-ts';
import { Ajv } from 'ajv';
import { inspectJson, schemas, validateContract, type EvidenceReference, type Result } from '@daas/contracts';

const id = schemas.WorkManifest.properties.request_context_id;
const prefix = { type: 'string', minLength: 2, maxLength: 512, pattern: '^[A-Za-z0-9][A-Za-z0-9._/-]*/$' } as const;
export const evidencePolicySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    policy_id: id, policy_version: id, required: { type: 'boolean' },
    retention_seconds: { type: 'integer', minimum: 0, maximum: 31_536_000 },
    locations: {
      type: 'array', minItems: 0, maxItems: 10,
      items: {
        type: 'object', additionalProperties: false,
        properties: { storage_provider: id, location_id: id, retention_class: id, key_prefix: prefix, max_bytes: { type: 'integer', minimum: 1, maximum: 1_048_576 } },
        required: ['storage_provider', 'location_id', 'retention_class', 'key_prefix', 'max_bytes'],
      },
    },
  }, required: ['policy_id', 'policy_version', 'required', 'retention_seconds', 'locations'],
} as const;
export type EvidencePolicy = FromSchema<typeof evidencePolicySchema>;

const ownerSchema = {
  type: 'object', additionalProperties: false,
  properties: { request_context_id: id, object_key_prefix: prefix },
  required: ['request_context_id', 'object_key_prefix'],
} as const;
type EvidenceOwner = FromSchema<typeof ownerSchema>;
const ajv = new Ajv({ strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false, ownProperties: true, allErrors: false, messages: false, logger: false });
const policyShape = ajv.compile<EvidencePolicy>(evidencePolicySchema);
const ownerShape = ajv.compile<EvidenceOwner>(ownerSchema);

function failure(path: string, code: string): Result<never> {
  return { ok: false, issues: [{ path, code }] };
}

function safePrefix(value: string): boolean {
  return value.slice(0, -1).split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

/** Validate descriptor policy only; no provider access or retention is implied. */
export function validateEvidencePolicy(input: unknown): Result<EvidencePolicy> {
  if (!inspectJson(input).ok || !policyShape(input)) return failure('/evidence_policy', 'invalid_evidence_policy');
  const disabled = input.locations.length === 0;
  if (disabled ? input.required || input.retention_seconds !== 0 : input.retention_seconds === 0) return failure('/evidence_policy', 'inconsistent_evidence_policy');
  const mappings = new Set<string>();
  for (const location of input.locations) {
    if (!safePrefix(location.key_prefix)) return failure('/evidence_policy/locations', 'invalid_evidence_prefix');
    const mapping = `${location.storage_provider}/${location.location_id}`;
    if (mappings.has(mapping)) return failure('/evidence_policy/locations', 'ambiguous_evidence_location');
    mappings.add(mapping);
  }
  const snapshot = structuredClone(input);
  snapshot.locations.forEach(Object.freeze);
  Object.freeze(snapshot.locations);
  return { ok: true, value: Object.freeze(snapshot) };
}

/** The caller, never a returned descriptor, supplies approved storage and owner. */
export function createEvidenceReferenceValidator(configuration: unknown, ownership: unknown): Result<(reference: unknown) => Result<EvidenceReference>> {
  const checked = validateEvidencePolicy(configuration);
  if (!checked.ok) return checked;
  if (!inspectJson(ownership).ok || !ownerShape(ownership) || !safePrefix(ownership.object_key_prefix)) return failure('/evidence_owner', 'invalid_evidence_owner');
  const policy = checked.value;
  const owner = Object.freeze(structuredClone(ownership));
  if (policy.locations.length > 0 && !policy.locations.some((location) => owner.object_key_prefix.startsWith(location.key_prefix))) return failure('/evidence_owner', 'evidence_owner_out_of_scope');

  return { ok: true, value: (reference) => {
    const result = validateContract('EvidenceReference', reference);
    if (!result.ok) return result;
    const item = result.value;
    if (item.request_context_id !== owner.request_context_id || item.policy_id !== policy.policy_id || item.policy_version !== policy.policy_version) return failure('/evidence_refs', 'evidence_scope_mismatch');
    const location = policy.locations.find((entry) => entry.storage_provider === item.storage_provider && entry.location_id === item.location_id && entry.retention_class === item.retention_class);
    if (!location || !item.object_key.startsWith(location.key_prefix) || !item.object_key.startsWith(owner.object_key_prefix)) return failure('/evidence_refs', 'evidence_location_denied');
    if (item.byte_length > location.max_bytes) return failure('/evidence_refs', 'evidence_byte_limit');
    return { ok: true, value: Object.freeze(structuredClone(item)) };
  } };
}
