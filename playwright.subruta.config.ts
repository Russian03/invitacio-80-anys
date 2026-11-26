import { defineConfig, devices } from '@playwright/test'
import { URL_PRUEBA } from './tests/destino-prueba'

/** GitHub Pages sirve la web en una subcarpeta (`/<repo>/`): aquí se prueba la build con una de ejemplo. */
const SUBRUTA = '/prueba/'
const URL_BASE = `http://localhost:4174${SUBRUTA}`
const OPCIONES = `--base=${SUBRUTA} --outDir dist-subruta`

export default defineConfig({
  testDir: 'tests/despliegue',
  use: { baseURL: URL_BASE },
  webServer: {
    command: `npx vite build ${OPCIONES} && npx vite preview ${OPCIONES} --port 4174 --strictPort`,
    url: URL_BASE,
    reuseExistingServer: false,
    // La build de prueba no apunta nunca a la hoja de verdad
    env: { VITE_URL_RESPUESTAS: URL_PRUEBA },
  },
  projects: [{ name: 'movil', use: devices['Pixel 7'] }],
})
