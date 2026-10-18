import { describe, expect, it } from 'vitest';
import { sameIpAddress, validateResolvedAddresses } from '../../packages/shared/src/network-address.ts';

describe('resolved destination authorization', () => {
  it('denies a loopback DNS answer before a transport can use it', () => {
    expect(validateResolvedAddresses([{ address: '127.0.0.1', family: 4 }])).toEqual({
      ok: false, issues: [{ path: '/addresses', code: 'destination_denied' }],
    });
  });

  it.each([
    ['8.8.8.8', 4], ['1.1.1.1', 4], ['93.184.216.34', 4],
    ['2001:4860:4860::8888', 6], ['2606:4700:4700::1111', 6],
    ['2000::', 6], ['3ffe:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 6],
    ['100.63.255.255', 4], ['100.128.0.0', 4], ['172.15.255.255', 4], ['172.32.0.0', 4],
    ['198.17.255.255', 4], ['198.20.0.0', 4], ['2001:200::', 6], ['3fff:1000::', 6],
  ])('accepts ordinary public address %s', (address, family) => {
    expect(validateResolvedAddresses([{ address, family }])).toEqual({ ok: true, value: [{ address, family }] });
  });

  const forbidden = [
    '0.0.0.0', '0.255.255.255', '10.0.0.0', '10.255.255.255',
    '100.64.0.0', '100.127.255.255', '127.0.0.1', '127.255.255.255',
    '169.254.0.0', '169.254.169.254', '169.254.255.255', '168.63.129.16',
    '172.16.0.0', '172.31.255.255', '192.0.0.0', '192.0.0.9', '192.0.0.255',
    '192.0.2.10', '192.31.196.1', '192.52.193.1', '192.88.99.2', '192.168.1.1', '192.175.48.1',
    '198.18.0.0', '198.19.255.255', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '239.255.255.255', '240.0.0.0', '255.255.255.255',
    '::', '::1', '0:0:0:0:0:0:0:1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '::ffff:7f00:1',
    '::8.8.8.8', '64:ff9b::808:808', '64:ff9b:1::a00:1', '100::1', '100:0:0:1::1',
    '2001::1', '2001:1::1', '2001:2::1', '2001:20::1', '2001:db8::1', '2002:808:808::1',
    '2620:4f:8000::1', '3fff::1', '3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff',
    '4000::1', '5f00::1', 'fc00::1', 'fdff:ffff::1', 'fe80::1', 'fec0::1', 'ff02::1',
  ];
  it.each(forbidden)('denies restricted/special address %s', (address) => {
    const family = address.includes(':') ? 6 : 4;
    expect(validateResolvedAddresses([{ address, family }])).toEqual({ ok: false, issues: [{ path: '/addresses', code: 'destination_denied' }] });
  });

  it.each([
    undefined, null, {}, [], new Array(2),
    [{ address: '127.1', family: 4 }], [{ address: '2130706433', family: 4 }],
    [{ address: '0x7f000001', family: 4 }], [{ address: '0177.0.0.1', family: 4 }],
    [{ address: '[2001:4860::8888]', family: 6 }], [{ address: '2001:4860::8888%eth0', family: 6 }],
    [{ address: ' 8.8.8.8', family: 4 }], [{ address: '8.8.8.8 ', family: 4 }],
    [{ address: '8.8.8.8', family: 6 }], [{ address: '2001:4860::8888', family: 4 }],
    [{ address: '8.8.8.8', family: '4' }], [{ address: '8.8.8.8' }],
    [{ address: '8.8.8.8', family: 4, extra: 'untrusted' }],
    Array.from({ length: 17 }, () => ({ address: '8.8.8.8', family: 4 })),
  ])('rejects malformed or unbounded DNS answers %#', (answers) => {
    expect(validateResolvedAddresses(answers).ok).toBe(false);
  });

  it('rejects getters and proxies without invoking their traps', () => {
    let invoked = false;
    const getter = { get address() { invoked = true; return '8.8.8.8'; }, family: 4 };
    expect(validateResolvedAddresses([getter]).ok).toBe(false);
    const proxy = new Proxy({ address: '8.8.8.8', family: 4 }, { ownKeys() { invoked = true; return []; } });
    expect(validateResolvedAddresses([proxy]).ok).toBe(false);
    expect(invoked).toBe(false);
  });

  it('rejects a complete mixed DNS set rather than filtering to a public answer', () => {
    const result = validateResolvedAddresses([{ address: '8.8.8.8', family: 4 }, { address: 'fd00::1', family: 6 }]);
    expect(result.ok).toBe(false);
  });

  it('deduplicates equivalent approved IPs and snapshots immutable answers', () => {
    const input = [{ address: '2001:4860::8888', family: 6 }, { address: '2001:4860:0:0:0:0:0:8888', family: 6 }, { address: '8.8.8.8', family: 4 }];
    const result = validateResolvedAddresses(input);
    expect(result).toEqual({ ok: true, value: [input[0], input[2]] });
    input[0]!.address = '::1';
    if (!result.ok) throw new Error('Expected approved addresses.');
    expect(result.value[0]!.address).toBe('2001:4860::8888');
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value[0])).toBe(true);
  });

  it('accepts exactly sixteen answers before deduplicating them', () => {
    expect(validateResolvedAddresses(Array.from({ length: 16 }, () => ({ address: '8.8.8.8', family: 4 }))))
      .toEqual({ ok: true, value: [{ address: '8.8.8.8', family: 4 }] });
  });

  it('only permits the explicitly trusted exact loopback exceptions', () => {
    expect(validateResolvedAddresses([{ address: '127.0.0.1', family: 4 }], ['127.0.0.1']).ok).toBe(true);
    expect(validateResolvedAddresses([{ address: '::1', family: 6 }], ['::1']).ok).toBe(true);
    for (const address of ['127.0.0.2', '10.0.0.1', '169.254.169.254', '::ffff:127.0.0.1']) {
      expect(validateResolvedAddresses([{ address, family: address.includes(':') ? 6 : 4 }], ['127.0.0.1', '::1']).ok).toBe(false);
    }
    expect(validateResolvedAddresses([{ address: '127.0.0.1', family: 4 }], ['::1']).ok).toBe(false);
  });

  it('rejects an exception list that attempts to authorize arbitrary private destinations', () => {
    expect(validateResolvedAddresses([{ address: '8.8.8.8', family: 4 }], ['10.0.0.1']).ok).toBe(false);
  });

  it('never includes rejected addresses or keys in diagnostics', () => {
    const value = 'secret-canary';
    const result = validateResolvedAddresses([{ [value]: value }]);
    expect(JSON.stringify(result)).not.toContain(value);
  });
});

describe('actual peer IP comparison', () => {
  it.each([
    ['8.8.8.8', '::ffff:8.8.8.8'], ['::ffff:808:808', '8.8.8.8'],
    ['2001:4860::8888', '2001:4860:0:0:0:0:0:8888'], ['127.0.0.1', '::ffff:7f00:1'],
  ])('recognizes equivalent peer forms %s and %s', (left, right) => {
    expect(sameIpAddress(left, right)).toBe(true);
    expect(sameIpAddress(right, left)).toBe(true);
  });

  it.each([
    ['8.8.8.8', '1.1.1.1'], ['2001:4860::8888', '2001:4860::8844'],
    ['bad-address', 'bad-address'], ['127.1', '127.0.0.1'], ['::1%eth0', '::1'],
    ['64:ff9b::808:808', '8.8.8.8'],
  ])('does not conflate %s and %s', (left, right) => {
    expect(sameIpAddress(left, right)).toBe(false);
  });
});
