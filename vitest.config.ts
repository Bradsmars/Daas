import { defineConfig } from 'vitest/config';

const suites = ['harness', 'unit', 'contracts', 'integration', 'live'] as const;

export default defineConfig({
  test: {
    projects: suites.map((name) => ({
      test: {
        name,
        environment: 'node',
        include: [`tests/${name}/**/*.test.ts`],
        passWithNoTests: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
      },
    })),
  },
});
