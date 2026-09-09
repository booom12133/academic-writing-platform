import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.P3_BASE_URL || 'https://write.yingrenji.cn';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'user-a',
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.P3_STORAGE_STATE_USER_A || undefined,
      },
    },
    {
      name: 'user-b',
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.P3_STORAGE_STATE_USER_B || undefined,
      },
    },
  ],
});
