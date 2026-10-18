import { CONTRACT_LIMITS, fingerprint, inspectJson, type Result } from '@daas/contracts';

export type UrlIdentity = { identity_key: string; identity_hash: string };
type IdentityParts = { source_id: string; request_context_id: string; normalization_version: string; canonical_url: string };
const identityTag = 'daas-url-identity-v1';
const maximumKeyBytes = 4096;
const partFields = ['source_id', 'request_context_id', 'normalization_version', 'canonical_url'] as const;

function fail(path: string, code: string): Result<never> {
  return { ok: false, issues: [{ path, code }] };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= CONTRACT_LIMITS.identifiers && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function checkParts(value: unknown): Result<IdentityParts> {
  const inspected = inspectJson(value);
  if (!inspected.ok) return inspected;
  const parts = inspected.value;
  if (parts === null || Array.isArray(parts) || typeof parts !== 'object' || Object.keys(parts).length !== partFields.length || partFields.some((field) => !Object.hasOwn(parts, field))) {
    return fail('', 'identity_parts_shape');
  }
  if (typeof parts.source_id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(parts.source_id) || BigInt(parts.source_id) > 9223372036854775807n) return fail('/source_id', 'identity_source_id');
  if (!isIdentifier(parts.request_context_id)) return fail('/request_context_id', 'identity_context_id');
  if (!isIdentifier(parts.normalization_version)) return fail('/normalization_version', 'identity_normalization_version');
  if (typeof parts.canonical_url !== 'string' || [...parts.canonical_url].length > CONTRACT_LIMITS.urls || !/^https?:\/\//i.test(parts.canonical_url)) return fail('/canonical_url', 'identity_canonical_url');
  // The owning normalizer validates URL syntax/serialization and trusted scope first.
  return { ok: true, value: parts as IdentityParts };
}

function identityTuple(parts: IdentityParts): string[] {
  const tuple = [identityTag, parts.source_id, parts.request_context_id, parts.normalization_version, parts.canonical_url];
  // A new array must not invoke an inherited toJSON hook when constructing its bytes.
  Object.setPrototypeOf(tuple, null);
  return tuple;
}

/** Internal builder: the factory supplies an already normalized, scope-checked URL. */
export function identityForValidatedUrl(parts: IdentityParts): Result<UrlIdentity> {
  const checked = checkParts(parts);
  if (!checked.ok) return checked;
  const tuple = identityTuple(checked.value);
  const identity_key = JSON.stringify(tuple);
  if (Buffer.byteLength(identity_key, 'utf8') > maximumKeyBytes) return fail('/identity_key', 'identity_key_limit');
  const hashed = fingerprint(tuple);
  if (!hashed.ok) return hashed;
  return { ok: true, value: { identity_key, identity_hash: hashed.value } };
}

function checkIdentity(value: unknown): Result<UrlIdentity> {
  const inspected = inspectJson(value);
  if (!inspected.ok) return inspected;
  const metadata = inspected.value;
  if (metadata === null || Array.isArray(metadata) || typeof metadata !== 'object' || Object.keys(metadata).length !== 2 || !Object.hasOwn(metadata, 'identity_key') || !Object.hasOwn(metadata, 'identity_hash')) {
    return fail('', 'identity_metadata_shape');
  }
  if (typeof metadata.identity_key !== 'string' || Buffer.byteLength(metadata.identity_key, 'utf8') > maximumKeyBytes) return fail('/identity_key', 'identity_key_limit');
  if (typeof metadata.identity_hash !== 'string' || !/^[0-9a-f]{64}$/.test(metadata.identity_hash)) return fail('/identity_hash', 'identity_hash_format');
  let tuple: unknown;
  try { tuple = JSON.parse(metadata.identity_key) as unknown; } catch { return fail('/identity_key', 'identity_key_format'); }
  if (!Array.isArray(tuple) || tuple.length !== 5 || tuple[0] !== identityTag) return fail('/identity_key', 'identity_key_format');
  const parts = checkParts({ source_id: tuple[1] as unknown, request_context_id: tuple[2] as unknown, normalization_version: tuple[3] as unknown, canonical_url: tuple[4] as unknown });
  if (!parts.ok || JSON.stringify(identityTuple(parts.value)) !== metadata.identity_key) return fail('/identity_key', 'identity_key_format');
  return { ok: true, value: metadata as UrlIdentity };
}

/** Compare exact lookup metadata, not a full normalization result or authenticated data. */
export function compareUrlIdentities(left: UrlIdentity, right: UrlIdentity): Result<'same' | 'different' | 'hash_collision'> {
  const checkedLeft = checkIdentity(left);
  if (!checkedLeft.ok) return checkedLeft;
  const checkedRight = checkIdentity(right);
  if (!checkedRight.ok) return checkedRight;
  if (checkedLeft.value.identity_key === checkedRight.value.identity_key) {
    if (checkedLeft.value.identity_hash !== checkedRight.value.identity_hash) return fail('/identity_hash', 'inconsistent_identity_hash');
    return { ok: true, value: 'same' };
  }
  return { ok: true, value: checkedLeft.value.identity_hash === checkedRight.value.identity_hash ? 'hash_collision' : 'different' };
}
