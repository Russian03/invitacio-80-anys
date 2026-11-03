import { defineConfig, devices } from '@playwright/test'

const URL_BASE = 'http://localhost:4173'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  use: { baseURL: URL_BASE },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: URL_BASE,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'escritorio', use: devices['Desktop Chrome'] },
    { name: 'movil', use: devices['Pixel 7'] },
  ],
})
