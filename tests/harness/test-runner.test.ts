import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const probeParent = join(repositoryRoot, 'tests', '.harness-probes');
const vitestCli = join(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs');
const configuration = join(repositoryRoot, 'vitest.config.ts');

function removeProbe(probeRoot: string): void {
  const cleanupTarget = resolve(probeRoot);
  const childPath = relative(resolve(probeParent), cleanupTarget);
  if (!childPath || childPath.startsWith('..') || isAbsolute(childPath)) {
    throw new Error('Refusing to remove a probe outside the harness probe directory.');
  }
  rmSync(cleanupTarget, { recursive: true, force: true });
}

function withProbe(check: (probeRoot: string) => void): void {
  mkdirSync(probeParent, { recursive: true });
  const probeRoot = mkdtempSync(join(probeParent, 'runner-'));

  try {
    check(probeRoot);
  } finally {
    removeProbe(probeRoot);
  }
}

function writeProbe(probeRoot: string, suite: string, source: string): void {
  const filename = join(probeRoot, 'tests', suite, 'runner-probe.test.ts');
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(filename, source, 'utf8');
}

function runSuite(probeRoot: string, suite: string) {
  return spawnSync(
    process.execPath,
    [vitestCli, 'run', '--config', configuration, '--root', probeRoot, '--project', suite],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 15_000,
      shell: false,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
}

describe('SPEC-001-AC-02: real test-runner command behavior', () => {
  test('an empty unit suite cannot report success', () => {
    withProbe((probeRoot) => {
      const result = runSuite(probeRoot, 'unit');

      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('No test files found');
    });
  });

  test.each(['unit', 'contracts'] as const)(
    'the %s project executes its discovered fixture and excludes other suites',
    (suite) => {
      withProbe((probeRoot) => {
        const marker = join(probeRoot, 'executed.txt');
        const otherSuite = suite === 'unit' ? 'contracts' : 'unit';
        writeProbe(
          probeRoot,
          suite,
          `import { writeFileSync } from 'node:fs';\nimport { test } from 'vitest';\ntest('selected probe executes', () => { writeFileSync(${JSON.stringify(marker)}, ${JSON.stringify(suite)}, 'utf8'); });\n`,
        );
        writeProbe(probeRoot, otherSuite, "throw new Error('UNSELECTED_SUITE_EXECUTED');\n");

        const result = runSuite(probeRoot, suite);

        expect(result.error).toBeUndefined();
        expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
        expect(readFileSync(marker, 'utf8')).toBe(suite);
        expect(`${result.stdout}${result.stderr}`).not.toContain('UNSELECTED_SUITE_EXECUTED');
      });
    },
  );

  test('a failing discovered test propagates a nonzero command result', () => {
    withProbe((probeRoot) => {
      writeProbe(
        probeRoot,
        'unit',
        "import { test } from 'vitest';\ntest('intentional failure probe', () => { throw new Error('EXPECTED_PROBE_ASSERTION_FAILURE'); });\n",
      );

      const result = runSuite(probeRoot, 'unit');

      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('EXPECTED_PROBE_ASSERTION_FAILURE');
    });
  });
});
