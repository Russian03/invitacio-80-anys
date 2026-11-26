import { defineConfig, devices } from '@playwright/test'

const URL_BASE = 'http://localhost:4173'

/** Solo se usa `CI`; así no hace falta añadir `@types/node`. */
declare const process: { env: { CI?: string } }

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // En CI las animaciones pueden ir justas de tiempo: un reintento y el informe como artefacto
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
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
