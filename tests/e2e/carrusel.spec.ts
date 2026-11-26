import type { Page } from '@playwright/test'
import { abrirCarta, expect, test } from './fixtures'

// Pila estática. Movimiento reducido para que la entrada no interfiera.
test.use({ reducedMotion: 'reduce' })

const TOTAL = 4
const GIROS = [-9, -4, 4, 9]
/** Orientación de cada foto, en orden: `true` si es alta (3:4); si no, ancha (4:3). */
const ALTAS = [false, true, false, true]
const ARCHIVOS = ['foto-03.webp', 'foto-05.webp', 'foto-06.webp', 'foto-07.webp']

test.describe('carrusel: posición y aspecto', () => {
  test('va tras la presentación y antes de «On i quan?» en el orden de lectura', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const ordenado = await page.evaluate(() => {
      const [a, b, c] = ['.presentacio', '#carrusel', '.on-quan'].map((s) => document.querySelector(s)!)
      const sigue = (x: Element, y: Element) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING)
      return sigue(a!, b!) && sigue(b!, c!)
    })
    expect(ordenado).toBe(true)
  })

  test('no tiene título, botones ni contador; la sección se llama «Fotos»', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const carrusel = page.locator('#carrusel')
    await expect(carrusel).toHaveAttribute('aria-label', 'Fotos')
    await expect(carrusel.locator('h2, button, .contador')).toHaveCount(0)
  })

  test('hay 4 fotos de /img/fotos/ con su formato, su alt y de 150 kB como mucho', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const fotos = page.locator('#carrusel .foto')
    await expect(fotos).toHaveCount(TOTAL)
    for (let i = 0; i < TOTAL; i++) {
      const img = fotos.nth(i).locator('img')
      await img.scrollIntoViewIfNeeded()
      await expect(img).toHaveAttribute('src', `/img/fotos/${ARCHIVOS[i]}`)
      await expect(img).toHaveAttribute('alt', `Foto ${i + 1} de ${TOTAL}`)
      await expect(fotos.nth(i)).toHaveClass(ALTAS[i] ? /foto-alta/ : /foto-ancha/)
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth > 0)).toBe(true)
      const m = await img.evaluate((e: HTMLImageElement) => ({ w: e.naturalWidth, h: e.naturalHeight, aw: Number(e.getAttribute('width')), ah: Number(e.getAttribute('height')) }))
      expect([m.aw, m.ah]).toEqual([m.w, m.h])
      expect(ALTAS[i] ? m.h / m.w : m.w / m.h).toBeCloseTo(4 / 3, 2)
      const res = await page.request.get(`/img/fotos/${ARCHIVOS[i]}`)
      expect(res.headers()['content-type']).toContain('image/webp')
      expect((await res.body()).length).toBeLessThanOrEqual(150_000)
    }
  })

  test('las fotos se ven en color y sin número', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const fotos = await page.locator('#carrusel .foto').evaluateAll((els) =>
      els.map((e) => ({ filtro: getComputedStyle(e.querySelector('img')!).filter, numero: getComputedStyle(e, '::before').content })),
    )
    expect(fotos).toEqual(Array(TOTAL).fill({ filtro: 'none', numero: 'none' }))
  })

  for (const width of [320, 390, 1280]) {
    test(`a ${width} px, con cualquier foto arriba, se ve asomar la que hay detrás`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await abrirCarta(page)
      // Cuánto sobresale la foto siguiente por fuera de la de arriba (todas van centradas en la misma celda)
      const asoma = await page.locator('#carrusel .foto').evaluateAll((els) => {
        const cajas = (els as HTMLElement[]).map((e) => ({
          w: e.offsetWidth / 2,
          h: e.offsetHeight / 2,
          a: (Number.parseFloat(getComputedStyle(e).getPropertyValue('--giro')) * Math.PI) / 180,
        }))
        return cajas.map((arriba, i) => {
          const detras = cajas[(i + 1) % cajas.length]!
          const giro = detras.a - arriba.a
          const esquinas = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
            const x = sx! * detras.w, y = sy! * detras.h
            const rx = x * Math.cos(giro) - y * Math.sin(giro)
            const ry = x * Math.sin(giro) + y * Math.cos(giro)
            return Math.max(Math.abs(rx) - arriba.w, Math.abs(ry) - arriba.h)
          })
          return Math.max(...esquinas)
        })
      })
      for (const px of asoma) expect(px).toBeGreaterThanOrEqual(14)
    })
  }

  test('cada foto tiene una inclinación distinta', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const giros = await page
      .locator('#carrusel .foto')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).getPropertyValue('--giro').trim()))
    expect(new Set(giros).size).toBe(TOTAL)
    expect(giros.map((g) => Number.parseFloat(g))).toEqual(GIROS)
  })

  test('las dos verticales se tuercen hacia lados contrarios, y las dos horizontales también', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    for (const formato of ['alta', 'ancha']) {
      const [a, b] = await page
        .locator(`#carrusel .foto-${formato}`)
        .evaluateAll((els) => els.map((e) => Number.parseFloat(getComputedStyle(e).getPropertyValue('--giro'))))
      expect(a! * b!).toBeLessThan(0)
      expect(Math.abs(a! - b!)).toBeGreaterThanOrEqual(12)
    }
  })

  test('la foto 1 es la de arriba', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const z = await page.locator('#carrusel .foto').evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).zIndex)))
    expect(z[0]).toBe(Math.max(...z))
    expect(new Set(z).size).toBe(TOTAL)
  })

  test('el marco es la imagen antigua (alta o girada 90° para las anchas), sin borde CSS', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const fotos = page.locator('#carrusel .foto')
    for (let i = 0; i < TOTAL; i++) {
      const f = fotos.nth(i)
      await expect(f).toHaveCSS('border-top-width', '0px')
      const fondo = await f.evaluate((e) => getComputedStyle(e, '::after').backgroundImage)
      expect(fondo).toContain(ALTAS[i] ? '/img/marco-foto.png' : '/img/marco-foto-ancho.png')
      expect(await f.evaluate((e) => getComputedStyle(e).filter)).toContain('drop-shadow')
    }
    for (const marco of ['marco-foto.png', 'marco-foto-ancho.png']) {
      const res = await page.request.get(`/img/${marco}`)
      expect(res.ok()).toBe(true)
      expect(res.headers()['content-type']).toContain('image/png')
    }
  })

  test('la foto queda dentro del hueco del marco (medido en el PNG)', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const fotos = page.locator('#carrusel .foto')
    for (let i = 0; i < TOTAL; i++) {
      const f = fotos.nth(i)
      await f.scrollIntoViewIfNeeded()
      const r = await f.evaluate((e) => {
        const img = e.querySelector('img')!
        return { w: e.clientWidth, h: e.clientHeight, l: img.offsetLeft, t: img.offsetTop, iw: img.offsetWidth, ih: img.offsetHeight, fit: getComputedStyle(img).objectFit }
      })
      // hueco medido en el PNG: alta 13,6 % izq/der, 9,8 % arriba, 9,1 % abajo; ancha girada
      const alta = ALTAS[i]!
      const hueco = alta ? { l: 0.1364, r: 0.1364, t: 0.0981, b: 0.0907 } : { l: 0.0907, r: 0.0981, t: 0.1364, b: 0.1364 }
      expect(r.l / r.w).toBeLessThanOrEqual(hueco.l + 0.015)
      expect(r.l / r.w).toBeGreaterThanOrEqual(hueco.l - 0.025)
      expect((r.l + r.iw) / r.w).toBeGreaterThanOrEqual(1 - hueco.r - 0.015)
      expect((r.l + r.iw) / r.w).toBeLessThanOrEqual(1 - hueco.r + 0.025)
      expect(r.t / r.h).toBeLessThanOrEqual(hueco.t + 0.015)
      expect(r.t / r.h).toBeGreaterThanOrEqual(hueco.t - 0.025)
      expect((r.t + r.ih) / r.h).toBeGreaterThanOrEqual(1 - hueco.b - 0.015)
      expect((r.t + r.ih) / r.h).toBeLessThanOrEqual(1 - hueco.b + 0.025)
      expect(r.fit).toBe('cover')
    }
  })

  for (const [tam, alta, ancha] of [
    [{ width: 390, height: 844 }, 220, 280],
    [{ width: 1280, height: 900 }, 380, 480],
    [{ width: 1920, height: 1080 }, 380, 480],
  ] as const) {
    test(`a ${tam.width}x${tam.height} las altas miden ≈${alta} px de ancho y las anchas ≈${ancha} px`, async ({ page }) => {
      await page.setViewportSize(tam)
      await page.goto('/')
      await abrirCarta(page)
      const medidas = await page.locator('#carrusel .foto').evaluateAll((els) => els.map((e) => ({ w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })))
      medidas.forEach((m, i) => {
        const objetivo = ALTAS[i] ? alta : ancha
        expect(Math.abs(m.w - objetivo)).toBeLessThanOrEqual(10)
        expect(ALTAS[i] ? m.h > m.w : m.w > m.h).toBe(true)
      })
    })
  }

  // En ordenadores de poca altura la pila no puede ser tan grande que no quepa en la ventana
  for (const tam of [{ width: 1366, height: 650 }, { width: 800, height: 360 }]) {
    test(`a ${tam.width}x${tam.height} la pila cabe lo bastante en la ventana para que las fotos pasen`, async ({ page }) => {
      await page.setViewportSize(tam)
      await page.goto('/')
      await abrirCarta(page)
      const alto = await page.locator('#carrusel .pila').evaluate((e) => e.getBoundingClientRect().height)
      // Se pasan solas si al menos el 60 % de la pila está a la vista
      expect(alto * 0.6).toBeLessThan(tam.height)
    })
  }

  test('las fotos no llevan transiciones ni animaciones propias en CSS', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const foto = page.locator('#carrusel .foto').first()
    await expect(foto).toHaveCSS('transition-duration', '0s')
    await expect(foto).toHaveCSS('animation-name', 'none')
  })

  for (const tam of [{ width: 360, height: 740 }, { width: 720, height: 900 }, { width: 1280, height: 900 }]) {
    test(`a ${tam.width}px no hay scroll horizontal y las esquinas giradas quedan dentro del papel`, async ({ page }) => {
      await page.setViewportSize(tam)
      await page.goto('/')
      await abrirCarta(page)
      const r = await page.evaluate(() => {
        const papel = document.querySelector('#carta')!.getBoundingClientRect()
        const sec = document.querySelector('#carrusel')!
        let dentro = true
        for (const f of sec.querySelectorAll('.foto')) {
          const b = f.getBoundingClientRect()
          if (b.left < papel.left - 0.5 || b.right > papel.right + 0.5) dentro = false
        }
        const doc = document.documentElement
        const mesa = document.querySelector('#mesa')!
        return { dentro, sinScroll: doc.scrollWidth <= doc.clientWidth && mesa.scrollWidth <= mesa.clientWidth }
      })
      expect(r.sinScroll).toBe(true)
      expect(r.dentro).toBe(true)
    })
  }
})

