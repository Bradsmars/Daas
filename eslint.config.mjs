import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'tests/.harness-probes/**'] },
  { ...js.configs.recommended, files: ['**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly' } } },
  { files: ['**/*.ts'], extends: [js.configs.recommended, ...tseslint.configs.recommended] },
);
