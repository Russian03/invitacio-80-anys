import { expect, test as base, type Page } from '@playwright/test'
import { URL_PRUEBA } from '../destino-prueba'

const ORIGEN = 'http://localhost:4173'

// Cada test falla si hay peticiones externas, errores de consola o violaciones de CSP.
// Un test que espera un fallo concreto puede vaciar `problemas` tras comprobarlo.
export const test = base.extend<{ problemas: string[] }>({
  problemas: [
    async ({ page }, use) => {
      const problemas: string[] = []
      // Ninguna prueba sale a internet: cualquier otra dirección de Apps Script se corta (la ruta registrada después manda)
      await page.route('https://script.google.com/**', (ruta) => ruta.abort())
      // El destino de las respuestas contesta aquí, con la espera de uno real
      await page.route(URL_PRUEBA, async (ruta) => {
        await new Promise((listo) => setTimeout(listo, 500))
        await ruta.fulfill({ body: '{"ok":true}', headers: { 'Access-Control-Allow-Origin': '*' } })
      })
      page.on('request', (peticion) => {
        const url = peticion.url()
        if (!url.startsWith(ORIGEN) && !url.startsWith('data:') && url !== URL_PRUEBA) problemas.push(`petición externa: ${url}`)
      })
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') problemas.push(`consola: ${mensaje.text()}`)
      })
      page.on('pageerror', (error) => problemas.push(`pageerror: ${error.message}`))
      await use(problemas)
      expect(problemas).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Espera a que la carta esté abierta. */
export async function abrirCarta(page: Page): Promise<void> {
  await page.locator('body[data-estado="abierta"]').waitFor({ timeout: 5000 })
}
