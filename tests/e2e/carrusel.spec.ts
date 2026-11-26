import { abrirCarta, expect, test } from './fixtures'

// Subbloque a: pila estática. Movimiento reducido para que la entrada no interfiera.
test.use({ reducedMotion: 'reduce' })

const TOTAL = 6
const GIROS = [-4, 3, -1.5, 5, -3, 2]

test.describe('carrusel: posición y aspecto (T3)', () => {
  test('está entre la cabecera y DATA, con un pliegue antes y otro después', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const y = (selector: string) => page.locator(selector).evaluate((e) => e.getBoundingClientRect().top)
    const cabecera = await y('.carta-cabecera')
    const carrusel = await y('#carrusel')
    const data = await y('#bloque-data')
    expect(cabecera).toBeLessThan(carrusel)
    expect(carrusel).toBeLessThan(data)
    const hermanos = await page.evaluate(() => {
      const c = document.querySelector('#carrusel')!
      return [c.previousElementSibling?.className, c.nextElementSibling?.className]
    })
    expect(hermanos).toEqual(['pliegue', 'pliegue'])
  })

  test('el título RECORDS es visible y nombra la sección', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    await expect(page.locator('#bloque-records')).toHaveText('RECORDS')
    await expect(page.locator('#carrusel')).toHaveAttribute('aria-labelledby', 'bloque-records')
  })

  test('hay 6 fotos de /img/fotos/, 3 altas y 3 anchas alternadas, con su alt', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const fotos = page.locator('#carrusel .foto')
    await expect(fotos).toHaveCount(TOTAL)
    for (let i = 0; i < TOTAL; i++) {
      const img = fotos.nth(i).locator('img')
      await img.scrollIntoViewIfNeeded()
      await expect(img).toHaveAttribute('src', `/img/fotos/mostra-${i + 1}.svg`)
      await expect(img).toHaveAttribute('alt', `Foto de mostra ${i + 1} de ${TOTAL}`)
      const alta = i % 2 === 0
      await expect(fotos.nth(i)).toHaveClass(alta ? /foto-alta/ : /foto-ancha/)
      // el marcador tiene la proporción de su formato (alto/ancho)
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth > 0)).toBe(true)
      const [w, h] = await img.evaluate((e: HTMLImageElement) => [e.naturalWidth, e.naturalHeight])
      expect(alta ? h > w : w > h).toBe(true)
      expect(alta ? h / w : w / h).toBeCloseTo(4 / 3, 2)
    }
    await expect(page.locator('#carrusel .foto-alta')).toHaveCount(3)
    await expect(page.locator('#carrusel .foto-ancha')).toHaveCount(3)
  })

  test('cada foto tiene una inclinación distinta (D5)', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const giros = await page
      .locator('#carrusel .foto')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).getPropertyValue('--giro').trim()))
    expect(new Set(giros).size).toBe(TOTAL)
    expect(giros.map((g) => Number.parseFloat(g))).toEqual(GIROS)
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
      expect(fondo).toContain(i % 2 === 0 ? '/img/marco-foto.png' : '/img/marco-foto-ancho.png')
      expect(await f.evaluate((e) => getComputedStyle(e).filter)).toContain('drop-shadow')
    }
    for (const archivo of ['marco-foto.png', 'marco-foto-ancho.png']) {
      const res = await page.request.get(`/img/${archivo}`)
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
      const alta = i % 2 === 0
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

  test('tamaños: altas ≈220 px y anchas ≈280 px de ancho, y ninguna pasa de 290 px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await abrirCarta(page)
    const medidas = await page.locator('#carrusel .foto').evaluateAll((els) => els.map((e) => ({ w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })))
    medidas.forEach((m, i) => {
      if (i % 2 === 0) {
        expect(m.w).toBeGreaterThanOrEqual(200)
        expect(m.w).toBeLessThanOrEqual(230)
        expect(m.h).toBeGreaterThan(m.w)
      } else {
        expect(m.w).toBeGreaterThanOrEqual(260)
        expect(m.w).toBeLessThanOrEqual(290)
        expect(m.w).toBeGreaterThan(m.h)
      }
    })
  })

  test('las fotos no llevan transiciones ni animaciones propias en CSS', async ({ page }) => {
    await page.goto('/')
    await abrirCarta(page)
    const foto = page.locator('#carrusel .foto').first()
    await expect(foto).toHaveCSS('transition-duration', '0s')
    await expect(foto).toHaveCSS('animation-name', 'none')
  })

  for (const tam of [{ width: 360, height: 740 }, { width: 1280, height: 900 }]) {
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

test.describe('carrusel sin JavaScript (T3)', () => {
  test.use({ javaScriptEnabled: false })

  test('se ve la pila con la foto 1 arriba y sin controles', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#carrusel')).toBeVisible()
    await expect(page.locator('#carrusel .foto').first()).toBeVisible()
    await expect(page.locator('#carrusel .carrusel-controles')).toBeHidden()
    const z = await page.locator('#carrusel .foto').evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).zIndex)))
    expect(z[0]).toBe(Math.max(...z))
  })
})
