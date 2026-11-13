import * as path from 'path';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT || 4173);

export default defineConfig({
  testDir: '.',
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node examples/wallet/server.mjs',
    cwd: path.resolve(__dirname, '..'),
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
