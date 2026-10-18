import { lookup } from 'node:dns/promises';
import { Agent as HttpAgent, request as httpRequest, type IncomingMessage } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Result } from '@daas/contracts';
import { sameIpAddress, validateResolvedAddresses, type ResolvedAddress } from './network-address.ts';
import { getValidatedRuntime, type RuntimeConfig, type RuntimeSession } from './runtime-security.ts';
import { createUrlNormalizer } from './url-normalization.ts';

export type SecureHttpResponse = {
  requested_url: string;
  final_url: string;
  redirect_history: string[];
  status_code: number;
  content_type: string | null;
  body: Buffer;
};
export type SecureHttpClientOptions = {
  resolve?: (hostname: string, signal: AbortSignal) => Promise<readonly ResolvedAddress[]>;
  fixture?: { allowed_origins: readonly string[]; allowed_addresses: readonly string[]; tls_ca?: string };
};
export type SecureHttpClient = {
  readonly correlation: Readonly<{ source_id: string; request_context_id: string; config_version: string; config_fingerprint: string }>;
  fetch(input: unknown, signal?: AbortSignal): Promise<Result<SecureHttpResponse>>;
};
type SessionBudget = { started: number; active: boolean; request_count: number; last_request: number };
const sessionBudgets = new WeakMap<RuntimeSession, SessionBudget>();

class TransportFailure extends Error {
  readonly code: string;
  constructor(code: string) { super('Outbound request denied or failed.'); this.code = code; }
}
const fail = (code: string): Result<never> => ({ ok: false, issues: [{ path: '/request', code }] });
const reject = (code: string): never => { throw new TransportFailure(code); };
function aborted(signal: AbortSignal): never {
  throw signal.reason instanceof TransportFailure ? signal.reason : new TransportFailure('request_aborted');
}

/** Race external work against cancellation even when an injected resolver ignores its signal. */
function interruptible<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, rejectPromise) => {
    const abort = () => rejectPromise(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, rejectPromise).finally(() => signal.removeEventListener('abort', abort)).catch(() => undefined);
  });
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, rejectPromise) => {
    const abort = () => { clearTimeout(timer); rejectPromise(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, Math.max(0, milliseconds));
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function defaultResolve(hostname: string): Promise<readonly ResolvedAddress[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map((answer) => {
    if (answer.family !== 4 && answer.family !== 6) throw new TransportFailure('invalid_dns_family');
    return { address: answer.address, family: answer.family };
  });
}

async function resolveWithin(hostname: string, resolver: NonNullable<SecureHttpClientOptions['resolve']>, timeout: number, parent: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason);
  parent.addEventListener('abort', abort, { once: true });
  if (parent.aborted) abort();
  const timer = setTimeout(() => controller.abort(new TransportFailure('dns_timeout')), timeout);
  try {
    if (controller.signal.aborted) aborted(controller.signal);
    const family = isIP(hostname);
    if (family === 4 || family === 6) return [{ address: hostname, family }];
    return await interruptible(Promise.resolve().then(() => resolver(hostname, controller.signal)), controller.signal);
  } finally { clearTimeout(timer); parent.removeEventListener('abort', abort); }
}

function fixtureSnapshot(config: RuntimeConfig, options: SecureHttpClientOptions) {
  const fixture = options.fixture;
  if (fixture === undefined) return undefined;
  if (config.environment !== 'test' || !Array.isArray(fixture.allowed_origins) || fixture.allowed_origins.length === 0
    || fixture.allowed_origins.length > 10 || !fixture.allowed_origins.every((origin) => typeof origin === 'string' && config.source_policy.allowed_origins.includes(origin))
    || new Set(fixture.allowed_origins).size !== fixture.allowed_origins.length
    || !Array.isArray(fixture.allowed_addresses) || fixture.allowed_addresses.length === 0 || fixture.allowed_addresses.length > 2
    || !fixture.allowed_addresses.every((address) => address === '127.0.0.1' || address === '::1')
    || new Set(fixture.allowed_addresses).size !== fixture.allowed_addresses.length
    || (fixture.tls_ca !== undefined && (typeof fixture.tls_ca !== 'string' || fixture.tls_ca.length === 0 || Buffer.byteLength(fixture.tls_ca) > 65_536))) reject('invalid_fixture_capability');
  return Object.freeze({ allowed_origins: Object.freeze([...fixture.allowed_origins]), allowed_addresses: Object.freeze([...fixture.allowed_addresses]), tls_ca: fixture.tls_ca });
}

/** Reject path ambiguities at the authorization boundary without rewriting URL identity. */
function authorizePath(url: URL) {
  if (/%(?:2f|5c|25|2e|0[0-9a-f]|1[0-9a-f]|7f)/i.test(url.pathname)) reject('ambiguous_url_path');
  try {
    if (/[\p{Cc}\p{Cs}]/u.test(decodeURIComponent(url.pathname))) reject('ambiguous_url_path');
  } catch { reject('ambiguous_url_path'); }
}

async function readResponse(response: IncomingMessage, config: RuntimeConfig, signal: AbortSignal): Promise<Buffer> {
  const encoding = response.headers['content-encoding']?.trim().toLowerCase() ?? 'identity';
  if (!['identity', 'gzip', 'deflate', 'br'].includes(encoding)) reject('unsupported_content_encoding');
  const length = response.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || BigInt(length) > BigInt(config.limits.max_wire_bytes))) reject('wire_bytes_exceeded');
  let wireBytes = 0;
  let decodedBytes = 0;
  const chunks: Buffer[] = [];
  const wire = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    wireBytes += chunk.length;
    if (wireBytes > config.limits.max_wire_bytes) callback(new TransportFailure('wire_bytes_exceeded'));
    else callback(null, chunk);
  } });
  const sink = new Writable({ write(chunk: Buffer, _encoding, callback) {
    decodedBytes += chunk.length;
    if (decodedBytes > config.limits.max_response_bytes) callback(new TransportFailure('response_bytes_exceeded'));
    else { chunks.push(chunk); callback(); }
  } });
  const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : undefined;
  if (decoder) await pipeline(response, wire, decoder, sink, { signal });
  else await pipeline(response, wire, sink, { signal });
  return Buffer.concat(chunks, decodedBytes);
}

