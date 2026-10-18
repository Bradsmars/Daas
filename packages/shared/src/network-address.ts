import { BlockList, isIP } from 'node:net';
import { inspectJson, type Result } from '@daas/contracts';

export type ResolvedAddress = { address: string; family: 4 | 6 };

// Conservative policy: reject every IANA special-purpose IPv4 allocation,
// multicast/reserved space and Azure's platform virtual address. Public special
// allocations are deliberately denied too; this is not an IANA reachability API.
const ipv4Denied = new BlockList();
const ipv4Subnets: readonly [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.31.196.0', 24], ['192.52.193.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
];
for (const [address, prefix] of ipv4Subnets) ipv4Denied.addSubnet(address, prefix, 'ipv4');
ipv4Denied.addAddress('168.63.129.16', 'ipv4');

// Restrict IPv6 to ordinary global unicast, excluding special-purpose, tunnel
// and documentation allocations. Mapped, compatible and NAT64 forms therefore
// cannot turn a denied IPv4 address into an approved IPv6 destination.
const ipv6Global = new BlockList();
ipv6Global.addSubnet('2000::', 3, 'ipv6');
const ipv6Denied = new BlockList();
const ipv6Subnets: readonly [string, number][] = [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['2620:4f:8000::', 48], ['3fff::', 20],
];
for (const [address, prefix] of ipv6Subnets) ipv6Denied.addSubnet(address, prefix, 'ipv6');

function denied(code: string): Result<never> {
  return { ok: false, issues: [{ path: '/addresses', code }] };
}

function addressFamily(address: string): 0 | 4 | 6 {
  // Node accepts scoped IPv6 addresses; an external target must never select
  // a local network interface through a resolver-provided zone identifier.
  const family = address.includes('%') ? 0 : isIP(address);
  return family === 4 || family === 6 ? family : 0;
}

/** Authorize the whole DNS answer set; no filtering or second resolution. */
export function validateResolvedAddresses(answers: unknown, allowedLoopback: readonly string[] = []): Result<readonly ResolvedAddress[]> {
  const exceptions = inspectJson(allowedLoopback);
  if (!exceptions.ok || !Array.isArray(exceptions.value) || exceptions.value.length > 2
    || exceptions.value.some((address) => address !== '127.0.0.1' && address !== '::1')) return denied('invalid_loopback_exception');
  const inspected = inspectJson(answers);
  if (!inspected.ok || !Array.isArray(inspected.value) || inspected.value.length < 1 || inspected.value.length > 16) return denied('invalid_dns_answers');

  const addresses: ResolvedAddress[] = [];
  for (const answer of inspected.value) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || Object.keys(answer).length !== 2
      || !Object.hasOwn(answer, 'address') || !Object.hasOwn(answer, 'family')) return denied('invalid_dns_answers');
    const { address, family } = answer;
    if (typeof address !== 'string' || family !== 4 && family !== 6 || addressFamily(address) !== family) return denied('invalid_dns_answers');
    const exception = (address === '127.0.0.1' || address === '::1') && exceptions.value.includes(address);
    const publicAddress = family === 4 ? !ipv4Denied.check(address, 'ipv4')
      : ipv6Global.check(address, 'ipv6') && !ipv6Denied.check(address, 'ipv6');
    if (!exception && !publicAddress) return denied('destination_denied');
    if (!addresses.some((prior) => sameIpAddress(prior.address, address))) addresses.push(Object.freeze({ address, family }));
  }
  return { ok: true, value: Object.freeze(addresses) };
}

/** Compare a pinned IP with actual socket peer forms, including mapped IPv4. */
export function sameIpAddress(left: string, right: string): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftFamily = addressFamily(left);
  const rightFamily = addressFamily(right);
  if (!leftFamily || !rightFamily) return false;
  const expected = new BlockList();
  expected.addAddress(left, leftFamily === 4 ? 'ipv4' : 'ipv6');
  return expected.check(right, rightFamily === 4 ? 'ipv4' : 'ipv6');
}
