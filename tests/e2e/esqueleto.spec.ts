import { abrirCarta, expect, test } from './fixtures'

test('muestra la mesa azul y la carta en catalán', async ({ page, isMobile }) => {
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca')
  await expect(page.locator('body')).toHaveCSS('background-color', /rgb\(30, 58, 122\)/)
  await expect(page.getByText('VINE A CELEBRAR')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'DATA' })).toBeVisible()
  if (isMobile) {
    await expect(page.locator('#bloque-data ~ p')).toHaveCSS('font-size', '20px')
  }
})

test('no hay scroll horizontal a 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await abrirCarta(page)
  const sinScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(sinScroll).toBe(true)
})

test('confirma con Gràcies y el nombre sin cambiar la URL', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  await page.getByLabel('Nom i cognoms (obligatori)').fill('Maria')
  await page.getByLabel('Sí, hi seré').check()
  const boton = page.getByRole('button', { name: 'Confirmar assistència' })
  await boton.click()
  const enviando = page.getByRole('button', { name: 'Enviant…' })
  await expect(enviando).toBeVisible()
  await expect(enviando).toBeDisabled()
  await expect(page.getByText("Gràcies, Maria! Hem rebut la teva resposta. T'esperem.")).toBeVisible()
  await expect(page.locator('#form-confirmacio')).toBeHidden()
  expect(page.url()).not.toContain('?')
})

test('muestra errores en catalán si se envía vacío', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  await page.getByRole('button', { name: 'Confirmar assistència' }).click()
  await expect(page.getByText('Escriu el teu nom')).toBeVisible()
  await expect(page.getByText('Indica si vindràs')).toBeVisible()
  await expect(page.getByText('Gràcies')).toHaveCount(0)
  await expect(page.locator('#nom')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('input[name="assistira"]').first()).toHaveAttribute('aria-invalid', 'true')
})

test('el nombre se muestra como texto (S-01)', async ({ page }) => {
  const nombre = '<img src=x onerror=window.__xss=1>'
  await page.goto('/')
  await abrirCarta(page)
  await page.getByLabel('Nom i cognoms (obligatori)').fill(nombre)
  await page.getByLabel('No hi podré anar').check()
  await page.getByRole('button', { name: 'Confirmar assistència' }).click()
  await expect(page.locator('#exito-texto')).toContainText(nombre)
  await expect(page.locator('#exito img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('la build lleva CSP y robots', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
  await expect(page.locator('meta[name="robots"][content="noindex, nofollow"]')).toHaveCount(1)
})
