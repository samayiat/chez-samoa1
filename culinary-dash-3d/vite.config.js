import { defineConfig } from 'vite';

// The game deploys as static assets. `base` is relative so it works whether
// it's served at the domain root or from a /3d/ subdirectory on GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
