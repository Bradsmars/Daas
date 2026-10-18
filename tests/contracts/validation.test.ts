import { describe, expect, test } from 'vitest';
import {
  CONTRACT_LIMITS,
  createExtractionValidator,
  manifestFingerprint,
  parseContract,
  validateContract,
  validateDiscoveryCandidate,
  validateDiscoveryCoverage,
  validateExecutionSummary,
} from '@daas/contracts';
import {
  candidate, coverage, discoveryInput, event, evidence, ids, profile, summary, unsignedManifest, withDigest,
} from './fixtures.ts';

const otherUuid = '00000000-0000-4000-8000-000000000099';

function manifest() {
  const result = manifestFingerprint(unsignedManifest);
  if (!result.ok) throw new Error('The approved fixture manifest must have a fingerprint.');
  return withDigest(result.value);
}

function changedEvent(patch: Record<string, unknown>) {
  return { ...structuredClone(event), ...patch };
}

describe('SPEC-002-AC-01: strict, unchanged boundary contracts', () => {
  test('all approved synthetic boundary fixtures validate', () => {
    const examples = [
      ['DiscoveryInput', discoveryInput], ['DiscoveryCandidate', candidate],
      ['DiscoveryCoverage', coverage], ['EvidenceReference', evidence],
      ['ExtractionEvent', event], ['ExecutionSummary', summary],
      ['WorkManifest', manifest()], ['ExtractionInput', manifest()],
    ] as const;
    for (const [name, value] of examples) {
      expect(validateContract(name, value).ok, name).toBe(true);
    }
  });

  test.each([
    ['schema_version', 2], ['schema_version', '1'], ['event_id', 'not-a-uuid'],
    ['source_id', 2], ['source_id', '0'], ['source_id', '02'], ['source_id', '-1'],
    ['source_id', '1e3'], ['source_id', '9223372036854775808'], ['lease_generation', '0'],
    ['observed_at', '2023-02-29T00:00:00Z'], ['observed_at', '2024-02-30T00:00:00Z'],
    ['observed_at', '2024-01-01T00:00:00+00:00'], ['observed_at', '2024-01-01T00:00:00'],
    ['observed_at', '2024-01-01T24:00:00Z'], ['requested_url', '/relative'],
    ['requested_url', 'file:///tmp/item'], ['requested_url', 'https://user:password@example.test/item'],
    ['requested_url', 'https://example.test/' + 'a'.repeat(2048)],
    ['outcome', 'unknown'], ['http_status', 600], ['http_status', '200'],
    ['parser_version', ''], ['parser_version', 'a'.repeat(129)],
  ])('rejects invalid %s value %j without coercion', (field, value) => {
    const input = changedEvent({ [field]: value });
    const before = structuredClone(input);
    expect(validateContract('ExtractionEvent', input).ok).toBe(false);
    expect(input).toEqual(before);
  });

  test.each(['event_id', 'attempt_id', 'http_status', 'final_url', 'evidence_refs'])(
    'rejects an absent required %s field',
    (field) => {
      const input: Record<string, unknown> = structuredClone(event);
      delete input[field];
      expect(validateContract('ExtractionEvent', input).ok).toBe(false);
    },
  );

  test.each(['1970-01-01T00:00:00Z', '2024-02-29T23:59:59.123Z'])(
    'accepts the valid UTC instant %s',
    (observed_at) => {
      expect(validateContract('ExtractionEvent', changedEvent({ observed_at })).ok).toBe(true);
    },
  );

  test('accepts the largest SQL BIGINT identity as an unchanged string', () => {
    const input = changedEvent({ source_id: '9223372036854775807' });
    const result = validateContract('ExtractionEvent', input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.source_id).toBe('9223372036854775807');
  });

  test('preserves raw records, meaningful URLs, nulls and zero/false values', () => {
    const input = structuredClone(event);
    const before = structuredClone(input);
    const result = validateContract('ExtractionEvent', input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(before);
    expect(input).toEqual(before);
  });

  test('accepts a mixed-case HTTP scheme while preserving its original URL string', () => {
    const requested_url = 'HTTPS://target.example.test/Item?variant=A';
    const result = validateContract('ExtractionEvent', changedEvent({ requested_url }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.requested_url).toBe(requested_url);
  });

  test('rejects unknown envelope fields without deleting them or exposing their values', () => {
    const secret = 'SENTINEL_SENSITIVE_PAYLOAD_002';
    const input = changedEvent({ unexpected: secret });
    const result = validateContract('ExtractionEvent', input);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect((input as Record<string, unknown>).unexpected).toBe(secret);
  });

  test('raw JSON validation keeps string identifiers and rejects malformed input safely', () => {
    expect(parseContract('ExtractionEvent', JSON.stringify(event)).ok).toBe(true);
    const secret = 'SENTINEL_MALFORMED_JSON_SECRET';
    const result = parseContract('ExtractionEvent', `{"secret":"${secret}",`);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

describe('SPEC-002-AC-01: finite contract boundary values', () => {
  const boundedArrays = [
    {
      label: 'discovery seeds', contract: 'DiscoveryInput' as const, maximum: CONTRACT_LIMITS.seeds,
      build: (length: number) => ({ ...discoveryInput, seeds: Array.from({ length }, (_, index) => ({ partition_id: `seed-${index}`, url: `https://discovery.example.test/list-${index}` })) }),
    },
    {
      label: 'coverage partitions', contract: 'DiscoveryCoverage' as const, maximum: CONTRACT_LIMITS.partitions,
      build: (length: number) => ({
        ...coverage,
        partitions: Array.from({ length }, (_, index) => ({ partition_id: `seed-${index}`, state: 'complete', counts: { raw: 0, accepted: 0, duplicate: 0, rejected: 0 }, errors: [] })),
        counts: { raw: 0, accepted: 0, duplicate: 0, rejected: 0 },
      }),
    },
    {
      label: 'extraction assignments', contract: 'WorkManifest' as const, maximum: CONTRACT_LIMITS.assignments,
      build: (length: number) => {
        const input = manifest();
        input.assignments = Array.from({ length }, (_, index) => ({
          attempt_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          url_id: String(index + 1), canonical_url: `https://target.example.test/item-${index}`, lease_generation: '1',
        }));
        const digest = manifestFingerprint(input);
        if (!digest.ok) throw new Error('A finite assignment fixture must have a fingerprint.');
        input.manifest_fingerprint = digest.value;
        return input;
      },
    },
    {
      label: 'business records', contract: 'ExtractionEvent' as const, maximum: CONTRACT_LIMITS.records,
      build: (length: number) => changedEvent({ records: Array.from({ length }, () => structuredClone(event.records[0])) }),
    },
    {
      label: 'redirect history', contract: 'ExtractionEvent' as const, maximum: CONTRACT_LIMITS.redirects,
      build: (length: number) => changedEvent({ redirect_history: Array.from({ length }, (_, index) => `https://target.example.test/redirect-${index}`) }),
    },
    {
      label: 'evidence references', contract: 'ExtractionEvent' as const, maximum: CONTRACT_LIMITS.evidence,
      build: (length: number) => changedEvent({ evidence_refs: Array.from({ length }, () => structuredClone(evidence)) }),
    },
    {
      label: 'failure reasons', contract: 'ExtractionEvent' as const, maximum: CONTRACT_LIMITS.errors,
      build: (length: number) => changedEvent({ outcome: 'blocked', records: [], errors: Array.from({ length }, () => ({ code: 'fixture-error', reason: 'fixture-reason' })) }),
    },
  ];

  test.each(boundedArrays)('$label accepts its maximum and rejects one above it', ({ contract, maximum, build }) => {
    expect(validateContract(contract, build(maximum)).ok).toBe(true);
    expect(validateContract(contract, build(maximum + 1)).ok).toBe(false);
  });

  test('identifier and reason lengths have inclusive upper bounds', () => {
    expect(validateContract('ExtractionEvent', changedEvent({ parser_version: 'a'.repeat(CONTRACT_LIMITS.identifiers) })).ok).toBe(true);
    expect(validateContract('ExtractionEvent', changedEvent({ parser_version: 'a'.repeat(CONTRACT_LIMITS.identifiers + 1) })).ok).toBe(false);
    const failure = changedEvent({ outcome: 'blocked', records: [], errors: [{ code: 'fixture-error', reason: 'a'.repeat(CONTRACT_LIMITS.reasons) }] });
    expect(validateContract('ExtractionEvent', failure).ok).toBe(true);
    expect(validateContract('ExtractionEvent', { ...failure, errors: [{ code: 'fixture-error', reason: 'a'.repeat(CONTRACT_LIMITS.reasons + 1) }] }).ok).toBe(false);
  });

  test('URL length accepts the maximum without rewriting the original URL', () => {
    const prefix = 'https://target.example.test/';
    const requested_url = prefix + 'a'.repeat(CONTRACT_LIMITS.urls - prefix.length);
    const input = changedEvent({ requested_url });
    const result = validateContract('ExtractionEvent', input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.requested_url).toBe(requested_url);
    expect(validateContract('ExtractionEvent', changedEvent({ requested_url: `${requested_url}a` })).ok).toBe(false);
  });

  test.each(Object.keys(discoveryInput.limits) as (keyof typeof discoveryInput.limits)[])(
    'the %s runtime-limit field rejects values above its finite bound',
    (field) => {
      expect(validateContract('DiscoveryInput', { ...discoveryInput, limits: { ...discoveryInput.limits, [field]: 1_000_000 } }).ok).toBe(true);
      expect(validateContract('DiscoveryInput', { ...discoveryInput, limits: { ...discoveryInput.limits, [field]: 1_000_001 } }).ok).toBe(false);
      expect(validateContract('DiscoveryInput', { ...discoveryInput, limits: { ...discoveryInput.limits, [field]: -1 } }).ok).toBe(false);
    },
  );

  test('zero is permitted for depth, redirects and retries without disabling other required limits', () => {
    const input = structuredClone(discoveryInput);
    input.limits.max_depth = 0;
    input.limits.max_redirects = 0;
    input.limits.max_retries = 0;
    expect(validateContract('DiscoveryInput', input).ok).toBe(true);
    for (const field of ['max_requests', 'max_pages', 'max_candidates', 'max_bytes', 'max_runtime_ms', 'requests_per_minute'] as const) {
      expect(validateContract('DiscoveryInput', { ...input, limits: { ...input.limits, [field]: 0 } }).ok).toBe(false);
    }
  });

  test('evidence byte and key lengths and continuation tokens are bounded', () => {
    expect(validateContract('EvidenceReference', { ...evidence, byte_length: 1_048_576, object_key: 'a'.repeat(512) }).ok).toBe(true);
    expect(validateContract('EvidenceReference', { ...evidence, byte_length: 1_048_577 }).ok).toBe(false);
    expect(validateContract('EvidenceReference', { ...evidence, object_key: 'a'.repeat(513) }).ok).toBe(false);
    expect(validateContract('DiscoveryInput', { ...discoveryInput, continuation: { version: 1, token: 'a'.repeat(1024) } }).ok).toBe(true);
    expect(validateContract('DiscoveryInput', { ...discoveryInput, continuation: { version: 1, token: 'a'.repeat(1025) } }).ok).toBe(false);
  });
});

describe('SPEC-002-AC-02: trusted extraction semantics and assignment correlation', () => {
  test('snapshots approved configuration so later caller mutation cannot broaden trust', () => {
    const configuration = structuredClone(profile);
    const validate = createExtractionValidator(configuration);
    configuration.max_records = 0;
    configuration.record_schema.required = [];
    configuration.evidence_policy.allowed_locations.push({ storage_provider: 'unapproved', location_id: 'unapproved', retention_class: 'test-only' });
    expect(validate(event, manifest(), event.apify_run_id).ok).toBe(true);
    expect(validate(changedEvent({ records: [{}] }), manifest(), event.apify_run_id).ok).toBe(false);
    expect(validate(changedEvent({ evidence_refs: [{ ...evidence, storage_provider: 'unapproved', location_id: 'unapproved' }] }), manifest(), event.apify_run_id).ok).toBe(false);
  });

  test('structural validation alone cannot establish usable source records', () => {
    const input = changedEvent({ records: [{}] });
    expect(validateContract('ExtractionEvent', input).ok).toBe(true);
    expect(createExtractionValidator(profile)(input, manifest(), event.apify_run_id).ok).toBe(false);
  });

  test.each([0, 1, 3])('permits the trusted profile cardinality of %i records', (count) => {
    const input = changedEvent({ records: Array.from({ length: count }, () => structuredClone(event.records[0])) });
    expect(createExtractionValidator(profile)(input, manifest(), event.apify_run_id).ok).toBe(true);
  });

  test.each([
    ['source_id', '9'], ['request_context_id', 'wrong-context'], ['page_type', 'wrong-page'],
    ['profile_version', 'unregistered-v2'], ['parser_version', 'wrong-parser'],
    ['config_version', 'wrong-config'], ['normalization_version', 'wrong-normalization'],
    ['actor_build_id', 'wrong-build'], ['run_id', otherUuid], ['dispatch_id', otherUuid],
    ['attempt_id', otherUuid], ['lease_generation', '2'], ['url_id', '9'],
    ['requested_url', 'https://target.example.test/Other'], ['apify_run_id', 'other-physical-run'],
  ])('rejects an event with mismatched %s', (field, value) => {
    expect(createExtractionValidator(profile)(changedEvent({ [field]: value }), manifest(), event.apify_run_id).ok).toBe(false);
  });

  test.each([
    ['too many records', Array.from({ length: 4 }, () => structuredClone(event.records[0]))],
    ['missing required fields', [{ title: 'Only a title' }]],
    ['coerced number', [{ ...event.records[0], amount: '0' }]],
    ['coerced boolean', [{ ...event.records[0], available: 'false' }]],
    ['unknown business field', [{ ...event.records[0], unexpected: 'extra' }]],
  ])('rejects %s under the trusted record schema', (_label, records) => {
    expect(createExtractionValidator(profile)(changedEvent({ records }), manifest(), event.apify_run_id).ok).toBe(false);
  });

  test.each([
    ['missing response status', { http_status: null }],
    ['missing response URL', { final_url: null }],
    ['HTTP failure presented as success', { http_status: 404 }],
    ['errors presented as success', { errors: [{ code: 'blocked', reason: 'fixture-reason' }] }],
  ])('rejects success with %s', (_label, patch) => {
    expect(validateContract('ExtractionEvent', changedEvent(patch)).ok).toBe(false);
  });

  test.each(['blocked', 'not_found'] as const)('permits a known HTTP-200 %s outcome without usable records', (outcome) => {
    const input = changedEvent({ outcome, records: [], errors: [{ code: outcome, reason: 'fixture-reason' }] });
    expect(createExtractionValidator(profile)(input, manifest(), event.apify_run_id).ok).toBe(true);
  });

  test('accepts a network failure with explicitly absent HTTP response data', () => {
    const input = changedEvent({ outcome: 'network_error', http_status: null, final_url: null, records: [], errors: [{ code: 'network', reason: 'fixture-reason' }] });
    expect(createExtractionValidator(profile)(input, manifest(), event.apify_run_id).ok).toBe(true);
  });

  test.each([
    ['retained usable records', { outcome: 'blocked', errors: [{ code: 'blocked', reason: 'fixture-reason' }] }],
    ['missing structured reasons', { outcome: 'blocked', records: [] }],
    ['fabricated network response', { outcome: 'network_error', records: [], errors: [{ code: 'network', reason: 'fixture-reason' }] }],
    ['successful HTTP status as http_error', { outcome: 'http_error', records: [], errors: [{ code: 'http', reason: 'fixture-reason' }] }],
  ])('rejects a failure with %s', (_label, patch) => {
    expect(validateContract('ExtractionEvent', changedEvent(patch)).ok).toBe(false);
  });

  test('requires evidence only when the trusted profile policy requires it', () => {
    const requiredProfile = structuredClone(profile);
    requiredProfile.evidence_policy.required = true;
    const validate = createExtractionValidator(requiredProfile);
    expect(validate(event, manifest(), event.apify_run_id).ok).toBe(false);
    expect(validate(changedEvent({ evidence_refs: [evidence] }), manifest(), event.apify_run_id).ok).toBe(true);
  });

  test.each([
    ['storage_provider', 'unapproved-provider'], ['location_id', 'unapproved-location'],
    ['retention_class', 'unapproved-retention'], ['policy_id', 'unapproved-policy'],
    ['policy_version', 'v2'], ['request_context_id', 'wrong-context'],
  ])('rejects evidence with an unapproved %s', (field, value) => {
    const input = changedEvent({ evidence_refs: [{ ...evidence, [field]: value }] });
    expect(createExtractionValidator(profile)(input, manifest(), event.apify_run_id).ok).toBe(false);
  });

  test.each(['https://example.test/capture?token=secret', '../outside.html', 'captures/item?token=secret'])(
    'rejects unsafe evidence object keys: %s',
    (object_key) => {
      expect(validateContract('EvidenceReference', { ...evidence, object_key }).ok).toBe(false);
    },
  );

  test('rejects tampered input and empty extraction assignments', () => {
    const input = manifest();
    input.limits.max_requests += 1;
    expect(validateContract('WorkManifest', input).ok).toBe(false);
    expect(validateContract('ExtractionInput', { ...manifest(), assignments: [] }).ok).toBe(false);
  });

  test('rejects repeated logical attempts in one manifest', () => {
    const input = manifest();
    const assignment = input.assignments[0];
    if (!assignment) throw new Error('The fixture requires an assigned attempt.');
    input.assignments.push({ ...assignment });
    const digest = manifestFingerprint(input);
    if (digest.ok) input.manifest_fingerprint = digest.value;
    expect(validateContract('WorkManifest', input).ok).toBe(false);
  });
});

describe('SPEC-002-AC-04: source provenance and honest coverage', () => {
  test('keeps the discovery source distinct from approved target ownership', () => {
    const result = validateDiscoveryCandidate(candidate, discoveryInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.discovery_source_id).toBe('1');
      expect(result.value.target_source_id).toBe('2');
      expect(result.value.canonical_url).toBe(candidate.canonical_url);
    }
  });

  test.each([
    ['discovery_run_id', otherUuid], ['discovery_source_id', '9'], ['target_source_id', '9'],
    ['request_context_id', 'wrong-context'], ['normalization_version', 'wrong-version'],
    ['config_version', 'wrong-config'], ['page_type', 'wrong-page'],
    ['canonical_url', 'https://outside.example.test/item'],
  ])('rejects a candidate with mismatched %s', (field, value) => {
    expect(validateDiscoveryCandidate({ ...candidate, [field]: value }, discoveryInput).ok).toBe(false);
  });

  test('accepts complete coverage only for the declared complete partition set', () => {
    expect(validateDiscoveryCoverage(coverage, discoveryInput).ok).toBe(true);
    const input = structuredClone(discoveryInput);
    input.seeds.push({ partition_id: 'seed-2', url: 'https://discovery.example.test/second-list' });
    expect(validateDiscoveryCoverage(coverage, input).ok).toBe(false);
  });

  test.each(['page_limit', 'request_limit', 'candidate_limit', 'byte_limit', 'runtime_limit', 'cancelled'] as const)(
    '%s can be reported as partial coverage but never complete',
    (stop_reason) => {
      const partial = structuredClone(coverage);
      partial.stop_reason = stop_reason;
      partial.coverage_state = 'partial';
      const partition = partial.partitions[0];
      if (!partition) throw new Error('The fixture requires a discovery partition.');
      partition.state = 'partial';
      expect(validateDiscoveryCoverage(partial, discoveryInput).ok).toBe(true);
      expect(validateDiscoveryCoverage({ ...partial, coverage_state: 'complete' }, discoveryInput).ok).toBe(false);
    },
  );

  test.each([
    ['discovery_run_id', otherUuid], ['dispatch_id', otherUuid],
    ['scope_version', 'wrong-scope'], ['config_version', 'wrong-config'],
  ])('rejects coverage with mismatched %s', (field, value) => {
    expect(validateDiscoveryCoverage({ ...coverage, [field]: value }, discoveryInput).ok).toBe(false);
  });

  test('rejects duplicate and unexpected partition identities', () => {
    const partition = coverage.partitions[0];
    if (!partition) throw new Error('The fixture requires a discovery partition.');
    expect(validateDiscoveryCoverage({ ...coverage, partitions: [partition, partition] }, discoveryInput).ok).toBe(false);
    expect(validateDiscoveryCoverage({ ...coverage, partitions: [{ ...partition, partition_id: 'undeclared-seed' }] }, discoveryInput).ok).toBe(false);
  });

  test('rejects internally inconsistent partition counts and aggregate totals', () => {
    const input = structuredClone(coverage);
    const partition = input.partitions[0];
    if (!partition) throw new Error('The fixture requires a discovery partition.');
    partition.counts.raw = 2;
    expect(validateDiscoveryCoverage(input, discoveryInput).ok).toBe(false);
    expect(validateDiscoveryCoverage({ ...coverage, counts: { ...coverage.counts, raw: 2 } }, discoveryInput).ok).toBe(false);
  });

  test('accepts an explicitly failed partition with error evidence as failed coverage', () => {
    const input = structuredClone(coverage);
    input.coverage_state = 'failed';
    input.stop_reason = 'error';
    const partition = input.partitions[0];
    if (!partition) throw new Error('The fixture requires a discovery partition.');
    partition.state = 'failed';
    partition.errors = [{ code: 'fixture-error', reason: 'fixture-reason' }];
    expect(validateDiscoveryCoverage(input, discoveryInput).ok).toBe(true);
  });
});

describe('SPEC-002-AC-01: bounded execution accounting', () => {
  test('an interrupted subset of a multi-assignment execution cannot claim finished', () => {
    const expected = manifest();
    const first = expected.assignments[0];
    if (!first) throw new Error('The fixture requires an assigned attempt.');
    expected.assignments.push({ ...first, attempt_id: otherUuid, url_id: '4', canonical_url: 'https://target.example.test/second-item' });
    const digest = manifestFingerprint(expected);
    if (!digest.ok) throw new Error('The fixture manifest must have a fingerprint.');
    expected.manifest_fingerprint = digest.value;
    const partial = { ...summary, assigned_count: 2, stop_reason: 'error' };
    expect(validateExecutionSummary(partial, expected, event.apify_run_id).ok).toBe(true);
    expect(validateExecutionSummary({ ...partial, stop_reason: 'finished' }, expected, event.apify_run_id).ok).toBe(false);
  });

  test('accepts matching execution accounting and a cancelled run with no fabricated results', () => {
    expect(validateExecutionSummary(summary, manifest(), event.apify_run_id).ok).toBe(true);
    const cancelled = { ...summary, processed_count: 0, emitted_count: 0, emitted_attempt_ids: [], stop_reason: 'cancelled' };
    expect(validateExecutionSummary(cancelled, manifest(), event.apify_run_id).ok).toBe(true);
  });

  test.each([
    ['apify_run_id', 'wrong-physical-run'], ['dispatch_id', otherUuid],
    ['assigned_count', 2], ['processed_count', 2], ['processed_count', 0],
    ['emitted_count', 0], ['emitted_attempt_ids', []], ['emitted_attempt_ids', [otherUuid]],
    ['emitted_attempt_ids', [ids.attempt, ids.attempt]],
  ])('rejects summary with inconsistent %s', (field, value) => {
    expect(validateExecutionSummary({ ...summary, [field]: value }, manifest(), event.apify_run_id).ok).toBe(false);
  });
});
