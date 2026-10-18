import { createServer, setGlobalProxyFromEnv, type RequestListener, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { once } from 'node:events';
import { createServer as createTcpServer, type Socket } from 'node:net';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import type { Result } from '@daas/contracts';
import { createSecureHttpClient, type SecureHttpClientOptions } from '../../packages/shared/src/secure-http.ts';
import { prepareRuntime, type RuntimeSession } from '../../packages/shared/src/runtime-security.ts';
import { fixtureConfig, fixtureEnvironment } from '../fixtures/runtime-security.ts';
import { temporaryTlsFixture } from '../fixtures/tls-fixture.ts';

const localAnswer = async () => [{ address: '127.0.0.1', family: 4 as const }];
const input = (url: string) => ({ url, request_context_id: 'synthetic-context-v1', normalization_version: 'fixture-v1' });
function value<T>(result: Result<T>): T { expect(result.ok).toBe(true); if (!result.ok) throw new Error('Controlled fixture setup failed.'); return result.value; }
function code(result: Result<unknown>) { expect(result.ok).toBe(false); return result.ok ? '' : result.issues[0]?.code; }

async function listen(server: Server, secure = false) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Controlled server has no owned port.');
  return `${secure ? 'https' : 'http'}://fixture.example.test:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
async function withHttp(handler: RequestListener, check: (origin: string, server: Server) => Promise<void>) {
  const server = createServer(handler);
  const origin = await listen(server);
  try { await check(origin, server); } finally { await close(server); }
}
function makeClient(origin: string, limits: Record<string, number> = {}, options: SecureHttpClientOptions = {}) {
  const config = fixtureConfig();
  config.source_policy.allowed_origins = [origin];
  Object.assign(config.limits, limits);
  const session = value(prepareRuntime(config, fixtureEnvironment));
  return value(createSecureHttpClient(session, { resolve: localAnswer, fixture: { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'] }, ...options }));
}

test('SPEC-016-AC-04: public-only hostname resolving to loopback never reaches the actual server', async () => {
  let hits = 0;
  const server = createServer((_request, response) => { hits += 1; response.end('restricted'); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture could not bind an owned port.');
  try {
    const origin = `http://fixture.example.test:${address.port}`;
    const config = fixtureConfig();
    config.source_policy.allowed_origins = [origin];
    const session = prepareRuntime(config, fixtureEnvironment);
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    const client = createSecureHttpClient(session.value, { resolve: async () => [{ address: '127.0.0.1', family: 4 }] });
    expect(client.ok).toBe(true);
    if (!client.ok) return;
    const result = await client.value.fetch({ url: `${origin}/products/item`, request_context_id: config.source_policy.request_context_id, normalization_version: config.source_policy.normalization_version });
    expect({ accepted: result.ok, server_hits: hits }).toEqual({ accepted: false, server_hits: 0 });
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

describe('SPEC-016 HTTP scope and connection authorization', () => {
  test('exact test capability permits native HTTP while preserving Host, query order and a bare ?', async () => {
    const received: { host: string | undefined; target: string | undefined; authorization: string | undefined; cookie: string | undefined }[] = [];
    await withHttp((request, response) => {
      received.push({ host: request.headers.host, target: request.url, authorization: request.headers.authorization, cookie: request.headers.cookie });
      response.setHeader('content-type', 'text/plain'); response.end('fixture-ok');
    }, async (origin) => {
      const client = makeClient(origin);
      const first = value(await client.fetch(input(`${origin}/products/Item?b=2&a=1#route/A`)));
      expect(first.body.toString()).toBe('fixture-ok');
      expect(first.final_url).toBe(`${origin}/products/Item?b=2&a=1#route/A`);
      expect(first.content_type).toBe('text/plain');
      value(await client.fetch(input(`${origin}/products/item?`)));
      expect(received).toEqual([
        { host: new URL(origin).host, target: '/products/Item?b=2&a=1', authorization: undefined, cookie: undefined },
        { host: new URL(origin).host, target: '/products/item?', authorization: undefined, cookie: undefined },
      ]);
      expect(client.correlation).toMatchObject({ source_id: '2', request_context_id: 'synthetic-context-v1', config_version: 'fixture-v1' });
    });
  });

  test('DNS pinning performs one resolution and never resolves the original hostname during connect', async () => {
    let resolutions = 0;
    await withHttp((_request, response) => response.end('pinned'), async (origin) => {
      const client = makeClient(origin, {}, { resolve: async () => { resolutions += 1; return resolutions === 1 ? localAnswer() : [{ address: '10.0.0.1', family: 4 }]; } });
      expect(value(await client.fetch(input(`${origin}/`))).body.toString()).toBe('pinned');
      expect(resolutions).toBe(1);
    });
  });

  test('a mixed DNS set rejects every connection even when the first address is permitted', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end(); }, async (origin) => {
      const client = makeClient(origin, {}, { resolve: async () => [{ address: '127.0.0.1', family: 4 }, { address: '10.0.0.1', family: 4 }] });
      expect(code(await client.fetch(input(origin)))).toBe('destination_denied');
      expect(hits).toBe(0);
    });
  });

  test('test capability cannot be selected by a development runtime or grant another private range', () => {
    const config = fixtureConfig({ environment: 'development', secret_refs: {} });
    const session = value(prepareRuntime(config, { ...fixtureEnvironment, DAAS_ENV: 'development' }));
    expect(code(createSecureHttpClient(session, { fixture: { allowed_origins: config.source_policy.allowed_origins, allowed_addresses: ['127.0.0.1'] } }))).toBe('invalid_fixture_capability');
    const testSession = value(prepareRuntime(fixtureConfig(), fixtureEnvironment));
    expect(code(createSecureHttpClient(testSession, { fixture: { allowed_origins: config.source_policy.allowed_origins, allowed_addresses: ['10.0.0.1'] } }))).toBe('invalid_fixture_capability');
  });

  test('snapshots fixture options so later mutation cannot grant a new origin', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end(); }, async (origin) => {
      const other = origin.replace('fixture.example.test', 'other.example.test');
      const config = fixtureConfig(); config.source_policy.allowed_origins = [origin, other];
      const fixture = { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'] };
      const client = value(createSecureHttpClient(value(prepareRuntime(config, fixtureEnvironment)), { resolve: localAnswer, fixture }));
      fixture.allowed_origins.push(other);
      expect(code(await client.fetch(input(other)))).toBe('destination_denied');
      expect(hits).toBe(0);
    });
  });

  test.each(['/products/a%2fb', '/products/a%5Cb', '/products/%252e%252e/item', '/products/a%00b', '/products/a%1fb', '/products/a%7fb', '/products/a%c2%80b', '/products/a%c2%9fb', '/products/a%ffb'])('rejects ambiguous path %s without connecting', async (path) => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end(); }, async (origin) => {
      expect(code(await makeClient(origin).fetch(input(`${origin}${path}`)))).toBe('ambiguous_url_path');
      expect(hits).toBe(0);
    });
  });

  test('scope/context denial happens before DNS and redacts sensitive input', async () => {
    let resolutions = 0;
    const client = makeClient('http://fixture.example.test', {}, { resolve: async () => { resolutions += 1; return localAnswer(); } });
    const result = await client.fetch(input('http://user:CANARY_SECRET@fixture.example.test/'));
    expect(result.ok).toBe(false); expect(resolutions).toBe(0);
    expect(JSON.stringify(result)).not.toContain('CANARY_SECRET');
    expect((await client.fetch({ ...input('http://fixture.example.test'), request_context_id: 'other' })).ok).toBe(false);
    expect(resolutions).toBe(0);
  });

  test('a serialized or forged session cannot authorize DNS or a connection', () => {
    let resolutions = 0;
    const real = value(prepareRuntime(fixtureConfig(), fixtureEnvironment));
    const forged = { ...real } as RuntimeSession;
    const result = createSecureHttpClient(forged, { resolve: async () => { resolutions += 1; return localAnswer(); } });
    expect(code(result)).toBe('invalid_runtime_session'); expect(resolutions).toBe(0);
  });

  test('an aborted caller opens no connection and a later request can still proceed', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end('ok'); }, async (origin) => {
      const client = makeClient(origin);
      const controller = new AbortController(); controller.abort();
      expect(code(await client.fetch(input(origin), controller.signal))).toBe('request_aborted'); expect(hits).toBe(0);
      value(await client.fetch(input(origin))); expect(hits).toBe(1);
    });
  });

  test('native requests ignore global and environment proxy configuration', async () => {
    let proxyHits = 0;
    await withHttp((_request, response) => { proxyHits += 1; response.end('unexpected-proxy'); }, async (proxyOrigin) => {
      const previous = process.env.HTTP_PROXY;
      process.env.HTTP_PROXY = proxyOrigin.replace('fixture.example.test', '127.0.0.1');
      const restoreGlobal = setGlobalProxyFromEnv({ HTTP_PROXY: process.env.HTTP_PROXY });
      try {
        await withHttp((_request, response) => response.end('direct'), async (origin) => {
          expect(value(await makeClient(origin).fetch(input(origin))).body.toString()).toBe('direct');
          expect(proxyHits).toBe(0);
        });
      } finally { restoreGlobal(); if (previous === undefined) delete process.env.HTTP_PROXY; else process.env.HTTP_PROXY = previous; }
    });
  });
});

