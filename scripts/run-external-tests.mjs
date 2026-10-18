import { spawnSync } from 'node:child_process';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const suites = [
  { name: 'mssql', project: 'integration', required: ['DAAS_MSSQL_TEST_CONNECTION_STRING'] },
  { name: 'live', project: 'live', required: ['DAAS_APIFY_TEST_TOKEN'] },
];

/** @param {string} project @param {NodeJS.ProcessEnv} env @returns {number} */
function runVitest(project, env) {
  const cli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'run', '--project', project], { env, stdio: 'inherit', shell: false, windowsHide: true });
  if (result.error) {
    console.error('FAIL: Unable to launch the installed test runner. Run npm ci first.');
  }
  return result.status ?? 1;
}

/**
 * @param {string} suite
 * @param {{ env?: NodeJS.ProcessEnv; run?: (project: string, env: NodeJS.ProcessEnv) => number; report?: (message: string) => void }} [options]
 * @returns {number}
 */
export function runExternalSuite(suite, { env = process.env, run = runVitest, report = console.error } = {}) {
  const selected = suites.find((entry) => entry.name === suite);
  if (!selected) {
    report('FAIL: Select mssql or live.');
    return 2;
  }
  if (env.DAAS_ENV !== 'test') {
    report('BLOCKED: External checks require the explicit non-production setting DAAS_ENV=test.');
    return 2;
  }
  const missing = selected.required.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    report(`BLOCKED: Missing test configuration: ${missing.join(', ')}.`);
    return 2;
  }
  return run(selected.project, env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runExternalSuite(process.argv[2] ?? '');
}
