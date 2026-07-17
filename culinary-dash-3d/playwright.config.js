import { defineConfig } from '@playwright/test';

// Drives the real built game in headless Chromium (WebGL via SwiftShader) so we
// verify what actually renders — the 3D replacement for the 2D game's
// op-recording rasterizer checks. Uses the preinstalled browser; never
// downloads one.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  webServer: {
    command: 'npm run build && npm run preview -- --port 4188 --strictPort',
    url: 'http://localhost:4188',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  use: {
    baseURL: 'http://localhost:4188',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
      args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
});
