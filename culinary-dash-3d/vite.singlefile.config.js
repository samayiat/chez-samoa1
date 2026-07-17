import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Produces ONE fully self-contained index.html (Three.js + all modules + CSS
// inlined, zero external requests) for embedding as a claude.ai Artifact, which
// blocks every external host.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
