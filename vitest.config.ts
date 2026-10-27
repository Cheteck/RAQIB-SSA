import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      'dist/**',
      'node_modules/**',
      'tests/playwright/**',
    ],
    include: [
      'tests/**/*.spec.ts',
    ],
    testTimeout: 30000,
  },
});
