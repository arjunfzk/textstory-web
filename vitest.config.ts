/**
 * Vitest configuration for TextStory Web.
 *
 * Uses happy-dom (10x faster than jsdom) for component tests.
 * Path aliases match tsconfig.json.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
