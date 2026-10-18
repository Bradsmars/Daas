import { expect, test } from 'vitest';
import { validateContract, type ContractName } from '@daas/contracts';
import { event } from './fixtures.ts';

test('SPEC-002-AC-01: business data cannot substitute for a missing attempt identity', () => {
  const input: Record<string, unknown> = structuredClone(event);
  delete input.attempt_id;
  const result = validateContract('ExtractionEvent', input);
  expect(result.ok).toBe(false);
});

test.each(['toString', 'constructor', '__proto__', 'UnknownContract'])(
  'SPEC-002-AC-01: runtime contract name %s fails closed', (name) => {
    const result = validateContract(name as ContractName, {});
    expect(result).toEqual({ ok: false, issues: [{ path: '/', code: 'unsupported_contract' }] });
  },
);

test('SPEC-002-AC-01: even an empty credential marker is rejected', () => {
  expect(validateContract('ExtractionEvent', { ...event, requested_url: 'https://@target.example.test/item' }).ok).toBe(false);
});
