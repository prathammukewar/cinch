import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8692', trace: 'off' },
  webServer: { command: 'node tools/serve.mjs 8692', url: 'http://127.0.0.1:8692/', reuseExistingServer: true },
  projects: [
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, browserName: 'chromium' } },
  ],
});
