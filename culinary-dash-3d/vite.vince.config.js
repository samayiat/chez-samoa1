import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the Vince art-direction preview into ONE self-contained HTML (Three.js +
// all modules + CSS inlined, zero external requests) so it opens offline on a phone.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist-vince',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { input: 'vince.html' },
  },
});
