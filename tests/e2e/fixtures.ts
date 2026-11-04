import { expect, test as base, type Page } from '@playwright/test'

const ORIGEN = 'http://localhost:4173'

// Cada test falla si hay peticiones externas, errores de consola o violaciones de CSP.
// Un test que espera un fallo concreto puede vaciar `problemas` tras comprobarlo.
export const test = base.extend<{ problemas: string[] }>({
  problemas: [
    async ({ page }, use) => {
      const problemas: string[] = []
      page.on('request', (peticion) => {
        const url = peticion.url()
        if (!url.startsWith(ORIGEN) && !url.startsWith('data:')) problemas.push(`petición externa: ${url}`)
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
