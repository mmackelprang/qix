import { defineConfig } from 'vite';

// Relative base so the build works both at the GitHub Pages project path
// (/qix/) and at any local preview root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
