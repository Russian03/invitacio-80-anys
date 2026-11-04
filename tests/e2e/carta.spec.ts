import type { Page } from '@playwright/test'
import { abrirCarta, expect, test } from './fixtures'

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('sin JavaScript la carta se ve abierta (S-11)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#titol')).toBeVisible()
    await expect(page.locator('#carta')).not.toHaveAttribute('inert', /.*/)
  })

  test('sin JavaScript no se ve ni se descarga el vídeo (S-11)', async ({ page }) => {
    const peticiones: string[] = []
    page.on('request', (peticion) => peticiones.push(peticion.url()))
    await page.goto('/')
    await expect(page.locator('#video-apertura')).toBeHidden()
    expect(peticiones.filter((url) => url.includes('/video/'))).toEqual([])
  })
})

/** Retiene la petición del .mp4 sin responder: el vídeo ni falla ni arranca; los eventos se simulan (D21). */
async function retenerVideo(page: Page) {
  await page.route('**/video/*.mp4', () => {})
}

/** Captura las animaciones de #carta en el instante en que el body pasa a `abierta`. */
async function capturarFundidoAlAbrir(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __alAbrir?: unknown[] }
    new MutationObserver(() => {
      if (w.__alAbrir || document.body?.getAttribute('data-estado') !== 'abierta') return
      w.__alAbrir = (document.querySelector('#carta') as Element).getAnimations().map((animacion) => {
        const efecto = animacion.effect as KeyframeEffect
        return {
          duracionMs: Number(efecto.getComputedTiming().duration),
          propiedades: [...new Set(efecto.getKeyframes().flatMap((f) => Object.keys(f)))].filter(
            (k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k),
          ),
        }
      })
    }).observe(document, { attributes: true, attributeFilter: ['data-estado'], subtree: true })
  })
}

async function esperarFundidoAlAbrir(page: Page) {
  const animaciones = await page.evaluate(
    () => (window as unknown as { __alAbrir?: { duracionMs: number; propiedades: string[] }[] }).__alAbrir,
  )
  expect(animaciones?.length ?? 0).toBeGreaterThan(0)
  expect(animaciones?.some((a) => a.duracionMs === 300 && a.propiedades.join() === 'opacity')).toBe(true)
}

/** Ventana apaisada (16:9) donde sí se reproduce el vídeo; el móvil en vertical no lo reproduce hasta 02d. */
const VENTANA_CON_VIDEO = { width: 1600, height: 900 }

