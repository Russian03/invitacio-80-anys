import type { Page } from '@playwright/test'
import { abrirCarta, expect, test } from './fixtures'

// La carta se abre sin su animación (rápido y estable); el movimiento se activa después en los tests que lo miran
test.use({ reducedMotion: 'reduce' })

async function abrir(page: Page, movimiento: boolean) {
  await page.goto('/')
  await abrirCarta(page)
  if (movimiento) await page.emulateMedia({ reducedMotion: 'no-preference' })
}

/** Transformaciones de las animaciones vivas de un elemento. */
const transformaciones = (page: Page, selector: string) =>
  page.evaluate(
    (s) =>
      document
        .getAnimations()
        .filter((a) => (a.effect as KeyframeEffect).target === document.querySelector(s) && !('transitionProperty' in a))
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().map((k) => String(k.transform))),
    selector,
  )

/** Registra qué elementos reciben una animación de `translateX`, aunque ya haya terminado cuando se mire. */
async function registrarTemblores(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __temblores: string[] }
    w.__temblores = []
    const original = Element.prototype.animate
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (JSON.stringify(args[0]).includes('translateX')) w.__temblores.push(this.id || this.className)
      return original.apply(this, args)
    }
  })
}
const temblores = (page: Page) => page.evaluate(() => (window as unknown as { __temblores: string[] }).__temblores)

const enviar = (page: Page) => page.getByRole('button', { name: 'Confirmar assistència' })

test.describe('al tocar no se pinta nada de azul', () => {
  for (const selector of ['.opcion', '.opcion input', '.pastilla', '.boton-primario', '#carrusel .pila']) {
    test(`${selector} no tiene el resaltado de toque`, async ({ page }) => {
      await abrir(page, false)
      const color = await page.locator(selector).first().evaluate((e) => getComputedStyle(e).getPropertyValue('-webkit-tap-highlight-color'))
      expect(color).toBe('rgba(0, 0, 0, 0)')
    })
  }

  test('las respuestas y los botones no se seleccionan como texto', async ({ page }) => {
    await abrir(page, false)
    for (const selector of ['.opcion', '.pastilla', '.boton-primario', '.campo legend']) {
      await expect(page.locator(selector).first()).toHaveCSS('user-select', 'none')
    }
    await page.locator('.opcion').nth(1).dblclick()
    expect(await page.evaluate(() => String(getSelection()))).toBe('')
  })
})

test.describe('animación al pulsar', () => {
  /** Los enlaces no navegan: aquí solo importa la animación. */
  const sinNavegar = (page: Page) =>
    page.evaluate(() => document.addEventListener('click', (e) => (e.target as Element).closest('a') && e.preventDefault(), true))

  for (const selector of ['.boton-primario', '.pastilla']) {
    test(`${selector} rebota al pulsarlo`, async ({ page }) => {
      await abrir(page, true)
      await sinNavegar(page)
      await page.locator(selector).click()
      expect((await transformaciones(page, selector)).join(' ')).toContain('scale(')
    })
  }

  test('la respuesta elegida rebota', async ({ page }) => {
    await abrir(page, true)
    await page.locator('.opcion').nth(1).click()
    expect((await transformaciones(page, '.opciones .opcion:nth-child(2)')).join(' ')).toContain('scale(')
  })

  test('con movimiento reducido no rebota', async ({ page }) => {
    await abrir(page, false)
    await page.locator('.opcion').nth(1).click()
    await enviar(page).click()
    // Los cambios de color (transiciones de CSS) sí se mantienen
    expect(await page.evaluate(() => document.getAnimations().filter((x) => !('transitionProperty' in x)).length)).toBe(0)
  })
})

test.describe('aviso de lo que falta', () => {
  // Ventana baja: al estar abajo, junto al botón, la casilla del nombre queda fuera de la vista
  test.use({ viewport: { width: 390, height: 420 } })

  async function enviarDesdeAbajo(page: Page) {
    await page.locator('#mesa').evaluate((m) => m.scrollTo(0, m.scrollHeight))
    await expect(page.locator('#nom')).not.toBeInViewport()
    await enviar(page).click()
  }

  test('sin nombre, vuelve a su casilla, le pone el foco y tiembla', async ({ page }) => {
    await abrir(page, true)
    await registrarTemblores(page)
    await page.locator('.opcion').first().click()
    await enviarDesdeAbajo(page)
    await expect(page.locator('#nom')).toBeFocused()
    await expect(page.locator('#nom')).toBeInViewport({ ratio: 1 })
    await expect.poll(() => temblores(page)).toEqual(['nom'])
    await expect(page.getByText('Escriu el teu nom')).toBeVisible()
  })

  test('sin respuesta, vuelve a «Hi seràs?» y tiemblan las dos opciones', async ({ page }) => {
    await abrir(page, true)
    await registrarTemblores(page)
    await page.locator('#nom').fill('Maria')
    await page.locator('#mesa').evaluate((m) => m.scrollTo(0, m.scrollHeight))
    await enviar(page).click()
    await expect(page.locator('input[name="assistira"]').first()).toBeFocused()
    await expect(page.locator('.opciones')).toBeInViewport({ ratio: 1 })
    await expect.poll(() => temblores(page)).toEqual(['opciones'])
  })

  test('si faltan las dos cosas, tiemblan las dos y va a la primera', async ({ page }) => {
    await abrir(page, true)
    await registrarTemblores(page)
    await enviarDesdeAbajo(page)
    await expect(page.locator('#nom')).toBeFocused()
    await expect.poll(() => temblores(page)).toEqual(['nom', 'opciones'])
  })

  test('con movimiento reducido vuelve a la casilla sin temblar', async ({ page }) => {
    await abrir(page, false)
    await registrarTemblores(page)
    await enviarDesdeAbajo(page)
    await expect(page.locator('#nom')).toBeFocused()
    await expect(page.locator('#nom')).toBeInViewport({ ratio: 1 })
    await page.waitForTimeout(300)
    expect(await temblores(page)).toEqual([])
  })

  test('con todo relleno no tiembla nada', async ({ page }) => {
    await abrir(page, true)
    await registrarTemblores(page)
    await page.locator('#nom').fill('Maria')
    await page.locator('.opcion').first().click()
    await enviar(page).click()
    await expect(page.locator('#exito')).toBeVisible()
    expect(await temblores(page)).toEqual([])
  })
})
