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
    const cuerpo = await page.locator('.presentacio p').evaluate((el) => getComputedStyle(el).fontFamily)
    expect(cuerpo.startsWith('"Albert Sans"')).toBe(true)
  })

  test('la cabecera dice «80è aniversari de la Kika», con la è del ordinal en minúscula', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const cabecera = page.locator('.carta-cabecera')
    await expect(cabecera.locator('p, h1')).toHaveText(['80è aniversari', 'de la Kika'])
    // El sobretítulo va en mayúsculas, pero el ordinal se escribe «80è», no «80È»
    await expect(cabecera.locator('.subtitulo')).toHaveCSS('text-transform', 'uppercase')
    await expect(cabecera.locator('.ordinal')).toHaveText('è')
    await expect(cabecera.locator('.ordinal')).toHaveCSS('text-transform', 'none')
  })

  for (const width of [320, 360, 412]) {
    test(`a ${width}px «80è aniversari» cabe en una sola línea`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')
      await abrirCarta(page)
      const lineas = await page.locator('.carta-cabecera .subtitulo').evaluate((e) => {
        const rango = document.createRange()
        rango.selectNodeContents(e)
        return new Set([...rango.getClientRects()].map((r) => Math.round(r.bottom / 8))).size
      })
      expect(lineas).toBe(1)
    })
  }

  test('la fuente de script se precarga con crossorigin', async ({ page }) => {
    await page.goto('/')
    const precarga = page.locator('link[rel="preload"][as="font"][crossorigin]')
    await expect(precarga).toHaveCount(1)
    await expect(precarga).toHaveAttribute('href', '/fuentes/pinyon-script-latin-400.woff2')
  })
})

const ETIQUETAS = ['On i quan?', 'Confirma la teva assistència']

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

  test('cada bloque tiene nombre: su título (aria-labelledby) o aria-label', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const ok = await page.evaluate(() =>
      [...document.querySelectorAll('#carta section.bloque')].map((s) => {
        const id = s.getAttribute('aria-labelledby')
        return id ? !!document.getElementById(id) : !!s.getAttribute('aria-label')
      }),
    )
    expect(ok.length).toBeGreaterThanOrEqual(3)
    expect(ok.every(Boolean)).toBe(true)
  })

  test('los acentos, el apóstrofo y el punto volado se ven tal cual', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.getByText('Camí de Dalt d’Alella, 15')).toBeVisible()
    await expect(page.getByPlaceholder('Al·lèrgens o intoleràncies (opcional)')).toBeVisible()
  })
})

const TEXTO_PRESENTACIO =
  'Vaig néixer el 27 de febrer de 1947 i aquest any faig 80 anys. M’agradaria celebrar-los amb tots aquells que, d’una manera o altra, han fet possible poder arribar a aquest dia tan especial.'
const MAPA =
  'https://www.google.com/maps/place/Restaurant+Mas+Blanc+Tiana/@41.487382,2.267159,628m/data=!3m2!1e3!4b1!4m6!3m5!1s0x12a4ba31becadc2f:0x8e846421e3b0a1f5!8m2!3d41.487378!4d2.2697339!16s%2Fg%2F11b8b2nqg6'

test.describe('presentación', () => {
  test('el texto está en catalán, tal cual', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    // Un solo párrafo: toda la presentación con la misma letra
    await expect(page.locator('.presentacio p')).toHaveText([TEXTO_PRESENTACIO])
  })

  for (const width of [320, 390, 1280]) {
    test(`a ${width} px la foto va a la derecha del texto, en color y dentro de la carta`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const img = page.locator('.presentacio .retrat img')
      await expect(img).toHaveAttribute('src', '/img/fotos/foto-10.webp')
      await expect(img).toHaveAttribute('alt', 'La Kika')
      await expect(img).toHaveCSS('filter', 'none')
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth > 0)).toBe(true)
      const m = await page.evaluate(() => {
        const caja = (s: string) => document.querySelector(s)!.getBoundingClientRect()
        const rango = document.createRange()
        rango.selectNodeContents(document.querySelector('.presentacio p')!)
        const retrato = caja('.presentacio .retrat')
        // Primeras líneas: las que quedan a la altura de la foto
        const alLado = [...rango.getClientRects()].filter((r) => r.top < retrato.bottom - 8 && r.bottom > retrato.top + 8)
        return { carta: caja('#carta'), retrato, alLado: alLado.map((r) => r.right), lineas: alLado.length }
      })
      expect(m.lineas).toBeGreaterThan(0)
      for (const derecha of m.alLado) expect(derecha).toBeLessThanOrEqual(m.retrato.left + 4)
      expect(m.retrato.right).toBeLessThanOrEqual(m.carta.right)
      expect(m.retrato.width).toBeGreaterThanOrEqual(100)
    })
  }
})