test.describe('apertura con vídeo', () => {
  test.use({ viewport: VENTANA_CON_VIDEO })

  test('reproduce el vídeo y al terminar abre la carta con el foco en el título', async ({ page }) => {
    await retenerVideo(page)
    await page.goto('/')
    const cuerpo = page.locator('body')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    const video = page.locator('#video-apertura')
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('src', /\/video\/video_carta\.mp4$/)
    expect(await video.evaluate((v: HTMLVideoElement) => [v.muted, v.playsInline])).toEqual([true, true])
    await expect(page.locator('#carta')).toHaveAttribute('inert', '')
    await video.dispatchEvent('playing')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await video.dispatchEvent('ended')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abierta')
    await expect(page.locator('#titol')).toBeFocused()
    await expect(video).toBeHidden()
  })

  test('el vídeo tiene de fondo el azul de la mesa mientras se abre', async ({ page }) => {
    await retenerVideo(page)
    await page.goto('/')
    const video = page.locator('#video-apertura')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
    await video.dispatchEvent('playing')
    const estilo = await video.evaluate((v) => {
      const mesa = getComputedStyle(document.documentElement).getPropertyValue('--color-mesa').trim()
      const muestra = document.createElement('i')
      muestra.style.backgroundColor = mesa
      document.body.append(muestra)
      const colorMesa = getComputedStyle(muestra).backgroundColor
      muestra.remove()
      return { fondo: getComputedStyle(v).backgroundColor, colorMesa }
    })
    expect(estilo.fondo).toBe(estilo.colorMesa)
  })

  // Con vídeo (ancho/alto >= 1,47 y alto >= ~409): el vídeo ocupa el alto del viewport, sin franjas arriba ni abajo, y el papel coincide
  for (const tam of [
    { width: 1920, height: 1080, ajuste: 'contain' },
    { width: 1920, height: 900, ajuste: 'contain' },
    { width: 1440, height: 900, ajuste: 'cover' },
    // Alto mínimo: el papel mide 617 px (>= 600) y el del fotograma coincide con el HTML
    { width: 1920, height: 420, ajuste: 'contain' },
  ]) {
    test(`el vídeo cubre el alto y al terminar la carta coincide con el último fotograma (${tam.width}x${tam.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: tam.width, height: tam.height })
      await retenerVideo(page)
      await page.goto('/')
      const video = page.locator('#video-apertura')
      await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
      await video.dispatchEvent('playing')
      // El fotograma se dibuja a alto completo (sin franjas arriba ni abajo): contain si la ventana es más ancha que 16:9,
      // cover (recorta los lados) si es más estrecha. El papel mide 82,66 % de su ancho y va centrado en la caja.
      const fotograma = await video.evaluate((v) => {
        const caja = v.getBoundingClientRect()
        const estilo = getComputedStyle(v)
        const anchoFotograma = (innerHeight * 16) / 9
        return {
          arriba: caja.top,
          alto: caja.height,
          altoVentana: innerHeight,
          ajuste: estilo.objectFit,
          posicion: estilo.objectPosition,
          ancho: 0.8266 * anchoFotograma,
          izquierda: caja.left + (caja.width - 0.8266 * anchoFotograma) / 2,
        }
      })
      expect(fotograma.arriba).toBe(0)
      expect(fotograma.alto).toBe(fotograma.altoVentana)
      expect(fotograma.ajuste).toBe(tam.ajuste)
      expect(fotograma.posicion).toBe('50% 50%')
      await video.dispatchEvent('ended')
      await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta')
      const medidas = await page.evaluate(() => {
        const caja = document.querySelector('#carta')!.getBoundingClientRect()
        const mesa = document.querySelector('.mesa') as HTMLElement
        return {
          top: caja.top,
          left: caja.left,
          width: caja.width,
          scrollY: window.scrollY,
          margen: parseFloat(getComputedStyle(mesa).paddingTop),
        }
      })
      expect(Math.abs(medidas.top)).toBeLessThanOrEqual(1)
      expect(Math.abs(medidas.width - fotograma.ancho)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(medidas.left - fotograma.izquierda)).toBeLessThanOrEqual(1.5)
      expect(medidas.scrollY).toBe(medidas.margen)
      // Al subir se ve el margen azul de arriba
      await page.evaluate(() => window.scrollTo(0, 0))
      expect(await page.locator('#carta').evaluate((c) => c.getBoundingClientRect().top)).toBe(medidas.margen)
    })
  }

  // Entre 1,2:1 y 1,47:1 el vídeo recorta los lados (cover) y al terminar la carta queda a 16 px de cada borde (D22)
  for (const tam of [
    { width: 1280, height: 900 },
    { width: 1024, height: 768 },
    { width: 1100, height: 900 },
  ]) {
    test(`con ${tam.width}x${tam.height} el vídeo recorta los lados y la carta queda a 16 px`, async ({ page }) => {
      await page.setViewportSize(tam)
      await retenerVideo(page)
      await page.goto('/')
      const video = page.locator('#video-apertura')
      await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
      await expect(video).toHaveAttribute('src', /\/video\/video_carta\.mp4$/)
      await video.dispatchEvent('playing')
      const fotograma = await video.evaluate((v) => {
        const caja = v.getBoundingClientRect()
        return { arriba: caja.top, alto: caja.height, altoVentana: innerHeight, ajuste: getComputedStyle(v).objectFit }
      })
      expect(fotograma.arriba).toBe(0)
      expect(fotograma.alto).toBe(fotograma.altoVentana)
      expect(fotograma.ajuste).toBe('cover')
      await video.dispatchEvent('ended')
      await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta')
      const medidas = await page.evaluate(() => {
        const caja = document.querySelector('#carta')!.getBoundingClientRect()
        const mesa = document.querySelector('.mesa') as HTMLElement
        return {
          top: caja.top,
          left: caja.left,
          width: caja.width,
          util: mesa.getBoundingClientRect().width,
          scrollY: window.scrollY,
          margen: parseFloat(getComputedStyle(mesa).paddingTop),
        }
      })
      expect(Math.abs(medidas.left - 16)).toBeLessThanOrEqual(1)
      expect(Math.abs(medidas.width - (medidas.util - 32))).toBeLessThanOrEqual(1)
      expect(Math.abs(medidas.top)).toBeLessThanOrEqual(1)
      expect(medidas.scrollY).toBe(medidas.margen)
    })
  }

  // Sin vídeo: poco apaisada (< 1,2:1) o demasiado baja (papel < 600 px): carta con fundido de 300 ms y scroll en 0
  for (const tam of [
    { width: 1100, height: 1000 },
    { width: 900, height: 900 },
    { width: 1920, height: 380 },
    { width: 1200, height: 400 },
  ]) {
    test(`con ${tam.width}x${tam.height} no se descarga el vídeo y la carta aparece con fundido`, async ({ page }) => {
      const peticiones: string[] = []
      page.on('request', (peticion) => peticiones.push(peticion.url()))
      await page.setViewportSize(tam)
      await retenerVideo(page)
      // El fundido es una animación CSS de la carta mientras está `abriendo`: se captura al entrar en ese estado
      await page.addInitScript(() => {
        const w = window as unknown as { __abriendo?: unknown[] }
        new MutationObserver(() => {
          if (w.__abriendo || document.body?.getAttribute('data-estado') !== 'abriendo') return
          w.__abriendo = document.getAnimations().map((animacion) => {
            const efecto = animacion.effect as KeyframeEffect
            return {
              duracionMs: Number(efecto.getComputedTiming().duration),
              propiedades: [...new Set(efecto.getKeyframes().flatMap((f) => Object.keys(f)))].filter(
                (k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k),
              ),
            }
          })
        }).observe(document, { attributes: true, attributeFilter: ['data-estado'], subtree: true })
      })
      await page.goto('/')
      await abrirCarta(page)
      const fundido = await page.evaluate(
        () => (window as unknown as { __abriendo?: { duracionMs: number; propiedades: string[] }[] }).__abriendo,
      )
      expect(fundido?.some((a) => a.duracionMs === 300 && a.propiedades.join() === 'opacity')).toBe(true)
      expect(peticiones.filter((url) => url.includes('/video/'))).toEqual([])
      await expect(page.locator('#video-apertura')).toBeHidden()
      await expect(page.locator('#video-apertura')).not.toHaveAttribute('src', /.*/)
      await expect(page.locator('#titol')).toBeFocused()
      const medidas = await page.evaluate(() => ({
        scrollY: window.scrollY,
        top: document.querySelector('#carta')!.getBoundingClientRect().top,
      }))
      expect(medidas.scrollY).toBe(0)
      expect(medidas.top).toBeGreaterThanOrEqual(40)
    })
  }

  test('en vertical (móvil) tampoco se descarga el vídeo hasta 02d', async ({ page }) => {
    const peticiones: string[] = []
    page.on('request', (peticion) => peticiones.push(peticion.url()))
    await page.setViewportSize({ width: 412, height: 915 })
    await retenerVideo(page)
    await page.goto('/')
    await abrirCarta(page)
    expect(peticiones.filter((url) => url.includes('/video/'))).toEqual([])
  })

  test('la apertura se da por terminada 1,5 s antes del final, sin esperar a ended; ended posterior no repite nada', async ({
    page,
  }) => {
        await retenerVideo(page)
    await page.goto('/')
    const cuerpo = page.locator('body')
    const video = page.locator('#video-apertura')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await video.dispatchEvent('playing')
    // Duración y tiempo simulados (D21)
    await video.evaluate((v) => {
      let actual = 0
      Object.defineProperty(v, 'duration', { configurable: true, get: () => 10 })
      Object.defineProperty(v, 'currentTime', { configurable: true, get: () => actual, set: (x) => (actual = x) })
      ;(v as unknown as { __poner: (x: number) => void }).__poner = (x) => {
        actual = x
        v.dispatchEvent(new Event('timeupdate'))
      }
    })
    const poner = (x: number) => video.evaluate((v, t) => (v as unknown as { __poner: (x: number) => void }).__poner(t), x)
    await poner(8.4)
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await poner(8.5)
    await expect(cuerpo).toHaveAttribute('data-estado', 'abierta')
    await expect(page.locator('#titol')).toBeFocused()
    const margen = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.mesa')!).paddingTop))
    expect(await page.evaluate(() => window.scrollY)).toBe(margen)
    // El vídeo se suelta para que no siga decodificando
    expect(await video.evaluate((v: HTMLVideoElement) => v.hasAttribute('src'))).toBe(false)
    // ended posterior: ni scroll ni foco otra vez
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      ;(document.querySelector('a, button, input') as HTMLElement).focus({ preventScroll: true })
    })
    await video.dispatchEvent('ended')
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.locator('#titol')).not.toBeFocused()
    await expect(cuerpo).toHaveAttribute('data-estado', 'abierta')
  })

  test('sin duración conocida, timeupdate no abre la carta: solo ended', async ({ page }) => {
    await retenerVideo(page)
    await page.goto('/')
    const cuerpo = page.locator('body')
    const video = page.locator('#video-apertura')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await video.dispatchEvent('playing')
    await video.evaluate((v) => {
      Object.defineProperty(v, 'duration', { configurable: true, get: () => NaN })
      Object.defineProperty(v, 'currentTime', { configurable: true, get: () => 99 })
      v.dispatchEvent(new Event('timeupdate'))
    })
    await page.waitForTimeout(200)
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await video.dispatchEvent('ended')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abierta')
  })

  test('con el fallo del vídeo la carta aparece con el margen azul arriba (scroll 0)', async ({ page }) => {
    await retenerVideo(page)
    await page.goto('/')
    await page.locator('body[data-estado="abierta"]').waitFor({ timeout: 6000 })
    const medidas = await page.evaluate(() => ({
      scrollY: window.scrollY,
      top: document.querySelector('#carta')!.getBoundingClientRect().top,
    }))
    expect(medidas.scrollY).toBe(0)
    expect(medidas.top).toBeGreaterThanOrEqual(40)
  })

  test('el scroll vertical reserva su hueco para no mover el papel al terminar el vídeo', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveCSS('scrollbar-gutter', /stable/)
  })

  test('si el vídeo no arranca en 4 s, la carta aparece con un fundido', async ({ page }) => {
    await retenerVideo(page)
    await capturarFundidoAlAbrir(page)
    const inicio = Date.now()
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 6000 })
    expect(Date.now() - inicio).toBeGreaterThan(3500)
    await esperarFundidoAlAbrir(page)
    await expect(page.locator('#titol')).toBeFocused()
  })

  test('si el vídeo no se puede descargar, la carta aparece con un fundido', async ({ page, problemas }) => {
    await page.route('**/video/*.mp4', (ruta) => ruta.abort())
    await capturarFundidoAlAbrir(page)
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 3000 })
    await esperarFundidoAlAbrir(page)
    // Solo es esperable el error del recurso abortado
    const inesperados = problemas.filter((p) => !p.includes('ERR_FAILED'))
    expect(inesperados).toEqual([])
    problemas.length = 0
  })

  test('si el navegador no deja reproducir (autoplay bloqueado), la carta aparece', async ({ page }) => {
    await retenerVideo(page)
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('bloqueado', 'NotAllowedError'))
    })
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 3000 })
    await expect(page.locator('#titol')).toBeFocused()
  })

  test('si algo falla al arrancar el vídeo, la carta aparece (D10)', async ({ page }) => {
    await retenerVideo(page)
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => {
        throw new Error('fallo al reproducir')
      }
    })
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 3000 })
    await expect(page.locator('#titol')).toBeFocused()
  })

  test('el vídeo está en public/video', async ({ page }) => {
    const respuesta = await page.request.get('/video/video_carta.mp4')
    expect(respuesta.status()).toBe(200)
    expect(respuesta.headers()['content-type']).toBe('video/mp4')
  })

  test('la CSP de la build permite el vídeo solo del propio sitio (S-04)', async ({ page }) => {
    await page.goto('/')
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("media-src 'self'")
  })
})

test('mientras se abre, el contenido no se puede usar', async ({ page }) => {
  await page.setViewportSize(VENTANA_CON_VIDEO)
  await retenerVideo(page)
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-estado', /^(cerrada|abriendo)$/)
  await expect(page.locator('#carta')).toHaveAttribute('inert', '')
})

const PROPIEDADES_NO_ANIMADAS = ['offset', 'computedOffset', 'easing', 'composite']

test.describe('con movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' })

  test('no hay botón para saltar ni sobre: la carta se abre sola y el foco va al título', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Saltar/ })).toHaveCount(0)
    await expect(page.locator('#sobre')).toHaveCount(0)
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 3500 })
    await expect(page.locator('#titol')).toBeFocused()
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

  test('no se descarga ni se reproduce el vídeo', async ({ page }) => {
    const peticiones: string[] = []
    page.on('request', (peticion) => peticiones.push(peticion.url()))
    await page.goto('/')
    await abrirCarta(page)
    expect(peticiones.filter((url) => url.includes('/video/'))).toEqual([])
    await expect(page.locator('#video-apertura')).toBeHidden()
    await expect(page.locator('#video-apertura')).not.toHaveAttribute('src', /.*/)
  })

  test('la apertura es un fundido de 300 ms sin escala', async ({ page }) => {
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
