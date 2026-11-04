import { abrirCarta, expect, test } from './fixtures'

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('sin JavaScript la carta se ve abierta (S-11)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#titol')).toBeVisible()
    await expect(page.locator('#carta')).not.toHaveAttribute('inert', /.*/)
  })
})

test('no hay botón para saltar ni sobre: la carta se abre sola y el foco va al título', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Saltar/ })).toHaveCount(0)
  await expect(page.locator('#sobre')).toHaveCount(0)
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 3500 })
  await expect(page.locator('#titol')).toBeFocused()
})

test('mientras se abre, el contenido no se puede usar', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-estado', /^(cerrada|abriendo)$/)
  await expect(page.locator('#carta')).toHaveAttribute('inert', '')
})

test('al recargar vuelve a abrirse y empieza arriba', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  await page.evaluate(() => window.scrollTo(0, 2000))
  await page.reload()
  await expect(page.locator('body')).not.toHaveAttribute('data-estado', 'abierta')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 5000 })
  const almacenados = await page.evaluate(() => localStorage.length + sessionStorage.length)
  expect(almacenados).toBe(0)
})

const PROPIEDADES_NO_ANIMADAS = ['offset', 'computedOffset', 'easing', 'composite']

/** Comprueba que la apertura es solo un fundido de 300 ms como mucho (sin escala ni giros). */
async function comprobarAperturaEsFundido(page: import('@playwright/test').Page) {
  // Captura las animaciones en el instante en que entra en `abriendo`, sin depender de un sondeo
  await page.addInitScript((ignoradas) => {
    const w = window as unknown as { __abriendo?: unknown[] }
    new MutationObserver(() => {
      if (w.__abriendo || document.body?.getAttribute('data-estado') !== 'abriendo') return
      w.__abriendo = document.getAnimations().map((animacion) => {
        const efecto = animacion.effect as KeyframeEffect
        return {
          duracionMs: Number(efecto.getComputedTiming().duration),
          propiedades: [
            ...new Set(efecto.getKeyframes().flatMap((f) => Object.keys(f)).filter((k) => !ignoradas.includes(k))),
          ],
        }
      })
    }).observe(document, { attributes: true, attributeFilter: ['data-estado'], subtree: true })
  }, PROPIEDADES_NO_ANIMADAS)
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 1500 })
  const animaciones = await page.evaluate(
    () => (window as unknown as { __abriendo?: { duracionMs: number; propiedades: string[] }[] }).__abriendo,
  )
  expect(animaciones?.length ?? 0).toBeGreaterThan(0)
  for (const animacion of animaciones ?? []) {
    expect(animacion.duracionMs).toBeLessThanOrEqual(300)
    expect(animacion.propiedades).toEqual(['opacity'])
  }
  await expect(page.locator('#titol')).toBeFocused()
}

test('la apertura es un fundido de 300 ms sin escala', async ({ page }) => {
  await comprobarAperturaEsFundido(page)
})

test.describe('con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' })

  test('la apertura es un fundido sin solapa ni escala', async ({ page }) => {
    await comprobarAperturaEsFundido(page)
  })
})

test('si el JavaScript no carga, la carta aparece igualmente (S-11)', async ({ page, problemas }) => {
  await page.route('**/assets/*.js', (ruta) => ruta.abort())
  await page.goto('/')
  await expect(page.locator('#titol')).toBeVisible({ timeout: 3500 })
  // Solo es esperable el error del recurso abortado
  const inesperados = problemas.filter((p) => !p.includes('ERR_FAILED'))
  expect(inesperados).toEqual([])
  problemas.length = 0
})

test('al cargar no se ve la carta antes de abrirse', async ({ page }) => {
  await page.goto('/')
  const opacidad = await page.evaluate(() => {
    const estado = document.body.dataset.estado
    return { estado, opacidad: getComputedStyle(document.querySelector('#carta') as Element).opacity }
  })
  if (opacidad.estado === 'cerrada') expect(opacidad.opacidad).toBe('0')
  expect(opacidad.estado).toMatch(/^(cerrada|abriendo)$/)
})

test('con el JavaScript aún sin cargar la carta está oculta y aparece sola a los 2 s (D4)', async ({ page }) => {
  await page.route('**/assets/*.js', async (ruta) => {
    await new Promise((resolver) => setTimeout(resolver, 3500))
    await ruta.continue()
  })
  await page.goto('/', { waitUntil: 'commit' })
  await page.locator('#carta').waitFor({ state: 'attached' })
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#carta') as Element).opacity)).toBe('0')
  await expect(page.locator('#titol')).toBeVisible()
  await expect(page.locator('#carta')).toHaveCSS('opacity', '1', { timeout: 3000 })
})
