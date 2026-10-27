// vitest.config.ts — Configuration Vitest pour RAQIB
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclure les fichiers compilés (CommonJS) — Vitest nécessite ESM natif
    exclude: [
      'dist/**',
      'node_modules/**',
    ],
    // Inclure uniquement les fichiers .spec.ts
    include: [
      'tests/**/*.spec.ts',
    ],
    // Timeout global pour les tests (surtout sandbox Docker)
    testTimeout: 30000,
  },
});