async function requestPinned(url: URL, address: ResolvedAddress, config: RuntimeConfig, signal: AbortSignal, tlsCa: string | undefined): Promise<{ response: IncomingMessage; body: Buffer }> {
  const secure = url.protocol === 'https:';
  // A fresh isolated agent never consumes environment proxies or reuses an earlier DNS decision.
  const agent = secure ? new HttpsAgent({ keepAlive: false, proxyEnv: {} }) : new HttpAgent({ keepAlive: false, proxyEnv: {} });
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const options = {
    hostname: address.address, family: address.family, port: url.port || (secure ? 443 : 80),
    method: 'GET', path: url.href.slice(url.origin.length).split('#')[0] || '/',
    headers: { Host: url.host, 'User-Agent': config.user_agent, 'Accept-Encoding': 'gzip, deflate, br', Connection: 'close' },
    maxHeaderSize: 16_384, signal, agent,
    ...(secure ? { servername: hostname, rejectUnauthorized: true, ...(tlsCa === undefined ? {} : { ca: tlsCa }) } : {}),
  };
  const request = secure ? httpsRequest(options) : httpRequest(options);
  let response: IncomingMessage | undefined;
  try {
    response = await new Promise<IncomingMessage>((resolve, rejectPromise) => {
      request.once('response', resolve);
      request.once('error', rejectPromise);
      request.once('upgrade', (_response, socket) => { socket.destroy(); rejectPromise(new TransportFailure('protocol_upgrade_denied')); });
      request.once('connect', (_response, socket) => { socket.destroy(); rejectPromise(new TransportFailure('protocol_upgrade_denied')); });
      request.on('socket', (socket) => socket.once('connect', () => {
        if (!socket.remoteAddress || !sameIpAddress(socket.remoteAddress, address.address)) request.destroy(new TransportFailure('connection_address_mismatch'));
      }));
      request.end();
    });
    const body = await readResponse(response, config, signal);
    return { response, body };
  } finally { response?.destroy(); request.destroy(); agent.destroy(); }
}

