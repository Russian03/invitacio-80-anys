import { abrirCarta, expect, test } from './fixtures'

// Ancho final del papel en ordenador (D32); `--ancho-papel` de base.css
const ANCHO_PAPEL_PX = 760


// El vídeo de apertura no se reproduce en el Chromium de Playwright (D21)
test.use({ reducedMotion: 'reduce' })

test('muestra la mesa marrón #462827 y la carta en catalán', async ({ page, isMobile }) => {
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(70, 40, 39)')
  await expect(page.getByText('VINE A CELEBRAR')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'DATA' })).toBeVisible()
  if (isMobile) {
    await expect(page.locator('#bloque-com-arribar ~ p')).toHaveCSS('font-size', '20px')
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

test('el fondo de escena es el marrón #462827 plano: esquinas, centro y bordes iguales (±2), sin viñeta (herramientas/recolorear-fondo.py)', async ({ page }) => {
  await page.goto('/')
  const muestras = await page.evaluate(async () => {
    const i = new Image()
    i.src = '/img/fondo-escena.webp'
    await i.decode()
    const c = document.createElement('canvas')
    c.width = i.width
    c.height = i.height
    const g = c.getContext('2d')!
    g.drawImage(i, 0, 0)
    const w = i.width
    const h = i.height
    const parche = (cx: number, cy: number) => {
      const d = g.getImageData(cx - 2, cy - 2, 5, 5).data
      const s = [0, 0, 0]
      for (let k = 0; k < d.length; k += 4) for (let j = 0; j < 3; j++) s[j]! += d[k + j]!
      return s.map((v) => v / (d.length / 4))
    }
    return [
      parche(3, 3), parche(w - 4, 3), parche(3, h - 4), parche(w - 4, h - 4),
      parche(w >> 1, 3), parche(w >> 1, h >> 1), parche(3, h >> 1), parche(w >> 2, h >> 2),
    ]
  })
  const esperado = [0x46, 0x28, 0x27]
  muestras.forEach((m) => m.forEach((v, j) => expect(Math.abs(v - esperado[j]!)).toBeLessThanOrEqual(2)))
})

test('la mesa no lleva degradado (el vídeo ya se comprueba contra la mesa en carta.spec)', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  await expect(page.locator('body')).toHaveCSS('background-image', 'none')
})

test('la carta lleva la textura del papel (en su ::after) y se desplaza con el scroll', async ({ page, request }) => {
  await page.goto('/')
  await abrirCarta(page)
  const hoja = await page.locator('#carta').evaluate((c) => {
    const e = getComputedStyle(c, '::after')
    return { repeat: e.backgroundRepeat, attachment: e.backgroundAttachment, imagen: e.backgroundImage }
  })
  expect(hoja.repeat).toMatch(/repeat-y/)
  expect(hoja.attachment).toBe('scroll')
  expect(hoja.imagen).toContain('/img/')
  const url = /url\("?([^")]+)"?\)/.exec(hoja.imagen)![1]!
  expect((await request.get(url)).status()).toBe(200)
})