test.describe('carrusel sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('se ve la pila con la foto 1 arriba', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#carrusel')).toBeVisible()
    await expect(page.locator('#carrusel .foto').first()).toBeVisible()
    const z = await page.locator('#carrusel .foto').evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).zIndex)))
    expect(z[0]).toBe(Math.max(...z))
  })
})

/** Número de la foto de arriba (la de mayor z-index). */
function arriba(page: Page) {
  return page.locator('#carrusel .foto').evaluateAll((els) => {
    const z = els.map((e) => Number(getComputedStyle(e).zIndex))
    return z.indexOf(Math.max(...z)) + 1
  })
}

const pila = (page: Page) => page.locator('#carrusel .pila')
const sinAnimaciones = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)

async function abrirEnCarrusel(page: Page) {
  await page.goto('/')
  await abrirCarta(page)
  await pila(page).scrollIntoViewIfNeeded()
}

/** Pasa una foto con el teclado: el foco en la pila detiene además el pase automático. */
async function pulsar(page: Page, tecla: 'ArrowLeft' | 'ArrowRight') {
  await pila(page).focus()
  await page.keyboard.press(tecla)
}

test.describe('carrusel: teclado', () => {
  test('solo una foto está disponible para el lector de pantalla', async ({ page }) => {
    await abrirEnCarrusel(page)
    await expect(page.locator('#carrusel .foto:not([aria-hidden="true"])')).toHaveCount(1)
  })

  test('las flechas avanzan y retroceden en círculo sin perder el foco', async ({ page }) => {
    await abrirEnCarrusel(page)
    await pulsar(page, 'ArrowRight')
    await expect.poll(() => arriba(page)).toBe(2)
    await sinAnimaciones(page)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => arriba(page)).toBe(1)
    await sinAnimaciones(page)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => arriba(page)).toBe(TOTAL)
    await expect(pila(page)).toBeFocused()
  })

  test('se llega a la pila con el tabulador y tiene nombre en catalán', async ({ page }) => {
    await abrirEnCarrusel(page)
    await expect(pila(page)).toHaveAttribute('tabindex', '0')
    await expect(pila(page)).toHaveAttribute('role', 'group')
    await expect(pila(page)).toHaveAttribute('aria-label', 'Fotos: passa-les amb les fletxes del teclat')
  })
})

