import { abrirCarta, expect, test } from './fixtures'
import { ANCHO_MINIMO_PAPEL_PX } from '../../src/carta/video'

// El vídeo de apertura no se reproduce en el Chromium de Playwright (D21)
test.use({ reducedMotion: 'reduce' })

test('muestra la mesa azul y la carta en catalán', async ({ page, isMobile }) => {
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca')
  await expect(page.locator('body')).toHaveCSS('background-color', /rgb\(22, 72, 120\)/)
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

test('la mesa no lleva degradado (el vídeo ya se comprueba contra la mesa en carta.spec)', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('body')).toHaveCSS('background-image', 'none')
})

test('la carta lleva la textura del papel y se desplaza con el scroll', async ({ page, request }) => {
  await page.goto('/')
  await abrirCarta(page)
  const carta = page.locator('#carta')
  await expect(carta).toHaveCSS('background-repeat', /repeat-y/)
  await expect(carta).toHaveCSS('background-attachment', 'scroll')
  const imagen = await carta.evaluate((c) => getComputedStyle(c).backgroundImage)
  expect(imagen).toContain('/img/')
  const url = /url\("?([^")]+)"?\)/.exec(imagen)![1]!
  expect((await request.get(url)).status()).toBe(200)
})

test('la carta empieza con un margen azul arriba y acaba con otro abajo', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  const arriba = await page.locator('#carta').evaluate((c) => c.getBoundingClientRect().top)
  expect(arriba).toBeGreaterThanOrEqual(40)
  const abajo = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    const caja = document.querySelector('#carta')!.getBoundingClientRect()
    return document.documentElement.scrollHeight - (caja.bottom + window.scrollY)
  })
  expect(abajo).toBeGreaterThanOrEqual(40)
})

test('en escritorio el papel ocupa el ancho del papel del vídeo', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el ancho del papel del vídeo es solo de escritorio')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await abrirCarta(page)
  const { ancho, esperado } = await page.locator('#carta').evaluate((c) => ({
    ancho: c.getBoundingClientRect().width,
    // 82,66 % del fotograma a alto completo (16:9): 0,8266 × 16/9 × alto, sin pasarse del ancho útil menos márgenes
    esperado: Math.min(document.querySelector('.mesa')!.getBoundingClientRect().width - 32, 0.8266 * ((innerHeight * 16) / 9)),
  }))
  expect(Math.abs(ancho - esperado)).toBeLessThanOrEqual(2)
  expect(Math.abs(ancho - 1587)).toBeLessThanOrEqual(2)
  const columna = await page.locator('.carta-cabecera').evaluate((c) => c.getBoundingClientRect().width)
  expect(columna).toBeLessThanOrEqual(680)
})

for (const tam of [
  { width: 1024, height: 768 },
  { width: 800, height: 360 },
]) {
  test(`no hay scroll horizontal a ${tam.width}x${tam.height}`, async ({ page }) => {
    await page.setViewportSize(tam)
    await page.goto('/')
    await abrirCarta(page)
    const sinScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(sinScroll).toBe(true)
  })
}

test('con una ventana más cuadrada que el papel del vídeo, la carta no se pasa de los márgenes', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/')
  await abrirCarta(page)
  const { ancho, util } = await page.locator('#carta').evaluate((c) => ({
    ancho: c.getBoundingClientRect().width,
    util: document.querySelector('.mesa')!.getBoundingClientRect().width,
  }))
  expect(Math.abs(ancho - (util - 32))).toBeLessThanOrEqual(1)
})

test.describe('ancho mínimo del papel (D23)', () => {
  test('el CSS y video.ts piden el mismo ancho mínimo', async ({ page }) => {
    await page.goto('/')
    const css = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ancho-minimo-papel').trim(),
    )
    expect(css).toBe(`${ANCHO_MINIMO_PAPEL_PX}px`)
  })

  // Nunca baja de min(600, ancho útil − 32); el ancho útil depende del hueco del scroll, por eso se mide
  for (const tam of [
    { width: 1920, height: 360, tope: true },
    { width: 1100, height: 300, tope: true },
    { width: 600, height: 360, tope: false },
    { width: 500, height: 360, tope: false },
  ]) {
    test(`a ${tam.width}x${tam.height} el papel mide min(${ANCHO_MINIMO_PAPEL_PX}, ancho − 32) y no hay scroll horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize(tam)
      await page.goto('/')
      await abrirCarta(page)
      const medidas = await page.evaluate(() => ({
        ancho: document.querySelector('#carta')!.getBoundingClientRect().width,
        util: document.querySelector('.mesa')!.getBoundingClientRect().width,
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      }))
      const esperado = Math.min(ANCHO_MINIMO_PAPEL_PX, medidas.util - 32)
      expect(Math.abs(medidas.ancho - esperado)).toBeLessThanOrEqual(1)
      if (tam.tope) expect(esperado).toBe(ANCHO_MINIMO_PAPEL_PX)
      expect(medidas.sinScroll).toBe(true)
    })
  }
})