test('los laterales de la carta son irregulares (papel de trapo): relieve de 1 a 3 px, uniforme de arriba abajo, con la sombra bajo la hoja (D37)', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await abrirCarta(page)
  const estilo = await page.locator('#carta').evaluate((c) => {
    const e = getComputedStyle(c, '::after')
    return { mascara: e.maskImage || e.getPropertyValue('-webkit-mask-image'), sombra: getComputedStyle(c, '::before').boxShadow, cuerpo: getComputedStyle(c).boxShadow }
  })
  expect(estilo.mascara).toContain('borde-papel-izq')
  expect(estilo.mascara).toContain('borde-papel-der')
  expect(estilo.sombra.match(/rgba?\(/g)!.length).toBeGreaterThanOrEqual(4)
  expect(estilo.cuerpo).toBe('none')
  for (const lado of ['izq', 'der']) expect((await request.get(`/img/borde-papel-${lado}.png`)).status()).toBe(200)
  // Se mide en pantalla: cuánto papel hay en cada fila junto al borde (columnas de luminosidad alta)
  const caja = await page.locator('#carta').evaluate((c) => {
    const r = c.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, dpr: devicePixelRatio }
  })
  const lector = await page.context().newPage()
  for (const lado of ['izq', 'der'] as const) {
    const x = lado === 'izq' ? caja.left - 4 : caja.right - 4
    const imagen = await page.screenshot({ clip: { x, y: caja.top + 200, width: 8, height: 400 }, type: 'png' })
    // La lectura de píxeles va en una página en blanco aparte: la CSP de la web (connect-src 'self') no deja leer data:
    const cobertura = await lector.evaluate(async ([datos]) => {
      const bitmap = await createImageBitmap(await (await fetch(datos!)).blob())
      const lienzo = new OffscreenCanvas(bitmap.width, bitmap.height)
      const g = lienzo.getContext('2d')!
      g.drawImage(bitmap, 0, 0)
      const { data, width, height } = g.getImageData(0, 0, bitmap.width, bitmap.height)
      const filas: number[] = []
      for (let fila = 0; fila < height; fila++) {
        let suma = 0
        for (let col = 0; col < width; col++) {
          const i = (fila * width + col) * 4
          // Umbral a medio camino entre el papel (~200) y la mesa marrón (~50-80); con 150 un píxel mezclado cruzaba el umbral según el fondo
          suma += (data[i]! + data[i + 1]! + data[i + 2]!) / 3 > 125 ? 1 : 0
        }
        filas.push(suma)
      }
      return filas
    }, ['data:image/png;base64,' + imagen.toString('base64')])
    const visibles = cobertura.map((c) => c / caja.dpr)
    const rango = Math.max(...visibles) - Math.min(...visibles)
    expect(rango).toBeGreaterThanOrEqual(1)
    expect(rango).toBeLessThanOrEqual(3.2)
    // Uniforme: la primera y la segunda mitad tienen una irregularidad parecida
    const mitad = visibles.length / 2
    const rangoDe = (v: number[]) => Math.max(...v) - Math.min(...v)
    expect(rangoDe(visibles.slice(0, mitad))).toBeGreaterThanOrEqual(1)
    expect(rangoDe(visibles.slice(mitad))).toBeGreaterThanOrEqual(1)
  }
})

test('la carta empieza con un margen azul arriba y acaba con otro abajo', async ({ page }) => {
  await page.goto('/')
  await abrirCarta(page)
  const arriba = await page.locator('#carta').evaluate((c) => c.getBoundingClientRect().top)
  expect(arriba).toBeGreaterThanOrEqual(40)
  const abajo = await page.evaluate(() => {
    const mesa = document.querySelector('#mesa')!
    mesa.scrollTo(0, mesa.scrollHeight)
    const caja = document.querySelector('#carta')!.getBoundingClientRect()
    return mesa.scrollHeight - (caja.bottom + mesa.scrollTop)
  })
  expect(abajo).toBeGreaterThanOrEqual(40)
})

test('en escritorio el papel mide el ancho final del papel (D32)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el ancho final es solo de escritorio')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await abrirCarta(page)
  const ancho = await page.locator('#carta').evaluate((c) => c.getBoundingClientRect().width)
  expect(Math.abs(ancho - ANCHO_PAPEL_PX)).toBeLessThanOrEqual(1)
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

test.describe('ancho del papel (D32)', () => {
  // Mide min(760, ancho útil − 32); el ancho útil (clientWidth de .mesa) descuenta el hueco simétrico de la barra, por eso se mide
  for (const tam of [
    { width: 1920, height: 360, tope: true },
    { width: 1024, height: 768, tope: true },
    { width: 800, height: 600, tope: false },
    { width: 500, height: 360, tope: false },
    { width: 360, height: 740, tope: false },
  ]) {
    test(`a ${tam.width}x${tam.height} el papel mide min(${ANCHO_PAPEL_PX}, ancho − 32) y no hay scroll horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize(tam)
      await page.goto('/')
      await abrirCarta(page)
      const medidas = await page.evaluate(() => ({
        ancho: document.querySelector('#carta')!.getBoundingClientRect().width,
        util: document.querySelector('.mesa')!.clientWidth,
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      }))
      const esperado = Math.min(ANCHO_PAPEL_PX, medidas.util - 32)
      expect(Math.abs(medidas.ancho - esperado)).toBeLessThanOrEqual(1)
      if (tam.tope) expect(esperado).toBe(ANCHO_PAPEL_PX)
      expect(medidas.sinScroll).toBe(true)
    })
  }
})