test.describe('on i quan', () => {
  for (const width of [320, 390, 1280]) {
    test(`a ${width} px la hora va al lado del lugar`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const m = await page.evaluate(() => {
        const caja = (s: string) => document.querySelector(s)!.getBoundingClientRect()
        return { hora: caja('.dades .hora'), lloc: caja('.dades .lloc') }
      })
      expect(m.hora.right).toBeLessThanOrEqual(m.lloc.left + 1)
      expect(m.hora.top).toBeLessThan(m.lloc.bottom)
      expect(m.lloc.top).toBeLessThan(m.hora.bottom)
    })
  }

  test('van en orden la fecha, la hora, el lugar, la dirección y el botón', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const bloque = page.locator('section[aria-labelledby="bloque-on-quan"]')
    await expect(bloque.locator('.hora')).toHaveText('A les 14 h')
    await expect(bloque.locator('.hora time')).toHaveAttribute('datetime', '14:00')
    await expect(bloque.locator('.texto-script')).toHaveText('Mas Blanc')
    await expect(bloque.locator('address')).toHaveText('Camí de Dalt d’Alella, 15')
    const y = await bloque.evaluate((b) =>
      ['.calendari', '.dades', '.pastilla'].map((s) => b.querySelector(s)!.getBoundingClientRect().top),
    )
    expect(y).toEqual([...y].sort((a, b) => a - b))
  })

  test('a 320 px el botón va en una línea y el número no se separa de la calle', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/')
    await abrirCarta(page)
    const lineas = await page.locator('.pastilla').evaluate((e) => {
      const texto = [...e.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!
      const rango = document.createRange()
      rango.selectNodeContents(texto)
      return rango.getClientRects().length
    })
    expect(lineas).toBe(1)
    expect(await page.locator('address').textContent()).toContain('d’Alella,\u00a015')
  })

  test('ya no están los apartados de hora, lugar ni programa', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.locator('#bloque-hora, #bloque-lloc, #bloque-programa, .programa')).toHaveCount(0)
  })

  test('el botón de ubicación tiene forma de pastilla y abre el mapa en otra pestaña', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const boton = page.getByRole('link', { name: /Veure la ubicació/ })
    await expect(boton).toHaveAttribute('href', MAPA)
    await expect(boton).toHaveAttribute('target', '_blank')
    await expect(boton).toHaveAttribute('rel', 'noopener noreferrer')
    const m = await boton.evaluate((e) => {
      const s = getComputedStyle(e)
      return { alto: e.getBoundingClientRect().height, radio: Number.parseFloat(s.borderRadius), texto: s.color, fondo: s.backgroundColor }
    })
    expect(m.alto).toBeGreaterThanOrEqual(48)
    expect(m.radio).toBeGreaterThanOrEqual(m.alto / 2)
    expect((luminancia(m.texto) + 0.05) / (luminancia(m.fondo) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
})

test.describe('fecha en forma de calendario', () => {
  test('muestra el mes y los días 25 a 28, con el 27 marcado con un círculo', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const calendari = page.locator('.calendari')
    await expect(calendari.locator('.calendari-mes')).toHaveText('Febrer')
    expect((await calendari.locator('li').allTextContents()).map((d) => d.trim())).toEqual(['25', '26', '27', '28'])
    const festa = calendari.locator('li.calendari-festa')
    await expect(festa).toHaveCount(1)
    await expect(festa).toHaveText('27')
    await expect(festa.locator('svg')).toBeVisible()
  })

  for (const width of [320, 390, 1280]) {
    test(`a ${width} px el mes y cada número van centrados en su casilla`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const desvios = await page.locator('.calendari-mes, .calendari li').evaluateAll((els) =>
        els.map((e) => {
          const texto = [...e.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!
          const rango = document.createRange()
          const t = texto.textContent!
          rango.setStart(texto, t.length - t.trimStart().length)
          rango.setEnd(texto, t.trimEnd().length)
          const [c, d] = [e.getBoundingClientRect(), rango.getBoundingClientRect()]
          return Math.abs(c.left + c.width / 2 - (d.left + d.width / 2))
        }),
      )
      for (const desvio of desvios) expect(desvio).toBeLessThanOrEqual(2)
    })
  }

  test('quien usa un lector de pantalla oye la fecha completa y no los números sueltos', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const fecha = page.locator('#bloque-on-quan ~ p time[datetime^="2027"]')
    await expect(fecha).toHaveText('Dissabte, 27 de febrer de 2027')
    await expect(fecha).toHaveAttribute('datetime', '2027-02-27')
    await expect(page.locator('.calendari')).toHaveAttribute('aria-hidden', 'true')
  })

  test('el mes y el día de la fiesta destacan en otro color, legible sobre el papel', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const color = (s: string) => page.locator(s).evaluate((e) => getComputedStyle(e).color)
    const festa = await color('.calendari-festa')
    expect(await color('.calendari-mes')).toBe(festa)
    expect(festa).not.toBe(await color('.calendari li:first-child'))
    expect((luminancia('rgb(243, 238, 225)') + 0.05) / (luminancia(festa) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })

  for (const width of [320, 360, 412, 1280]) {
    test(`a ${width} px de ancho el calendario y su círculo caben dentro de la carta`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const cajas = await page.evaluate(() => {
        const caja = (s: string) => document.querySelector(s)!.getBoundingClientRect()
        const dias = [...document.querySelectorAll('.calendari li')].map((e) => e.getBoundingClientRect())
        return {
          carta: caja('#carta'),
          columna: caja('.on-quan'),
          partes: [caja('.calendari'), caja('.calendari-festa svg')],
          enUnaFila: new Set(dias.map((d) => Math.round(d.top))).size === 1,
        }
      })
      expect(cajas.enUnaFila).toBe(true)
      const calendari = cajas.partes[0]!
      // Centrado en su columna
      expect(Math.abs(calendari.left - cajas.columna.left - (cajas.columna.right - calendari.right))).toBeLessThanOrEqual(1)
      for (const parte of cajas.partes) {
        expect(parte.left).toBeGreaterThanOrEqual(cajas.carta.left)
        expect(parte.right).toBeLessThanOrEqual(cajas.carta.right)
      }
    })
  }
})

