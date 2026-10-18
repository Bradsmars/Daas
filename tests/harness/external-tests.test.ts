import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runExternalSuite } from '../../scripts/run-external-tests.mjs';

describe('external verification preflight', () => {
  it('reports missing MSSQL test configuration as BLOCKED before launching a test', () => {
    const run = vi.fn(() => 0);
    const report = vi.fn();

    const status = runExternalSuite('mssql', { env: {}, run, report });

    expect(status).toBe(2);
    expect(run).not.toHaveBeenCalled();
    expect(report.mock.calls.flat().join(' ')).toContain('BLOCKED');
  });

  it.each(['development', 'production', '', undefined])('requires an explicit test environment (%s)', (mode) => {
    const run = vi.fn(() => 0);
    const report = vi.fn();
    const env: NodeJS.ProcessEnv = { DAAS_MSSQL_TEST_CONNECTION_STRING: 'synthetic-secret' };
    if (mode !== undefined) env.DAAS_ENV = mode;

    expect(runExternalSuite('mssql', { env, run, report })).toBe(2);
    expect(run).not.toHaveBeenCalled();
    expect(report.mock.calls.flat().join(' ')).toContain('DAAS_ENV=test');
    expect(report.mock.calls.flat().join(' ')).not.toContain('synthetic-secret');
  });

  it.each(['', '   ', undefined])('requires a nonblank SQL test secret (%s)', (connection) => {
    const run = vi.fn(() => 0);
    const report = vi.fn();
    const env: NodeJS.ProcessEnv = { DAAS_ENV: 'test' };
    if (connection !== undefined) env.DAAS_MSSQL_TEST_CONNECTION_STRING = connection;

    expect(runExternalSuite('mssql', { env, run, report })).toBe(2);
    expect(run).not.toHaveBeenCalled();
    expect(report.mock.calls.flat().join(' ')).toContain('DAAS_MSSQL_TEST_CONNECTION_STRING');
  });

  it('names the missing live token without exposing other configured secret values', () => {
    const run = vi.fn(() => 0);
    const report = vi.fn();
    const env = { DAAS_ENV: 'test', DAAS_MSSQL_TEST_CONNECTION_STRING: 'synthetic-secret' };

    expect(runExternalSuite('live', { env, run, report })).toBe(2);
    expect(run).not.toHaveBeenCalled();
    expect(report.mock.calls.flat().join(' ')).toContain('DAAS_APIFY_TEST_TOKEN');
    expect(report.mock.calls.flat().join(' ')).not.toContain('synthetic-secret');
  });

  it('rejects unknown suites before launch', () => {
    const run = vi.fn(() => 0);
    const report = vi.fn();
    expect(runExternalSuite('unknown', { run, report })).toBe(2);
    expect(run).not.toHaveBeenCalled();
    expect(report.mock.calls.flat().join(' ')).toContain('FAIL');
  });

  it.each([0, 1, 7])('preserves the actual SQL test runner result (%s)', (result) => {
    const run = vi.fn(() => result);
    const report = vi.fn();
    const env = { DAAS_ENV: 'test', DAAS_MSSQL_TEST_CONNECTION_STRING: 'synthetic-secret' };

    expect(runExternalSuite('mssql', { env, run, report })).toBe(result);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith('integration', env);
    expect(report).not.toHaveBeenCalled();
  });

  it('dispatches live checks separately from SQL checks', () => {
    const run = vi.fn(() => 1);
    const env = { DAAS_ENV: 'test', DAAS_APIFY_TEST_TOKEN: 'synthetic-secret' };
    expect(runExternalSuite('live', { env, run })).toBe(1);
    expect(run).toHaveBeenCalledWith('live', env);
  });

  it('passes the validated environment to the runner rather than an unrelated process environment', () => {
    const run = vi.fn(() => 1);
    const env = { DAAS_ENV: 'test', DAAS_MSSQL_TEST_CONNECTION_STRING: 'synthetic-secret' };
    expect(runExternalSuite('mssql', { env, run })).toBe(1);
    expect(run).toHaveBeenCalledWith('integration', env);
  });

  it('exposes BLOCKED and nonzero exit status through the real command-line entry point', () => {
    const cli = fileURLToPath(new URL('../../scripts/run-external-tests.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [cli, 'mssql'], {
      env: { ...process.env, DAAS_ENV: 'test', DAAS_MSSQL_TEST_CONNECTION_STRING: '' },
      encoding: 'utf8',
      shell: false,
      timeout: 10_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('BLOCKED');
    expect(result.stderr).toContain('DAAS_MSSQL_TEST_CONNECTION_STRING');
  });
});
