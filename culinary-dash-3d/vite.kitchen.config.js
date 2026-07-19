import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the 2.5D kitchen look-proof into ONE self-contained HTML.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist-kitchen',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { input: 'kitchen.html' },
  },
});
