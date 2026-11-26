import type { Page } from '@playwright/test'
import { URL_PRUEBA } from '../destino-prueba'
import { abrirCarta, expect, test } from './fixtures'

test.use({ reducedMotion: 'reduce' })

async function rellenarYEnviar(page: Page) {
  await page.goto('/')
  await abrirCarta(page)
  await page.getByLabel('Nom i cognoms').fill('Maria Puig')
  await page.getByLabel('No hi podré anar').check()
  await page.getByLabel('Al·lèrgens o intoleràncies (opcional)').fill('gluten')
  await page.getByRole('button', { name: 'Confirmar assistència' }).click()
}

test('la respuesta se manda al destino configurado y entonces se da las gracias', async ({ page }) => {
  const peticion = page.waitForRequest(URL_PRUEBA)
  await rellenarYEnviar(page)
  const enviada = await peticion
  expect(enviada.method()).toBe('POST')
  expect(enviada.headers()['content-type']).toContain('text/plain')
  expect(enviada.postDataJSON()).toEqual({ nom: 'Maria Puig', assistira: false, alergens: 'gluten' })
  await expect(page.getByText('Gràcies per avisar, Maria Puig. Et trobarem a faltar.')).toBeVisible()
})

for (const [caso, status, cuerpo] of [
  ['el servidor falla', 500, 'error'],
  ['el servidor la rechaza', 200, '{"ok":false}'],
] as const) {
  test(`si ${caso}, avisa y deja el formulario relleno para reintentar`, async ({ page, problemas }) => {
    await page.route(URL_PRUEBA, (ruta) => ruta.fulfill({ status, body: cuerpo, headers: { 'Access-Control-Allow-Origin': '*' } }))
    await rellenarYEnviar(page)
    await expect(page.getByText("No s'ha pogut enviar. Torna-ho a provar.")).toBeVisible()
    await expect(page.getByLabel('Nom i cognoms')).toHaveValue('Maria Puig')
    await expect(page.getByRole('button', { name: 'Confirmar assistència' })).toBeEnabled()
    await expect(page.locator('#exito')).toBeHidden()
    problemas.length = 0
  })
}

test('la política de seguridad solo deja enviar a Google', async ({ page }) => {
  await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("connect-src 'self' https://script.google.com https://script.googleusercontent.com;")
})
