import { abrirCarta, expect, test } from './fixtures'

test.use({ reducedMotion: 'reduce' })

test.describe('tipografías propias', () => {
  test('las fuentes de la carta están cargadas tras abrirla', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    // check() devuelve true si la familia no está declarada, así que también se comprueba que las caras declaradas están cargadas
    const cargadas = await page.evaluate(() => ({
      script: document.fonts.check('1em "Pinyon Script"'),
      texto: document.fonts.check('600 1em "Albert Sans"'),
      caras: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
    }))
    expect(cargadas.script).toBe(true)
    expect(cargadas.texto).toBe(true)
    expect(cargadas.caras).toEqual(expect.arrayContaining(['Pinyon Script', 'Albert Sans']))
  })

  test('los woff2 salen de /fuentes/ y la de script se pide una sola vez', async ({ page }) => {
    const respuestas: { url: string; estado: number }[] = []
    page.on('response', (r) => {
      if (r.url().endsWith('.woff2')) respuestas.push({ url: new URL(r.url()).pathname, estado: r.status() })
    })
    await page.goto('/')
    await abrirCarta(page)
    expect(respuestas.length).toBeGreaterThan(0)
    for (const r of respuestas) {
      expect(r.url.startsWith('/fuentes/')).toBe(true)
      expect(r.estado).toBe(200)
    }
    expect(respuestas.filter((r) => r.url.includes('pinyon-script'))).toHaveLength(1)
  })

  test('el título usa Pinyon Script sin cursiva artificial y el cuerpo Albert Sans', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const titulo = await page.locator('#titol').evaluate((el) => {
      const e = getComputedStyle(el)
      return { familia: e.fontFamily, estilo: e.fontStyle }
    })
    expect(titulo.familia.startsWith('"Pinyon Script"')).toBe(true)
    expect(titulo.estilo).toBe('normal')
    const cuerpo = await page.locator('#bloque-com-arribar ~ p').evaluate((el) => getComputedStyle(el).fontFamily)
    expect(cuerpo.startsWith('"Albert Sans"')).toBe(true)
  })

  test('la fuente de script se precarga con crossorigin', async ({ page }) => {
    await page.goto('/')
    const precarga = page.locator('link[rel="preload"][as="font"][crossorigin]')
    await expect(precarga).toHaveCount(1)
    await expect(precarga).toHaveAttribute('href', '/fuentes/pinyon-script-latin-400.woff2')
  })
})

const ETIQUETAS = ['DATA', 'HORA', 'LLOC', 'PROGRAMA', 'COM ARRIBAR', 'CONFIRMA LA TEVA ASSISTÈNCIA']

// Luminancia relativa WCAG de un color "rgb(r, g, b)"
function luminancia(css: string): number {
  const [r, g, b] = (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number) as [number, number, number]
  const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

test.describe('bloques de contenido (T4)', () => {
  test('los títulos de bloque salen en orden', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    expect(await page.locator('#carta h2').allTextContents()).toEqual(ETIQUETAS)
  })

  test('PROGRAMA es una lista de 4 a 5 filas con su hora', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const filas = page.locator('#bloque-programa ~ ol.programa > li')
    const n = await filas.count()
    expect(n).toBeGreaterThanOrEqual(4)
    expect(n).toBeLessThanOrEqual(5)
    for (let i = 0; i < n; i++) await expect(filas.nth(i).locator('time')).toHaveCount(1)
  })

  test('cada bloque apunta con aria-labelledby a un id que existe', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const ok = await page.evaluate(() =>
      [...document.querySelectorAll('#carta section.bloque')].map((s) => {
        const id = s.getAttribute('aria-labelledby')
        return !!id && !!document.getElementById(id)
      }),
    )
    expect(ok.length).toBeGreaterThanOrEqual(6)
    expect(ok.every(Boolean)).toBe(true)
  })

  test('los acentos y el punto volado se ven tal cual', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.getByText('Dissabte, 15 de març de 2027')).toBeVisible()
    await expect(page.getByText('Carrer de Lorem, 1 · 00000 Ipsum')).toBeVisible()
    await expect(page.getByText('Al·lèrgens o intoleràncies (opcional)')).toBeVisible()
  })
})