describe('SPEC-016 manual redirect boundary', () => {
  test('an approved relative redirect is separately resolved and retains provenance', async () => {
    let resolutions = 0;
    await withHttp((request, response) => {
      if (request.url === '/start') { response.writeHead(302, { location: '/final?variant=A' }); response.end(); }
      else response.end('complete');
    }, async (origin) => {
      const client = makeClient(origin, {}, { resolve: async () => { resolutions += 1; return localAnswer(); } });
      const result = value(await client.fetch(input(`${origin}/start`)));
      expect(result.final_url).toBe(`${origin}/final?variant=A`);
      expect(result.redirect_history).toEqual([`${origin}/start`]); expect(resolutions).toBe(2);
    });
  });
  test('a permitted hostname redirect to private DNS without an exact fixture grant never connects', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.writeHead(302, { location: '/temporary' }); response.end(); }, async (origin, server) => {
      const other = origin.replace('fixture.example.test', 'private.example.test');
      server.removeAllListeners('request');
      server.on('request', (_request, response) => { hits += 1; response.writeHead(302, { location: `${other}/private` }); response.end(); });
      const config = fixtureConfig(); config.source_policy.allowed_origins = [origin, other];
      const client = value(createSecureHttpClient(value(prepareRuntime(config, fixtureEnvironment)), { resolve: localAnswer, fixture: { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'] } }));
      expect(code(await client.fetch(input(`${origin}/start`)))).toBe('destination_denied'); expect(hits).toBe(1);
    });
  });
  test('redirect loops are rejected without another request', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.writeHead(302, { location: '/start' }); response.end(); }, async (origin) => {
      expect(code(await makeClient(origin).fetch(input(`${origin}/start`)))).toBe('redirect_loop'); expect(hits).toBe(1);
    });
  });
  test.each(['http://outside.example.test/private', '/private/path', '/products/a%2fb'])('a redirect to %s must pass scope and path authorization again', async (location) => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.writeHead(302, { location }); response.end(); }, async (origin) => {
      const config = fixtureConfig(); config.source_policy.allowed_origins = [origin]; config.source_policy.allowed_path_prefixes = ['/products'];
      const client = value(createSecureHttpClient(value(prepareRuntime(config, fixtureEnvironment)), { resolve: localAnswer, fixture: { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'] } }));
      expect((await client.fetch(input(`${origin}/products/start`))).ok).toBe(false); expect(hits).toBe(1);
    });
  });
  test('a redirect to a new URL resolves again and rejects a changed restricted answer', async () => {
    let resolutions = 0; let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.writeHead(302, { location: '/second' }); response.end(); }, async (origin) => {
      const client = makeClient(origin, {}, { resolve: async () => {
        resolutions += 1; return resolutions === 1 ? localAnswer() : [{ address: '169.254.169.254', family: 4 }];
      } });
      expect(code(await client.fetch(input(`${origin}/first`)))).toBe('destination_denied');
      expect(resolutions).toBe(2); expect(hits).toBe(1);
    });
  });
  test('redirect and physical request ceilings reject instead of widening the budget', async () => {
    let hits = 0;
    await withHttp((request, response) => { hits += 1; response.writeHead(302, { location: `${request.url ?? '/'}x` }); response.end(); }, async (origin) => {
      expect(code(await makeClient(origin, { max_redirects: 1 }).fetch(input(`${origin}/start`)))).toBe('redirect_limit'); expect(hits).toBe(2);
      hits = 0;
      expect(code(await makeClient(origin, { max_requests: 1, max_redirects: 0, max_retries: 0 }).fetch(input(`${origin}/start`)))).toBe('redirect_limit'); expect(hits).toBe(1);
    });
  });
});

