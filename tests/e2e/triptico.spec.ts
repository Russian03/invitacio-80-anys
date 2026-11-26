import type { Page } from '@playwright/test'
import { abrirCarta, expect, test } from './fixtures'

const MOVILES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]
const SIN_TRIPTICO = [
  { width: 1280, height: 800 },
  { width: 800, height: 360 }, // móvil apaisado
  { width: 768, height: 1024 }, // tableta
]

/** Retiene el vídeo y simula que el sobre ya está quieto: empieza la animación del papel. */
async function hastaPapelSube(page: Page) {
  await page.route('**/video/*.mp4', () => {})
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
  await page.locator('#video-apertura').dispatchEvent('playing')
  await page.locator('#video-apertura').evaluate((v) => {
    let actual = 0
    Object.defineProperty(v, 'duration', { configurable: true, get: () => 3.04 })
    Object.defineProperty(v, 'currentTime', { configurable: true, get: () => actual, set: (x) => (actual = x) })
    ;(v as unknown as { currentTime: number }).currentTime = 1.4
    v.dispatchEvent(new Event('timeupdate'))
  })
  await expect(page.locator('body')).toHaveAttribute('data-fase', 'papel-sube')
}

/**
 * Para las animaciones y las recorre en una sola evaluación (así no vence el tope de la animación):
 * ángulos y visibilidad en varios momentos, y las cajas con el tríptico abierto y al final del zoom.
 */
function recorrer(page: Page) {
  return page.evaluate(() => {
    const el = (s: string) => document.querySelector<HTMLElement>(s)!
    const animaciones = document.getAnimations()
    const de = (e: Element) => animaciones.filter((a) => (a.effect as KeyframeEffect).target === e)
    const arriba = el('#triptico .panel-arriba')
    const abajo = el('#triptico .panel-abajo')
    // Offsets en que empieza y acaba de girar cada panel
    const tramo = (panel: Element) => {
      const marcos = (de(panel)[0]!.effect as KeyframeEffect).getKeyframes()
      return [marcos[1]!.computedOffset, marcos[2]!.computedOffset] as const
    }
    const total = Number(de(arriba)[0]!.effect!.getTiming().duration)
    const [a0, a1] = tramo(arriba)
    const [b0, b1] = tramo(abajo)
    const zoom = (de(el('#papel-apertura'))[0]!.effect as KeyframeEffect).getKeyframes()[1]!.computedOffset

    const ir = (offset: number) =>
      animaciones.forEach((a) => {
        a.pause()
        a.currentTime = offset * total
      })
    /** `true` si el panel sigue plegado del todo (giro de 180°: m22 = -1). */
    const plegado = (e: Element) => Math.abs(new DOMMatrix(getComputedStyle(e).transform).m22 + 1) < 0.001
    const abierto = (e: Element) => Math.abs(new DOMMatrix(getComputedStyle(e).transform).m22 - 1) < 0.001
    const caja = (e: Element) => {
      const r = e.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    const opacidad = (e: Element) => Number(getComputedStyle(e).opacity)

    ir(a0)
    const antes = { arriba: plegado(arriba), abajo: plegado(abajo) }
    ir((a0 + b0) / 2)
    const primero = { arribaPlegado: plegado(arriba), abajo: plegado(abajo) }
    ir(Math.max(a1, b1) + 0.001)
    const paneles = [...document.querySelectorAll('#triptico .panel')].map(caja)
    const desplegado = {
      arriba: abierto(arriba),
      abajo: abierto(abajo),
      paneles,
      triptico: opacidad(el('#triptico')),
      escenario: opacidad(el('#escenario')),
    }
    ir(zoom + (1 - zoom) / 2)
    const enZoom = { triptico: opacidad(el('#triptico')), papel: opacidad(el('#papel-apertura')), caja: caja(el('#papel-apertura')) }
    ir(0.99999)
    const final = { papel: caja(el('#papel-apertura')), carta: caja(el('#carta')) }
    return { antes, primero, desplegado, enZoom, final, ancho: innerWidth, alto: innerHeight }
  })
}

for (const ventana of MOVILES) {
  test(`en ${ventana.width}x${ventana.height} la carta se despliega en tríptico dentro de la ventana y hace zoom`, async ({ page }) => {
    await page.setViewportSize(ventana)
    await hastaPapelSube(page)
    const m = await recorrer(page)

    expect(m.antes).toEqual({ arriba: true, abajo: true })
    // La solapa de arriba se abre antes que la de abajo
    expect(m.primero).toEqual({ arribaPlegado: false, abajo: true })

    expect(m.desplegado.arriba).toBe(true)
    expect(m.desplegado.abajo).toBe(true)
    expect(m.desplegado.triptico).toBe(1)
    expect(m.desplegado.escenario).toBe(0)
    expect(m.desplegado.paneles).toHaveLength(3)
    for (const panel of m.desplegado.paneles) {
      expect(panel.left).toBeGreaterThanOrEqual(0)
      expect(panel.top).toBeGreaterThanOrEqual(0)
      expect(panel.right).toBeLessThanOrEqual(m.ancho)
      expect(panel.bottom).toBeLessThanOrEqual(m.alto)
    }

    // El zoom lo hace la hoja única, más ancha que el tríptico
    expect(m.enZoom.triptico).toBe(0)
    expect(m.enZoom.papel).toBe(1)
    const anchoAbierto = m.desplegado.paneles[0]!.right - m.desplegado.paneles[0]!.left
    expect(m.enZoom.caja.right - m.enZoom.caja.left).toBeGreaterThan(anchoAbierto)

    for (const lado of ['left', 'top', 'right', 'bottom'] as const) {
      expect(Math.abs(m.final.papel[lado] - m.final.carta[lado])).toBeLessThanOrEqual(1)
    }
  })
}

test('al acabar queda la carta de siempre, que se puede recorrer con scroll', async ({ page }) => {
  await page.setViewportSize(MOVILES[1]!)
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('#triptico')).toBeHidden()
  await expect(page.locator('#boca')).toBeHidden()
  const mesa = page.locator('#mesa')
  expect(await mesa.evaluate((m) => m.scrollHeight > m.clientHeight * 2)).toBe(true)
  await page.locator('#form-confirmacio button[type="submit"]').scrollIntoViewIfNeeded()
  await expect(page.locator('#form-confirmacio button[type="submit"]')).toBeInViewport()
})

for (const ventana of SIN_TRIPTICO) {
  test(`en ${ventana.width}x${ventana.height} no hay tríptico: el papel sale como siempre`, async ({ page }) => {
    await page.setViewportSize(ventana)
    await hastaPapelSube(page)
    await expect(page.locator('#papel-apertura')).toBeVisible()
    await expect(page.locator('#triptico')).toBeHidden()
  })
}

test('con movimiento reducido no hay tríptico', async ({ page }) => {
  await page.setViewportSize(MOVILES[1]!)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('#triptico')).toBeHidden()
})
