import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT || '4174')
const baseURL = `http://127.0.0.1:${port}`
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'msedge'
const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  testMatch: '*.spec.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          VITE_MOCK_AUTH: 'true',
          VITE_REQUIRE_AUTH: 'true',
          VITE_DEV_HOST: '127.0.0.1',
          VITE_PORT: String(port),
        },
      },
  projects: [
    {
      name: browserChannel ? `chromium-${browserChannel}` : 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
})
