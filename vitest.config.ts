import { defineConfig } from 'vitest/config';
import path from 'path';

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
    alias: {
      '@coding-engine/core': path.resolve(__dirname, './coding-engine/packages/core/src/index.ts'),
      '@coding-engine/providers': path.resolve(__dirname, './coding-engine/packages/providers/src/index.ts'),
      '@coding-engine/project': path.resolve(__dirname, './coding-engine/packages/project/src/index.ts'),
      '@coding-engine/tools': path.resolve(__dirname, './coding-engine/packages/tools/src/index.ts'),
      '@coding-engine/execution': path.resolve(__dirname, './coding-engine/packages/execution/src/index.ts'),
      '@coding-engine/validation': path.resolve(__dirname, './coding-engine/packages/validation/src/index.ts'),
      '@coding-engine/storage': path.resolve(__dirname, './coding-engine/packages/storage/src/index.ts'),
      '@coding-engine/runtime': path.resolve(__dirname, './coding-engine/packages/runtime/src/index.ts'),
      '@coding-engine/server': path.resolve(__dirname, './coding-engine/packages/server/src/index.ts'),
    },
  },
});
