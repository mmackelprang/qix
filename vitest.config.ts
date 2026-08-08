import { defineConfig } from 'vitest/config';

// Sim tests are DOM-free by design (see docs/TECHNICAL_DESIGN.md §11):
// plain Node environment, no jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
