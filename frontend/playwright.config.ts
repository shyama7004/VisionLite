import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8123', ...devices['Pixel 5'], trace: 'off' },
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://localhost:8123/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'phone', testIgnore: /camera\.spec/ },
    {
      // Fake camera, so the distance guard can be mounted for real.
      name: 'camera',
      testMatch: /camera\.spec/,
      use: {
        permissions: ['camera', 'microphone'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
      },
    },
  ],
})