/** Direct HTTP(S) GET boundary. Approval and cancellation remain bound to every physical connection. */
export function createSecureHttpClient(session: RuntimeSession, options: SecureHttpClientOptions = {}): Result<SecureHttpClient> {
  const validated = getValidatedRuntime(session);
  if (!validated.ok) return validated;
  const config = validated.value;
  let fixture: ReturnType<typeof fixtureSnapshot>;
  try { fixture = fixtureSnapshot(config, options); } catch { return fail('invalid_fixture_capability'); }
  if (options.resolve !== undefined && typeof options.resolve !== 'function') return fail('invalid_resolver');
  const resolver = options.resolve ?? defaultResolve;
  const normalize = createUrlNormalizer(config.source_policy);
  let budget = sessionBudgets.get(session);
  if (!budget) {
    budget = { started: performance.now(), active: false, request_count: 0, last_request: -Infinity };
    sessionBudgets.set(session, budget);
  }
  const shared = budget;
  const correlation = Object.freeze({ source_id: config.source_policy.source_id, request_context_id: config.source_policy.request_context_id, config_version: config.config_version, config_fingerprint: session.config_fingerprint });

  return { ok: true, value: Object.freeze({ correlation, async fetch(input: unknown, externalSignal?: AbortSignal): Promise<Result<SecureHttpResponse>> {
    if (shared.active) return fail('concurrency_limit');
    const initial = normalize(input);
    if (!initial.ok) return initial;
    if (performance.now() - shared.started >= config.limits.run_timeout_ms) return fail('run_timeout');
    shared.active = true;
    const controller = new AbortController();
    const abort = () => controller.abort(new TransportFailure('request_aborted'));
    externalSignal?.addEventListener('abort', abort, { once: true });
    if (externalSignal?.aborted) abort();
    const runRemaining = config.limits.run_timeout_ms - (performance.now() - shared.started);
    const timeout = Math.min(config.limits.request_timeout_ms, runRemaining);
    const timeoutCode = runRemaining <= config.limits.request_timeout_ms ? 'run_timeout' : 'request_timeout';
    const timer = setTimeout(() => controller.abort(new TransportFailure(timeoutCode)), timeout);
    const signal = controller.signal;
    const history: string[] = [];
    const visited = new Set<string>();
    let current = initial.value;
    try {
      while (true) {
        if (signal.aborted) aborted(signal);
        const url = new URL(current.canonical_url);
        authorizePath(url);
        const target = url.href.split('#')[0] ?? url.href;
        if (visited.has(target)) reject('redirect_loop');
        visited.add(target);
        if (shared.request_count >= config.limits.max_requests) reject('request_budget_exhausted');
        let delay = shared.last_request + config.limits.min_request_interval_ms - performance.now();
        while (delay > 0) {
          await wait(delay, signal);
          delay = shared.last_request + config.limits.min_request_interval_ms - performance.now();
        }
        const hostname = url.hostname.replace(/^\[|\]$/g, '');
        const answers = await resolveWithin(hostname, resolver, config.limits.dns_timeout_ms, signal);
        const allowedLoopback = fixture?.allowed_origins.includes(url.origin) ? fixture.allowed_addresses : [];
        const addresses = validateResolvedAddresses(answers, allowedLoopback);
        if (!addresses.ok) return addresses;
        const address = addresses.value[0];
        if (!address) throw new TransportFailure('empty_dns_answer');
        if (signal.aborted) aborted(signal);
        shared.request_count += 1;
        shared.last_request = performance.now();
        const { response, body } = await requestPinned(url, address, config, signal, fixture?.allowed_origins.includes(url.origin) ? fixture.tls_ca : undefined);
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          if (history.length >= config.limits.max_redirects) reject('redirect_limit');
          const location = response.headers.location;
          if (!location) reject('redirect_location_missing');
          const next = normalize({ url: location, base_url: current.canonical_url, request_context_id: config.source_policy.request_context_id, normalization_version: config.source_policy.normalization_version });
          if (!next.ok) return next;
          history.push(current.canonical_url);
          current = next.value;
          continue;
        }
        if (status < 200 || status > 599) reject('unsupported_http_status');
        return { ok: true, value: { requested_url: initial.value.canonical_url, final_url: current.canonical_url, redirect_history: history, status_code: status, content_type: response.headers['content-type'] ?? null, body } };
      }
    } catch (error) {
      if (signal.aborted) return fail(signal.reason instanceof TransportFailure ? signal.reason.code : 'request_aborted');
      return fail(error instanceof TransportFailure ? error.code : 'request_failed');
    } finally { clearTimeout(timer); externalSignal?.removeEventListener('abort', abort); shared.active = false; }
  } }) };
}
