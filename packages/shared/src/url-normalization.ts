import { Ajv, type ErrorObject } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';
import { inspectJson, schemas, type Result } from '@daas/contracts';
import { identityForValidatedUrl, type UrlIdentity } from './url-identity.ts';

export const URL_NORMALIZATION_LIMITS = Object.freeze({ urlCodePoints: 2048, origins: 10, pathPrefixes: 10 });

const text = { type: 'string', minLength: 1, maxLength: URL_NORMALIZATION_LIMITS.urlCodePoints } as const;
const common = schemas.WorkManifest.properties;
// Internal schema reuse keeps runtime authorization aligned with SPEC-004 syntax.
export const urlNormalizationPolicySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    source_id: common.source_id, request_context_id: common.request_context_id, normalization_version: common.normalization_version,
    mode: { type: 'string', const: 'preserve-v1' },
    allowed_origins: { type: 'array', items: text, minItems: 1, maxItems: URL_NORMALIZATION_LIMITS.origins, uniqueItems: true },
    allowed_path_prefixes: { type: 'array', items: text, minItems: 1, maxItems: URL_NORMALIZATION_LIMITS.pathPrefixes, uniqueItems: true },
  },
  required: ['source_id', 'request_context_id', 'normalization_version', 'mode', 'allowed_origins', 'allowed_path_prefixes'],
} as const;
const inputSchema = {
  type: 'object', additionalProperties: false,
  properties: { url: text, base_url: text, request_context_id: common.request_context_id, normalization_version: common.normalization_version },
  required: ['url', 'request_context_id', 'normalization_version'],
} as const;

export type UrlNormalizationPolicy = FromSchema<typeof urlNormalizationPolicySchema>;
export type UrlNormalizationInput = FromSchema<typeof inputSchema>;
export type NormalizedUrl = UrlIdentity & Pick<UrlNormalizationPolicy, 'source_id' | 'request_context_id' | 'normalization_version'> & {
  original_url: string;
  canonical_url: string;
};

const ajv = new Ajv({ strict: true, coerceTypes: false, useDefaults: false, removeAdditional: false, allErrors: false, ownProperties: true, messages: false, logger: false });
ajv.addFormat('sql-bigint', (value: string) => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
const validatePolicy = ajv.compile<UrlNormalizationPolicy>(urlNormalizationPolicySchema);
const validateInput = ajv.compile<UrlNormalizationInput>(inputSchema);

function fail(path: string, code: string): Result<never> {
  return { ok: false, issues: [{ path, code }] };
}

function inputIssue(error: ErrorObject | undefined): Result<never> {
  const known = ['url', 'base_url', 'request_context_id', 'normalization_version'];
  const missing: unknown = error?.keyword === 'required' ? error.params.missingProperty : undefined;
  const field = typeof missing === 'string' ? missing : error?.instancePath.slice(1);
  return fail(field && known.includes(field) ? `/${field}` : '/', `schema_${error?.keyword ?? 'invalid'}`);
}

function safeSyntax(value: string): boolean {
  return value.isWellFormed() && !/[\s\\]/u.test(value)
    && ![...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159)
    && !/%(?![0-9a-f]{2})/i.test(value);
}

/** Parse syntax only; this function makes no DNS or network authorization decision. */
function parseReference(value: string, base: URL | undefined, path: string): Result<URL> {
  if (!safeSyntax(value)) return fail(path, 'invalid_url_syntax');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) return fail(path, 'unsupported_url_scheme');
  if (hasScheme || value.startsWith('//')) {
    const authority = value.slice(value.indexOf('//') + 2).split(/[/?#]/)[0];
    if (!authority || authority.includes('@')) return fail(path, 'invalid_url_authority');
  }
  if (!hasScheme && !base) return fail(path, 'explicit_base_required');
  try {
    const parsed = base ? new URL(value, base) : new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return fail(path, 'invalid_http_url');
    if ([...parsed.href].length > URL_NORMALIZATION_LIMITS.urlCodePoints) return fail(path, 'canonical_url_limit');
    return { ok: true, value: parsed };
  } catch { return fail(path, 'invalid_url_syntax'); }
}

function trustedPolicy(configuration: unknown): UrlNormalizationPolicy {
  if (!inspectJson(configuration).ok || !validatePolicy(configuration)) throw new Error('Invalid URL normalization policy.');
  const policy = structuredClone(configuration);
  for (const origin of policy.allowed_origins) {
    const parsed = parseReference(origin, undefined, '/allowed_origins');
    if (!parsed.ok || parsed.value.origin !== origin) throw new Error('Invalid URL normalization policy.');
  }
  const origin = policy.allowed_origins[0];
  if (!origin) throw new Error('Invalid URL normalization policy.');
  const base = new URL(origin);
  for (const prefix of policy.allowed_path_prefixes) {
    const parsed = parseReference(prefix, base, '/allowed_path_prefixes');
    if (!prefix.startsWith('/') || prefix.startsWith('//') || !parsed.ok || parsed.value.pathname !== prefix) throw new Error('Invalid URL normalization policy.');
  }
  return policy;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

/** Snapshot a caller-approved policy; untrusted references cannot select their own policy. */
export function createUrlNormalizer(configuration: unknown) {
  const policy = trustedPolicy(configuration);

  return (input: unknown): Result<NormalizedUrl> => {
    const inspected = inspectJson(input);
    if (!inspected.ok) return inspected;
    if (!validateInput(input)) return inputIssue(validateInput.errors?.[0]);
    if (input.request_context_id !== policy.request_context_id) return fail('/request_context_id', 'context_mismatch');
    if (input.normalization_version !== policy.normalization_version) return fail('/normalization_version', 'policy_version_mismatch');
    let base: URL | undefined;
    if (input.base_url !== undefined) {
      const parsedBase = parseReference(input.base_url, undefined, '/base_url');
      if (!parsedBase.ok) return parsedBase;
      base = parsedBase.value;
    }
    const parsed = parseReference(input.url, base, '/url');
    if (!parsed.ok) return parsed;
    if (!policy.allowed_origins.includes(parsed.value.origin)) return fail('/url', 'origin_out_of_scope');
    if (!policy.allowed_path_prefixes.some((prefix) => matchesPrefix(parsed.value.pathname, prefix))) return fail('/url', 'path_out_of_scope');
    // href retains empty ?/# and exact query-pair serialization, unlike rebuilding from getters.
    const canonicalUrl = parsed.value.href;
    const identity = identityForValidatedUrl({ source_id: policy.source_id, request_context_id: policy.request_context_id, normalization_version: policy.normalization_version, canonical_url: canonicalUrl });
    if (!identity.ok) return identity;
    return { ok: true, value: {
      ...identity.value, source_id: policy.source_id, request_context_id: policy.request_context_id,
      normalization_version: policy.normalization_version, original_url: input.url, canonical_url: canonicalUrl,
    } };
  };
}