test.describe('estilos de los bloques (T5)', () => {
  test('el cuerpo mide 20 px en móvil y 22 px en escritorio', async ({ page, isMobile }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.locator('.presentacio p')).toHaveCSS('font-size', isMobile ? '20px' : '22px')
  })

  test('el texto script mide 36 px en Pinyon Script y es marrón #462827; los títulos de apartado también son script', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const script = page.locator('.texto-script').first()
    await expect(script).toHaveCSS('font-size', '36px')
    await expect(script).toHaveCSS('color', 'rgb(70, 40, 39)')
    expect((await script.evaluate((el) => getComputedStyle(el).fontFamily)).startsWith('"Pinyon Script"')).toBe(true)
    const titulo = page.locator('.titulo-seccion').first()
    await expect(titulo).toHaveCSS('color', 'rgb(70, 40, 39)')
    expect((await titulo.evaluate((el) => getComputedStyle(el).fontFamily)).startsWith('"Pinyon Script"')).toBe(true)
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
      }
    })
    expect(r.principal).toBe('#462827')
    expect(r.texto).toBe('#462827')
    expect(r.fecha).toBe('rgb(70, 40, 39)')
    expect(r.boton).toBe('rgb(70, 40, 39)')
  })

  test('el contraste del texto sobre el papel es de al menos 4,5:1', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const colores = await page.evaluate(() => ({
      papel: getComputedStyle(document.documentElement).getPropertyValue('--color-papel').trim(),
      texto: getComputedStyle(document.querySelector('.titulo-seccion')!).color,
      sec: getComputedStyle(document.querySelector('.hora')!).color,
      principal: getComputedStyle(document.querySelector('.texto-script')!).color,
    }))
    expect(colores.papel).toBe('#f3eee1')
    const lp = luminancia('rgb(243, 238, 225)')
    for (const c of [colores.texto, colores.sec, colores.principal]) {
      const l = luminancia(c)
      expect((lp + 0.05) / (l + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('a 360 px no hay scroll horizontal y el botón de ubicación cabe en la carta', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
    await abrirCarta(page)
    const r = await page.evaluate(() => {
      const c = document.querySelector('#carta')!.getBoundingClientRect()
      return {
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        dentro: [...document.querySelectorAll('.pastilla, address')].every((li) => {
          const b = li.getBoundingClientRect()
          return b.left >= c.left && b.right <= c.right
        }),
      }
    })
    expect(r.sinScroll).toBe(true)
    expect(r.dentro).toBe(true)
  })
})

test.describe('separaciones entre apartados', () => {
  test('no hay ninguna raya: ni entre apartados ni encima de «80è aniversari»', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.locator('#carta .pliegue, #carta .linea-fina, #bloque-com-arribar')).toHaveCount(0)
    const conBorde = await page.locator('#carta > *').evaluateAll((els) =>
      els.filter((e) => ['borderTopWidth', 'borderBottomWidth'].some((p) => getComputedStyle(e)[p as 'borderTopWidth'] !== '0px')).length,
    )
    expect(conBorde).toBe(0)
  })

  for (const width of [360, 1280]) {
    test(`a ${width} px los apartados quedan separados por aire`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const huecos = await page.locator('#carta > *').evaluateAll((els) => {
        const cajas = els.slice(0).map((e) => e.getBoundingClientRect())
        return cajas.slice(1).map((c, i) => c.top - cajas[i]!.bottom)
      })
      for (const hueco of huecos) expect(hueco).toBeGreaterThanOrEqual(40)
    })
  }
})
const REGAL = 'Si voleu fer alguna cosa, tant el menjador del Raval com jo estarem molt contents i agraïts.'

