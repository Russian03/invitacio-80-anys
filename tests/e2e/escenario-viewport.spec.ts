import type { Page } from '@playwright/test'
import { BOCA, FOTOGRAMA } from '../../src/carta/geometria'
import { expect, test } from './fixtures'

// Barra de scroll clásica (Playwright la oculta por defecto): con ella, `100vw` y el ancho útil difieren,
// y el recorte de la boca se desplazaba respecto al sobre pintado.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const VENTANAS = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 2560, height: 1080 },
]

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

for (const ventana of VENTANAS) {
  test(`el recorte de la boca coincide con la boca de la imagen pintada en ${ventana.width}x${ventana.height}`, async ({ page }) => {
    await page.setViewportSize(ventana)
    await hastaPapelSube(page)
    const m = await page.evaluate(() => {
      const r = document.querySelector('#sobre-abierto')!.getBoundingClientRect()
      const clip = getComputedStyle(document.querySelector('#boca')!).clipPath
      const pares = [...clip.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((p) => [Number(p[1]), Number(p[2])] as const)
      return { imagen: { left: r.left, top: r.top, width: r.width }, pares }
    })
    const escala = m.imagen.width / FOTOGRAMA.ancho
    // pares: [0,0], boca de derecha a izquierda, [0,y del primero]
    const recorte = m.pares.slice(1, -1).reverse()
    expect(recorte).toHaveLength(BOCA.length)
    BOCA.forEach((p, i) => {
      expect(Math.abs(recorte[i]![0] - (m.imagen.left + p.x * escala))).toBeLessThanOrEqual(0.6)
      expect(Math.abs(recorte[i]![1] - (m.imagen.top + p.y * escala))).toBeLessThanOrEqual(0.6)
    })
  })
}

// R-02g-6: sin franja de color en el lateral derecho, con y sin scroll vertical, en cualquier tamaño de ventana.
// El lateral (donde va o iría la barra) se compara con el fondo de escena a ventana completa y sin barra.
const VENTANAS_LATERAL = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 800, height: 600 },
  { width: 412, height: 915 },
]

const OCULTAR_ESCENA = `#escenario, #boca, #carta { display: none !important; }`
const REFERENCIA = `
  #escenario, #boca, #carta { display: none !important; }
  html, body { overflow: hidden !important; scrollbar-gutter: auto !important; }
  #mesa, .mesa { scrollbar-width: none !important; scrollbar-gutter: auto !important; }`

async function abrirSinMovimiento(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta')
}

/** Añade CSS por hoja construida (CSSOM: la CSP prohíbe `<style>` en línea); devuelve cómo quitarlo */
async function ponerCss(page: Page, css: string) {
  await page.evaluate((c) => {
    const hoja = new CSSStyleSheet()
    hoja.replaceSync(c)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, hoja]
  }, css)
  return () => page.evaluate(() => (document.adoptedStyleSheets = document.adoptedStyleSheets.slice(0, -1)))
}

/** Media por canal de la columna x entre el 40 % y el 95 % de la altura (la fila de la barra queda lejos del pulgar, arriba) */
async function columna(page: Page, x: number) {
  const png = (await page.screenshot()).toString('base64')
  return page.evaluate(
    async ([b64, cx]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const y0 = Math.floor(img.height * 0.4)
      const d = g.getImageData(cx, y0, 1, Math.floor(img.height * 0.55)).data
      const m = [0, 0, 0]
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k]! += d[i + k]!
      return m.map((v) => v / (d.length / 4))
    },
    [png, x] as const,
  )
}

for (const ventana of VENTANAS_LATERAL) {
  for (const conScroll of [false, true]) {
    test(`sin franja de color en el lateral derecho ${conScroll ? 'con' : 'sin'} scroll vertical en ${ventana.width}x${ventana.height}`, async ({ page }) => {
      await page.setViewportSize(ventana)
      await abrirSinMovimiento(page)
      const quitar = await ponerCss(
        page,
        conScroll ? `#escenario, #boca { display: none !important; } #carta { visibility: hidden; min-height: 600vh; }` : OCULTAR_ESCENA,
      )
      const x = ventana.width - 3
      const con = await columna(page, x)
      await quitar()
      await ponerCss(page, REFERENCIA)
      const ref = await columna(page, x)
      expect(Math.max(...con.map((v, i) => Math.abs(v - ref[i]!)))).toBeLessThan(8)
    })
  }

  test(`el ancho de #carta no cambia al aparecer el scroll vertical en ${ventana.width}x${ventana.height}`, async ({ page }) => {
    await page.setViewportSize(ventana)
    await abrirSinMovimiento(page)
    const medir = () => page.evaluate(() => document.querySelector('#carta')!.getBoundingClientRect().width)
    await ponerCss(page, `#carta > * { display: none !important; }`)
    const sinScroll = await medir()
    await ponerCss(page, `#carta { min-height: 600vh; }`)
    const hay = await page.evaluate(() => {
      const m = document.querySelector('#mesa')!
      return m.scrollHeight > m.clientHeight
    })
    expect(hay).toBe(true)
    expect(await medir()).toBe(sinScroll)
  })
}

test('el teclado (Espacio, AvPág, flechas) desplaza el contenedor de scroll tras abrir la carta', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el teclado es de escritorio')
  await page.setViewportSize({ width: 800, height: 400 })
  await abrirSinMovimiento(page)
  await expect(page.locator('#titol')).toBeFocused()
  const arriba = () => page.evaluate(() => document.querySelector('#mesa')!.scrollTop)
  expect(await arriba()).toBe(0)
  for (const tecla of ['Space', 'PageDown', 'ArrowDown']) {
    const antes = await arriba()
    await page.keyboard.press(tecla)
    await expect.poll(arriba).toBeGreaterThan(antes)
  }
})