test.describe('carrusel: con el dedo no se pasan', () => {
  test('arrastrar o tocar una foto no la mueve ni la cambia', async ({ page }) => {
    await abrirEnCarrusel(page)
    const foto = page.locator('#carrusel .foto').first()
    const antes = await foto.evaluate((e) => getComputedStyle(e).transform)
    const r = (await foto.boundingBox())!
    const [x, y] = [r.x + r.width / 2, r.y + r.height / 2]
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 160, y, { steps: 5 })
    expect(await foto.evaluate((e) => getComputedStyle(e).transform)).toBe(antes)
    await page.mouse.up()
    await foto.click()
    await sinAnimaciones(page)
    expect(await arriba(page)).toBe(1)
  })

  test('el dedo desplaza la carta con normalidad por encima de las fotos', async ({ page }) => {
    await abrirEnCarrusel(page)
    await expect(page.locator('#carrusel .foto').first()).toHaveCSS('touch-action', 'auto')
  })
})

test.describe('carrusel: pase automático', () => {
  const INTERVALO_MS = 3000

  /** Con el reloj de Playwright instalado se adelantan los segundos sin esperarlos. */
  async function abrirConReloj(page: Page) {
    await page.clock.install()
    await abrirEnCarrusel(page)
    await sinAnimaciones(page)
    // La pila avisa de que está a la vista en el siguiente fotograma
    await fotograma(page)
  }

  const fotograma = (page: Page) =>
    page.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))))

  async function adelantar(page: Page, ms = INTERVALO_MS + 100) {
    await page.clock.fastForward(ms)
    await sinAnimaciones(page)
  }

  const tocar = (page: Page, tipo: 'pointerdown' | 'pointerup') =>
    pila(page).evaluate((e, t) => {
      e.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true }))
    }, tipo)

  test('las fotos pasan solas, una cada tres segundos', async ({ page }) => {
    await abrirConReloj(page)
    await adelantar(page)
    await expect.poll(() => arriba(page)).toBe(2)
    await adelantar(page)
    await expect.poll(() => arriba(page)).toBe(3)
  })

  test('mientras no se ven, no pasan', async ({ page }) => {
    await abrirConReloj(page)
    await page.locator('#form-confirmacio button[type="submit"]').scrollIntoViewIfNeeded()
    await fotograma(page)
    await adelantar(page, 20_000)
    expect(await arriba(page)).toBe(1)
  })

  test('con el ratón encima siguen pasando: al bajar con la rueda el cursor queda sobre las fotos', async ({ page }) => {
    await abrirConReloj(page)
    await pila(page).hover()
    await adelantar(page)
    await expect.poll(() => arriba(page)).toBe(2)
    await adelantar(page)
    await expect.poll(() => arriba(page)).toBe(3)
  })

  test('mantener pulsado el botón del ratón las detiene y al soltarlo siguen', async ({ page }) => {
    await abrirConReloj(page)
    await pila(page).hover()
    await page.mouse.down()
    await adelantar(page, 20_000)
    expect(await arriba(page)).toBe(1)
    await page.mouse.up()
    await adelantar(page)
    await expect.poll(() => arriba(page)).toBe(2)
  })

  test('con el dedo apoyado se detienen y al levantarlo siguen', async ({ page }) => {
    await abrirConReloj(page)
    await tocar(page, 'pointerdown')
    await adelantar(page, 20_000)
    expect(await arriba(page)).toBe(1)
    await tocar(page, 'pointerup')
    await adelantar(page)
    await expect.poll(() => arriba(page)).toBe(2)
  })

  test('con el foco del teclado se detienen', async ({ page }) => {
    await abrirConReloj(page)
    await pila(page).focus()
    await adelantar(page, 20_000)
    expect(await arriba(page)).toBe(1)
  })
})