test.describe('aportación', () => {
  test('el texto está en catalán, con el número de cuenta marcado como pendiente', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const regal = page.getByRole('complementary', { name: 'Aportació' })
    await expect(regal.locator('p')).toHaveText(REGAL)
    await expect(regal.locator('dt')).toHaveText('Número de compte')
    await expect(regal.locator('dd .nomes-lectors')).toHaveText('pendent')
    await expect(regal.locator('dd [aria-hidden="true"]')).toHaveText('ES•• •••• •••• •••• •••• ••••')
  })

  test('va entre «On i quan?» y la confirmación', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const y = await page.evaluate(() =>
      ['.on-quan', '.regal', '#confirmacio'].map((s) => document.querySelector(s)!.getBoundingClientRect().top),
    )
    expect(y).toEqual([...y].sort((a, b) => a - b))
  })
})

test.describe('maquetación', () => {
  const cajas = (page: import('@playwright/test').Page, selectores: string[]) =>
    page.evaluate((ss) => ss.map((s) => document.querySelector(s)!.getBoundingClientRect().toJSON() as DOMRect), selectores)

  test('en ordenador las fotos van encima de «On i quan?», centradas, y el texto al lado de la cuenta', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await abrirCarta(page)
    const [carta, fotos, onQuan, calendari, boton, texto, compte] = await cajas(page, [
      '#carta', '#carrusel', '.on-quan', '.calendari', '.pastilla', '.regal p', '.compte',
    ])
    expect(fotos!.bottom).toBeLessThanOrEqual(onQuan!.top)
    const centro = (c: DOMRect) => c.left + c.width / 2
    for (const c of [fotos!, onQuan!]) expect(Math.abs(centro(c) - centro(carta!))).toBeLessThanOrEqual(1)
    // Calendario y botón comparten los bordes de la columna
    for (const c of [calendari!, boton!]) {
      expect(Math.abs(c.left - onQuan!.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(c.right - onQuan!.right)).toBeLessThanOrEqual(1)
    }
    expect(texto!.right).toBeLessThanOrEqual(compte!.left)
  })

  test('en móvil van uno debajo de otro', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await abrirCarta(page)
    const [fotos, onQuan, texto, compte] = await cajas(page, ['#carrusel', '.on-quan', '.regal p', '.compte'])
    expect(fotos!.bottom).toBeLessThanOrEqual(onQuan!.top)
    expect(texto!.bottom).toBeLessThanOrEqual(compte!.top)
  })

  test('el texto va alineado a la izquierda; solo se centran la cabecera y el título de la respuesta', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const alineados = await page.evaluate(() =>
      ['.presentacio p', '#bloque-on-quan', '.adreca', '.regal p', '#form-confirmacio label'].map(
        (s) => getComputedStyle(document.querySelector(s)!).textAlign,
      ),
    )
    for (const a of alineados) expect(['left', 'start']).toContain(a)
    await expect(page.locator('.carta-cabecera')).toHaveCSS('text-align', 'center')
    await expect(page.locator('#titol-confirmacio')).toHaveCSS('text-align', 'center')
  })

  for (const width of [320, 360, 390, 720, 1280]) {
    test(`a ${width} px todo cabe dentro del papel, sin scroll horizontal`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const r = await page.evaluate(() => {
        const papel = document.querySelector('#carta')!.getBoundingClientRect()
        const mesa = document.querySelector('#mesa')!
        const fuera = [...document.querySelectorAll('#carta *')]
          .filter((e) => !e.closest('.nomes-lectors, [hidden], svg'))
          .filter((e) => {
            const b = e.getBoundingClientRect()
            return b.width > 0 && (b.left < papel.left - 0.5 || b.right > papel.right + 0.5)
          })
          .map((e) => `${e.tagName}.${e.className}`)
        return { fuera, sinScroll: mesa.scrollWidth <= mesa.clientWidth }
      })
      expect(r.fuera).toEqual([])
      expect(r.sinScroll).toBe(true)
    })
  }
})

