import { defineConfig } from 'vitest/config';

// Sim unit tests live in test/. The Playwright specs in e2e/ must NOT be
// collected here — they import @playwright/test and run under a different runner.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
  },
});