describe('SPEC-016 response, cancellation and shared limits', () => {
  test.each([['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]] as const)('decodes bounded %s responses', async (encoding, compress) => {
    await withHttp((_request, response) => { response.setHeader('content-encoding', encoding); response.end(compress(Buffer.from('decoded-fixture'))); }, async (origin) => {
      expect(value(await makeClient(origin).fetch(input(origin))).body.toString()).toBe('decoded-fixture');
    });
  });
  test('streaming wire bytes are capped even without Content-Length', async () => {
    await withHttp((_request, response) => { response.write('123'); response.end('456'); }, async (origin) => {
      expect(code(await makeClient(origin, { max_wire_bytes: 5 }).fetch(input(origin)))).toBe('wire_bytes_exceeded');
    });
  });
  test('compressed bodies cannot exceed the independent decompressed cap', async () => {
    await withHttp((_request, response) => { response.setHeader('content-encoding', 'gzip'); response.end(gzipSync(Buffer.alloc(4096, 'A'))); }, async (origin) => {
      expect(code(await makeClient(origin, { max_response_bytes: 64 }).fetch(input(origin)))).toBe('response_bytes_exceeded');
    });
  });
  test('Content-Length and malformed compression fail without returning a partial body', async () => {
    await withHttp((_request, response) => { response.setHeader('content-length', '4096'); response.write('partial'); }, async (origin) => {
      expect(code(await makeClient(origin, { max_wire_bytes: 128 }).fetch(input(origin)))).toBe('wire_bytes_exceeded');
    });
    await withHttp((_request, response) => { response.setHeader('content-encoding', 'gzip'); response.end('malformed-gzip'); }, async (origin) => {
      expect(code(await makeClient(origin).fetch(input(origin)))).toBe('request_failed');
    });
  });
  test('oversized response headers fail at the native HTTP parser', async () => {
    await withHttp((_request, response) => { response.setHeader('x-large-fixture', 'x'.repeat(17_000)); response.end('small'); }, async (origin) => {
      expect(code(await makeClient(origin).fetch(input(origin)))).toBe('request_failed');
    });
  });
  test('unknown encodings and protocol upgrades are denied', async () => {
    await withHttp((_request, response) => { response.setHeader('content-encoding', 'unsupported-fixture'); response.end('raw'); }, async (origin) => {
      expect(code(await makeClient(origin).fetch(input(origin)))).toBe('unsupported_content_encoding');
    });
    await withHttp((_request, response) => { response.writeHead(101, { Connection: 'Upgrade', Upgrade: 'fixture' }); response.end(); }, async (origin) => {
      expect(code(await makeClient(origin).fetch(input(origin)))).toBe('protocol_upgrade_denied');
    });
  });
  test('a resolver that never returns is cancelled at its DNS deadline', async () => {
    let signalled = false;
    const client = makeClient('http://fixture.example.test', { request_timeout_ms: 500, dns_timeout_ms: 30 }, { resolve: async (_hostname, signal) => {
      signal.addEventListener('abort', () => { signalled = true; });
      return new Promise(() => undefined);
    } });
    expect(code(await client.fetch(input('http://fixture.example.test')))).toBe('dns_timeout'); expect(signalled).toBe(true);
  });
  test('slow response bodies cannot evade the wall-clock request deadline', async () => {
    await withHttp((_request, response) => { response.write('partial'); }, async (origin) => {
      expect(code(await makeClient(origin, { request_timeout_ms: 70, dns_timeout_ms: 30 }).fetch(input(origin)))).toBe('request_timeout');
    });
  });
  test('a server that never sends response headers is cancelled by the same wall-clock deadline', async () => {
    await withHttp(() => undefined, async (origin) => {
      expect(code(await makeClient(origin, { request_timeout_ms: 70, dns_timeout_ms: 30 }).fetch(input(origin)))).toBe('request_timeout');
    });
  });
  test('a real TCP server that stalls the TLS handshake is cancelled before HTTP', async () => {
    const sockets = new Set<Socket>();
    const server = createTcpServer((socket) => { sockets.add(socket); socket.on('data', () => undefined); socket.on('error', () => undefined); socket.once('close', () => sockets.delete(socket)); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('TLS stall fixture could not bind.');
    try {
      const origin = `https://fixture.example.test:${address.port}`;
      expect(code(await makeClient(origin, { request_timeout_ms: 70, dns_timeout_ms: 30 }).fetch(input(origin)))).toBe('request_timeout');
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  test('external abort cancels a live response and does not expose its supplied reason', async () => {
    await withHttp((_request, response) => { response.write('partial'); }, async (origin) => {
      const controller = new AbortController();
      const request = makeClient(origin).fetch(input(origin), controller.signal);
      const timer = setTimeout(() => controller.abort('CANARY_ABORT_SECRET'), 30);
      const result = await request; clearTimeout(timer);
      expect(code(result)).toBe('request_aborted'); expect(JSON.stringify(result)).not.toContain('CANARY_ABORT_SECRET');
    });
  });
  test('rejects concurrent work, enforces real spacing and shares physical request count', async () => {
    const times: number[] = [];
    await withHttp((_request, response) => { times.push(performance.now()); response.end('ok'); }, async (origin) => {
      const client = makeClient(origin, { max_requests: 2, max_redirects: 0, max_retries: 0 });
      const pending = client.fetch(input(origin));
      expect(code(await client.fetch(input(origin)))).toBe('concurrency_limit');
      value(await pending); value(await client.fetch(input(origin)));
      expect((times[1] ?? 0) - (times[0] ?? 0)).toBeGreaterThanOrEqual(990);
      expect(code(await client.fetch(input(origin)))).toBe('request_budget_exhausted'); expect(times).toHaveLength(2);
    });
  });
  test('constructing another client cannot reset session concurrency, request count or rate spacing', async () => {
    const times: number[] = [];
    await withHttp((_request, response) => { times.push(performance.now()); response.end('ok'); }, async (origin) => {
      const config = fixtureConfig(); config.source_policy.allowed_origins = [origin];
      Object.assign(config.limits, { max_requests: 2, max_redirects: 0, max_retries: 0 });
      const session = value(prepareRuntime(config, fixtureEnvironment));
      const options = { resolve: localAnswer, fixture: { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'] } };
      const first = value(createSecureHttpClient(session, options));
      const second = value(createSecureHttpClient(session, options));
      const pending = first.fetch(input(origin));
      expect(code(await second.fetch(input(origin)))).toBe('concurrency_limit'); value(await pending);
      value(await second.fetch(input(origin)));
      expect((times[1] ?? 0) - (times[0] ?? 0)).toBeGreaterThanOrEqual(990);
      expect(code(await first.fetch(input(origin)))).toBe('request_budget_exhausted');
      const third = value(createSecureHttpClient(session, options));
      expect(code(await third.fetch(input(origin)))).toBe('request_budget_exhausted'); expect(times).toHaveLength(2);
    });
  });
  test('abort during a rate wait stops before opening the next connection', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end(); }, async (origin) => {
      const client = makeClient(origin); value(await client.fetch(input(origin)));
      const controller = new AbortController();
      const pending = client.fetch(input(origin), controller.signal);
      const timer = setTimeout(() => controller.abort(), 30);
      expect(code(await pending)).toBe('request_aborted'); clearTimeout(timer); expect(hits).toBe(1);
    });
  });
  test('run deadline begins at client creation and blocks subsequent work', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end(); }, async (origin) => {
      const client = makeClient(origin, { run_timeout_ms: 50, request_timeout_ms: 40, dns_timeout_ms: 20 });
      await new Promise((resolve) => setTimeout(resolve, 70));
      expect(code(await client.fetch(input(origin)))).toBe('run_timeout'); expect(hits).toBe(0);
    });
  });
  test('run deadline also cancels active work and survives creation of another client', async () => {
    await withHttp((_request, response) => response.write('partial'), async (origin) => {
      const config = fixtureConfig(); config.source_policy.allowed_origins = [origin];
      Object.assign(config.limits, { run_timeout_ms: 60, request_timeout_ms: 60, dns_timeout_ms: 20 });
      const session = value(prepareRuntime(config, fixtureEnvironment));
      const options = { resolve: localAnswer, fixture: { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'] } };
      expect(code(await value(createSecureHttpClient(session, options)).fetch(input(origin)))).toBe('run_timeout');
      expect(code(await value(createSecureHttpClient(session, options)).fetch(input(origin)))).toBe('run_timeout');
    });
  });
  test('run deadline cancels a rate wait without opening a second socket', async () => {
    let hits = 0;
    await withHttp((_request, response) => { hits += 1; response.end('ok'); }, async (origin) => {
      const client = makeClient(origin, { run_timeout_ms: 150, request_timeout_ms: 150, dns_timeout_ms: 30 });
      value(await client.fetch(input(origin)));
      expect(code(await client.fetch(input(origin)))).toBe('run_timeout'); expect(hits).toBe(1);
    });
  });
  test('transport errors never include resolver secrets', async () => {
    const client = makeClient('http://fixture.example.test', {}, { resolve: async () => { throw new Error('CANARY_RESOLVER_SECRET'); } });
    const result = await client.fetch(input('http://fixture.example.test'));
    expect(code(result)).toBe('request_failed'); expect(JSON.stringify(result)).not.toContain('CANARY_RESOLVER_SECRET');
  });
});

test('SPEC-016-AC-04: actual TLS preserves SNI/Host, verifies trust and verifies the original hostname', async () => {
  const tls = temporaryTlsFixture();
  const hosts: (string | undefined)[] = [];
  const serverNames: (string | false | null)[] = [];
  const server = createHttpsServer({ key: tls.key, cert: tls.cert }, (request, response) => { hosts.push(request.headers.host); response.end('tls-ok'); });
  server.on('secureConnection', (socket) => serverNames.push(socket.servername));
  const origin = await listen(server, true);
  try {
    const fixture = { allowed_origins: [origin], allowed_addresses: ['127.0.0.1'], tls_ca: tls.cert.toString() };
    expect(value(await makeClient(origin, {}, { fixture }).fetch(input(origin))).body.toString()).toBe('tls-ok');
    expect(hosts).toEqual([new URL(origin).host]);
    expect(serverNames).toContain('fixture.example.test');
    expect(code(await makeClient(origin).fetch(input(origin)))).toBe('request_failed');
    const wrongOrigin = origin.replace('fixture.example.test', 'wrong.example.test');
    expect(code(await makeClient(wrongOrigin, {}, { fixture: { ...fixture, allowed_origins: [wrongOrigin] } }).fetch(input(wrongOrigin)))).toBe('request_failed');
    expect(hosts).toHaveLength(1);
  } finally { await close(server); tls.cleanup(); }
});