test.describe('carrusel: animación', () => {
  const propiedades = (page: Page) =>
    page.evaluate(() =>
      document.getAnimations().map((a) => {
        const efecto = a.effect as KeyframeEffect
        const claves = efecto.getKeyframes().flatMap((k) => Object.keys(k))
        return {
          duracion: Number(efecto.getTiming().duration),
          transform: claves.includes('transform'),
          opacity: claves.includes('opacity'),
          foto: [...document.querySelectorAll('#carrusel .foto')].indexOf(efecto.target!) + 1,
        }
      }),
    )

  /** Abre la carta sin su animación (más rápido y estable) y activa el movimiento para las fotos. */
  async function abrirConMovimiento(page: Page) {
    await abrirEnCarrusel(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await sinAnimaciones(page)
  }

  test('la foto de arriba sale, pasa al fondo y vuelve; una segunda orden a mitad se ignora', async ({ page }) => {
    await abrirConMovimiento(page)
    await pulsar(page, 'ArrowRight')
    expect(await propiedades(page)).toEqual([{ duracion: 500, transform: true, opacity: false, foto: 1 }])
    await page.keyboard.press('ArrowRight')
    await sinAnimaciones(page)
    expect(await arriba(page)).toBe(2)
  })

  test('la salida usa la misma curva que --ease-entrada de la hoja de estilos', async ({ page }) => {
    await abrirConMovimiento(page)
    await pulsar(page, 'ArrowRight')
    const [curva, variable] = await page.evaluate(() => [
      document.getAnimations()[0]!.effect!.getTiming().easing,
      getComputedStyle(document.documentElement).getPropertyValue('--ease-entrada').trim(),
    ])
    // La build minifica el CSS (`.64` por `0.64`): se comparan los números
    const numeros = (t: string) => t.match(/-?\d*\.?\d+/g)!.map(Number)
    expect(numeros(curva!)).toEqual(numeros(variable!))
  })

  test('con movimiento reducido es un fundido corto', async ({ page }) => {
    await abrirEnCarrusel(page)
    await page.evaluate(() => {
      document.querySelector('#carrusel .pila')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      for (const a of document.getAnimations()) a.pause()
    })
    expect(await propiedades(page)).toEqual([{ duracion: 150, transform: false, opacity: true, foto: 2 }])
  })
})

test.describe('carrusel: estados', () => {
  test('una foto que no carga muestra el aviso y se puede seguir pasando', async ({ page, problemas }) => {
    await page.route('**/img/fotos/foto-05.webp', (r) => r.abort())
    await abrirEnCarrusel(page)
    await pulsar(page, 'ArrowRight')
    const aviso = page.locator('#carrusel .foto').nth(1).locator('.foto-error')
    await expect(aviso).toHaveText('Imatge no disponible')
    await expect(aviso).toBeVisible()
    await sinAnimaciones(page)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => arriba(page)).toBe(3)
    problemas.length = 0
  })

  for (const [quedan, caso] of [[1, 'con una sola foto no hay nada que pasar'], [0, 'sin fotos la sección se oculta']] as const) {
    test(caso, async ({ page }) => {
      await page.addInitScript((n) => {
        document.addEventListener('readystatechange', () => {
          if (document.readyState !== 'interactive') return
          document.querySelectorAll('#carrusel .foto').forEach((f, i) => i >= n && f.remove())
        })
      }, quedan)
      await page.goto('/')
      await abrirCarta(page)
      await expect(pila(page)).not.toHaveAttribute('tabindex', /.*/)
      if (quedan === 0) await expect(page.locator('#carrusel')).toBeHidden()
      else await expect(page.locator('#carrusel')).toBeVisible()
    })
  }
})