test.describe('formulario de respuesta', () => {
  /** Líneas que ocupa el texto de un elemento. */
  const lineas = (page: import('@playwright/test').Page, selector: string) =>
    page.locator(selector).evaluate((e) => {
      const texto = [...e.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!
      const rango = document.createRange()
      rango.selectNodeContents(texto)
      return rango.getClientRects().length
    })

  test('a 320 px el botón de confirmar y «Mas Blanc» van en una línea', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/')
    await abrirCarta(page)
    expect(await lineas(page, '.boton-primario')).toBe(1)
    expect(await lineas(page, '.lloc .texto-script')).toBe(1)
  })

  for (const width of [360, 390, 1280]) {
    test(`a ${width} px cada respuesta ocupa dos líneas como mucho`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      for (const i of [1, 2]) expect(await lineas(page, `.opciones .opcion:nth-child(${i}) span`)).toBeLessThanOrEqual(2)
    })
  }

  test('pide nombre, asistencia y alérgenos; ya no hay comentario', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const campos = await page
      .locator('#form-confirmacio [name]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('name')))])
    expect(campos).toEqual(['nom', 'assistira', 'alergens'])
    await expect(page.getByText('Comentari')).toHaveCount(0)
  })

  for (const width of [320, 390, 1280]) {
    test(`a ${width} px las dos respuestas van una debajo de otra`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const [a, b] = await page.locator('.opcion').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))
      expect(b!.top).toBeGreaterThanOrEqual(a!.bottom)
      expect(Math.abs(a!.left - b!.left)).toBeLessThanOrEqual(1)
      for (const o of [a!, b!]) expect(o.height).toBeGreaterThanOrEqual(48)
    })
  }

  /** Bordes (ancho de cada lado), fondo y sombra calculados. */
  const caja = (page: import('@playwright/test').Page, selector: string) =>
    page.locator(selector).evaluateAll((els) =>
      els.map((e) => {
        const s = getComputedStyle(e)
        return {
          lados: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
          colorLinea: s.borderBottomColor,
          fondo: s.backgroundColor,
          sombra: s.boxShadow,
          radio: Number.parseFloat(s.borderTopLeftRadius),
          alto: e.getBoundingClientRect().height,
        }
      }),
    )
  const SIN_FONDO = 'rgba(0, 0, 0, 0)'

  test('ni el apartado ni las respuestas llevan recuadro, fondo o sombra', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await page.locator('.opcion').first().click()
    for (const c of await caja(page, '#confirmacio, .opcion')) {
      expect(c.lados).toEqual(['0px', '0px', '0px', '0px'])
      expect(c.fondo).toBe(SIN_FONDO)
      expect(c.sombra).toBe('none')
    }
    expect(await page.locator('#confirmacio').evaluate((e) => getComputedStyle(e, '::before').content)).toBe('none')
  })

  test('las casillas de texto son recuadros redondeados, sin fondo, que se distinguen del papel (3:1)', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const papel = luminancia('rgb(243, 238, 225)')
    for (const campo of await caja(page, '#nom, #alergens')) {
      for (const lado of campo.lados) expect(Number.parseFloat(lado)).toBeGreaterThanOrEqual(1)
      expect(campo.radio).toBeGreaterThanOrEqual(10)
      expect(campo.fondo).toBe(SIN_FONDO)
      expect(campo.sombra).toBe('none')
      expect(campo.alto).toBeGreaterThanOrEqual(56)
      // Color del borde ya mezclado con el papel
      const [r, g, b, a = 1] = campo.colorLinea.match(/\d*\.?\d+/g)!.map(Number) as [number, number, number, number?]
      const mezcla = [r, g, b].map((v, i) => Math.round(v * a + [243, 238, 225][i]! * (1 - a)))
      const l = luminancia(`rgb(${mezcla.join(', ')})`)
      expect((papel + 0.05) / (l + 0.05)).toBeGreaterThanOrEqual(3)
    }
  })

  test('el nombre de cada casilla va dentro, sin título encima, y el lector de pantalla lo sigue oyendo', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    for (const [id, texto] of [['nom', 'Nom i cognoms'], ['alergens', 'Al·lèrgens o intoleràncies (opcional)']] as const) {
      const campo = page.locator(`#${id}`)
      await expect(campo).toHaveAttribute('placeholder', texto)
      await expect(page.getByLabel(texto)).toHaveAttribute('id', id)
      await expect(page.locator(`label[for="${id}"]`)).toHaveClass(/nomes-lectors/)
      const color = await campo.evaluate((e) => getComputedStyle(e, '::placeholder').color)
      expect((luminancia('rgb(243, 238, 225)') + 0.05) / (luminancia(color) + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
    await expect(page.locator('#nom')).toHaveAttribute('required', '')
    await expect(page.locator('#form-confirmacio .nota, #form-confirmacio .requisit')).toHaveCount(0)
  })

  for (const width of [320, 390, 1280]) {
    test(`a ${width} px el texto de dentro de las casillas se lee entero`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      const m = await page.locator('#nom, #alergens').evaluateAll((els) =>
        (els as (HTMLInputElement | HTMLTextAreaElement)[]).map((e) => {
          const estilo = getComputedStyle(e)
          const lienzo = document.createElement('canvas').getContext('2d')!
          lienzo.font = `${estilo.fontSize} ${estilo.fontFamily}`
          const hueco = e.clientWidth - Number.parseFloat(estilo.paddingLeft) - Number.parseFloat(estilo.paddingRight)
          // La de una línea no puede cortar el texto; la de varias lo parte y crece
          return e.tagName === 'INPUT' ? lienzo.measureText(e.placeholder).width <= hueco : e.scrollHeight <= e.clientHeight + 1
        }),
      )
      expect(m).toEqual([true, true])
    })
  }

  test('al escribir, el recuadro se marca en teja', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await page.locator('#nom').focus()
    // El color cambia con una transición corta: se espera a que acabe
    await expect(page.locator('#nom')).toHaveCSS('border-top-color', 'rgb(154, 51, 36)')
    await expect(page.locator('#nom')).toHaveCSS('box-shadow', 'rgb(154, 51, 36) 0px 0px 0px 1px')
    const m = await page.locator('#nom').evaluate((e) => {
      const s = getComputedStyle(e)
      return { bordes: [s.borderTopColor, s.borderLeftColor, s.borderBottomColor], sombra: s.boxShadow, contorno: s.outlineStyle, fondo: s.backgroundColor }
    })
    expect(m.bordes).toEqual(Array(3).fill('rgb(154, 51, 36)'))
    // Aro de 1 px por fuera: el borde se ve más grueso
    expect(m.sombra).toContain('0px 0px 0px 1px')
    expect(m.contorno).toBe('none')
    expect(m.fondo).toBe(SIN_FONDO)
  })

  test('la respuesta elegida se ve en su círculo y en negrita', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const opcion = page.locator('.opcion').nth(1)
    const circulo = () => opcion.locator('input').evaluate((e) => getComputedStyle(e).backgroundImage)
    expect(await circulo()).toBe('none')
    await opcion.click()
    await expect(opcion.locator('input')).toBeChecked()
    expect(await circulo()).toContain('radial-gradient')
    await expect(opcion).toHaveCSS('font-weight', '600')
  })
})
