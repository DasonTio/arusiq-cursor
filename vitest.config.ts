import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'eslint-rules/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // lib/domain is where a quiet bug becomes a false claim on a
      // stakeholder's screen, so it is held to a higher bar than the UI.
      include: ['src/lib/domain/**', 'eslint-rules/**'],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