test.describe('estilos de los bloques (T5)', () => {
  test('el cuerpo mide 20 px en móvil y 22 px en escritorio', async ({ page, isMobile }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.locator('#bloque-com-arribar ~ p')).toHaveCSS('font-size', isMobile ? '20px' : '22px')
  })

  test('el texto script mide 36 px en Pinyon Script y es marrón #462827; la etiqueta usa el color de texto', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const script = page.locator('.texto-script').first()
    await expect(script).toHaveCSS('font-size', '36px')
    await expect(script).toHaveCSS('color', 'rgb(70, 40, 39)')
    expect((await script.evaluate((el) => getComputedStyle(el).fontFamily)).startsWith('"Pinyon Script"')).toBe(true)
    await expect(page.locator('.etiqueta').first()).toHaveCSS('color', 'rgb(70, 40, 39)')
    await expect(page.locator('#titol')).toHaveCSS('color', 'rgb(70, 40, 39)')
  })

  test('todo el texto y las líneas finas de la carta usan #462827, sin ningún azul decorativo', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const r = await page.evaluate(() => {
      const css = (sel: string, prop: string) => getComputedStyle(document.querySelector(sel)!).getPropertyValue(prop)
      return {
        principal: css(':root', '--color-principal').trim(),
        texto: css(':root', '--color-texto').trim(),
        fecha: css('.texto-script', 'color'),
        boton: css('.boton-primario', 'background-color'),
        borde: css('textarea', 'border-top-color'),
      }
    })
    expect(r.principal).toBe('#462827')
    expect(r.texto).toBe('#462827')
    expect(r.fecha).toBe('rgb(70, 40, 39)')
    expect(r.boton).toBe('rgb(70, 40, 39)')
    expect(r.borde).toBe('rgb(70, 40, 39)')
  })

  test('el contraste del texto sobre el papel es de al menos 4,5:1', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const colores = await page.evaluate(() => ({
      papel: getComputedStyle(document.documentElement).getPropertyValue('--color-papel').trim(),
      texto: getComputedStyle(document.querySelector('.etiqueta')!).color,
      sec: getComputedStyle(document.querySelector('.nota')!).color,
      principal: getComputedStyle(document.querySelector('.texto-script')!).color,
    }))
    expect(colores.papel).toBe('#f3eee1')
    const lp = luminancia('rgb(243, 238, 225)')
    for (const c of [colores.texto, colores.sec, colores.principal]) {
      const l = luminancia(c)
      expect((lp + 0.05) / (l + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('a 360 px no hay scroll horizontal y el programa cabe en la carta', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
    await abrirCarta(page)
    const r = await page.evaluate(() => {
      const c = document.querySelector('#carta')!.getBoundingClientRect()
      return {
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        dentro: [...document.querySelectorAll('.programa li')].every((li) => {
          const b = li.getBoundingClientRect()
          return b.left >= c.left && b.right <= c.right
        }),
      }
    })
    expect(r.sinScroll).toBe(true)
    expect(r.dentro).toBe(true)
  })
})

test.describe('pliegues y líneas finas (T6)', () => {
  test('hay 7 pliegues decorativos', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const pliegues = page.locator('#carta > .pliegue')
    await expect(pliegues).toHaveCount(7)
    for (let i = 0; i < 7; i++) await expect(pliegues.nth(i)).toHaveAttribute('aria-hidden', 'true')
  })

  for (const tam of [
    { width: 360, height: 740 },
    { width: 1280, height: 900 },
  ]) {
    test(`a ${tam.width}x${tam.height} el pliegue ocupa el papel menos el relieve y está centrado`, async ({ page }) => {
      await page.setViewportSize(tam)
      await page.goto('/')
      await abrirCarta(page)
      const m = await page.evaluate(() => {
        const c = document.querySelector('#carta')!.getBoundingClientRect()
        return [...document.querySelectorAll('#carta > .pliegue')].map((p) => {
          const b = p.getBoundingClientRect()
          return { ancho: b.width, izq: b.left - c.left, der: c.right - b.right, c: c.width }
        })
      })
      for (const p of m) {
        expect(Math.abs(p.ancho - (p.c - 8))).toBeLessThanOrEqual(1)
        expect(Math.abs(p.izq - p.der)).toBeLessThanOrEqual(1)
      }
    })
  }

  test('el pliegue no lleva la línea de luz blanca (la breve línea blanca entre apartados)', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const r = await page.evaluate(() =>
      [...document.querySelectorAll('#carta > .pliegue')].map((p) => {
        const e = getComputedStyle(p)
        return { abajo: e.borderBottomWidth, fondo: e.backgroundColor, alto: p.getBoundingClientRect().height }
      }),
    )
    for (const p of r) {
      expect(p.abajo).toBe('0px')
      expect(p.fondo).toBe('rgba(0, 0, 0, 0)')
      expect(p.alto).toBe(1)
    }
  })

  test('los pliegues no tienen animaciones ni transiciones', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const r = await page.evaluate(() =>
      [...document.querySelectorAll('#carta > .pliegue')].map((p) => ({
        anim: p.getAnimations().length,
        trans: getComputedStyle(p).transitionDuration,
      })),
    )
    for (const p of r) {
      expect(p.anim).toBe(0)
      expect(p.trans).toBe('0s')
    }
  })

  test('hay dos líneas finas de 160 px: una antes de VINE A CELEBRAR y otra tras COM ARRIBAR', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const lineas = page.locator('#carta .linea-fina')
    await expect(lineas).toHaveCount(2)
    for (let i = 0; i < 2; i++) {
      await expect(lineas.nth(i)).toHaveCSS('width', '160px')
      await expect(lineas.nth(i)).toHaveCSS('height', '2px')
      await expect(lineas.nth(i)).toHaveCSS('background-color', 'rgb(70, 40, 39)')
    }
    const orden = await page.evaluate(() => {
      const y = (s: string) => document.querySelector(s)!.getBoundingClientRect().top
      const ls = [...document.querySelectorAll('#carta .linea-fina')].map((l) => l.getBoundingClientRect().top)
      return { primera: ls[0]! < y('.subtitulo'), segunda: ls[1]! > y('#bloque-com-arribar ~ p') }
    })
    expect(orden).toEqual({ primera: true, segunda: true })
  })
})

test.describe('opción marcada', () => {
  test('la opción de radio marcada tiene un fondo cálido, no azul', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await page.locator('.opcion').first().locator('input').check({ force: true })
    const [r, , b] = (
      (await page.locator('.opcion').first().evaluate((e) => getComputedStyle(e).backgroundColor)).match(/\d+/g) ?? []
    ).map(Number) as [number, number, number]
    expect(r).toBeGreaterThan(b)
  })
})
