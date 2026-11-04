import type { Page } from '@playwright/test'
import { CENTRO_SOBRE, LIMITE_ALTO_DVH, LIMITE_ANCHO_VW, cajaEscenario, cajaSobreEnVentana } from '../../src/carta/geometria'
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
    expect(peticiones.filter((url) => url.includes('/video/') || url.includes('sobre-abierto'))).toEqual([])
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

/** Ventana apaisada (16:9) para los tests del vídeo. */
const VENTANA_CON_VIDEO = { width: 1600, height: 900 }

/** Simula duración y tiempo del vídeo (D21): devuelve una función que fija el tiempo y avisa con `timeupdate`. */
async function simularVideo(page: Page, duracion = 3.04) {
  await page.locator('#video-apertura').evaluate((v, d) => {
    let actual = 0
    Object.defineProperty(v, 'duration', { configurable: true, get: () => d })
    Object.defineProperty(v, 'currentTime', { configurable: true, get: () => actual, set: (x) => (actual = x) })
  }, duracion)
  return (segundos: number) =>
    page.locator('#video-apertura').evaluate((v: HTMLVideoElement, t) => {
      ;(v as unknown as { currentTime: number }).currentTime = t
      v.dispatchEvent(new Event('timeupdate'))
    }, segundos)
}

/** Deja la página con el vídeo arrancado (`playing`) y sin terminar. */
async function arrancarVideo(page: Page) {
  await retenerVideo(page)
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
  await page.locator('#video-apertura').dispatchEvent('playing')
}

test.describe('apertura con vídeo', () => {
  test.use({ viewport: VENTANA_CON_VIDEO })

  test('reproduce el vídeo del sobre y, al quedar quieto, abre la carta con el foco en el título', async ({ page }) => {
    await retenerVideo(page)
    await page.goto('/')
    const cuerpo = page.locator('body')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    const video = page.locator('#video-apertura')
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('src', /\/video\/sobre\.mp4$/)
    expect(await video.evaluate((v: HTMLVideoElement) => [v.muted, v.playsInline])).toEqual([true, true])
    await expect(page.locator('#carta')).toHaveAttribute('inert', '')
    await video.dispatchEvent('playing')
    const poner = await simularVideo(page)
    await poner(1.3)
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await poner(1.4)
    await expect(cuerpo).toHaveAttribute('data-estado', 'abierta')
    await expect(page.locator('#titol')).toBeFocused()
  })

  test('hasta 1,4 s se ve el vídeo y no la imagen fija; a 1,4 s la imagen sustituye al vídeo, que se suelta', async ({ page }) => {
    await arrancarVideo(page)
    const video = page.locator('#video-apertura')
    const imagen = page.locator('#sobre-abierto')
    const poner = await simularVideo(page)
    await poner(1.39)
    await expect(page.locator('body')).not.toHaveAttribute('data-fase', /.*/)
    await expect(video).toBeVisible()
    await expect(imagen).toBeHidden()
    // Capturado en el instante del corte: la imagen ya es visible y el vídeo no
    await poner(1.4)
    await expect(page.locator('body')).toHaveAttribute('data-fase', 'papel-sube')
    await expect(imagen).toBeVisible()
    await expect(video).toBeHidden()
    expect(await video.evaluate((v: HTMLVideoElement) => v.hasAttribute('src'))).toBe(false)
  })

  test('sin duración conocida el corte sigue siendo 1,4 s; ended abre igualmente y un ended posterior no repite nada', async ({ page }) => {
    await arrancarVideo(page)
    const cuerpo = page.locator('body')
    const poner = await simularVideo(page, NaN)
    await poner(1.39)
    await page.waitForTimeout(150)
    await expect(cuerpo).toHaveAttribute('data-estado', 'abriendo')
    await page.locator('#video-apertura').dispatchEvent('ended')
    await expect(cuerpo).toHaveAttribute('data-estado', 'abierta')
    await page.evaluate(() => (document.querySelector('a, button, input') as HTMLElement).focus({ preventScroll: true }))
    await page.locator('#video-apertura').dispatchEvent('ended')
    await page.waitForTimeout(100)
    await expect(page.locator('#titol')).not.toBeFocused()
  })

  test('tras el corte la carta aparece con un fundido de 300 ms, arriba del todo, y la escena se retira al acabar', async ({ page }) => {
    await capturarFundidoAlAbrir(page)
    await arrancarVideo(page)
    const poner = await simularVideo(page)
    await poner(1.4)
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta')
    await esperarFundidoAlAbrir(page)
    await expect(page.locator('#escenario')).toBeHidden()
    await expect(page.locator('#fondo-escena')).toBeHidden()
    await expect(page.locator('body')).not.toHaveAttribute('data-fase', /.*/)
    const medidas = await page.evaluate(() => ({
      scrollY: window.scrollY,
      top: document.querySelector('#carta')!.getBoundingClientRect().top,
    }))
    expect(medidas.scrollY).toBe(0)
    expect(medidas.top).toBeGreaterThanOrEqual(40)
  })

  test('mientras se abre hay un fondo de escena en degradado y el escenario tiene los bordes difuminados', async ({ page }) => {
    await arrancarVideo(page)
    const fondo = page.locator('#fondo-escena')
    await expect(fondo).toBeVisible()
    expect(await fondo.evaluate((f) => getComputedStyle(f).backgroundImage)).toContain('linear-gradient')
    const mascara = await page.locator('#escenario').evaluate((e) => {
      const estilo = getComputedStyle(e)
      return estilo.maskImage || estilo.getPropertyValue('-webkit-mask-image')
    })
    expect(mascara).toContain('linear-gradient')
  })

  // El escenario es 16:9, cubre la ventana mientras el sobre quepa con aire y, si no, lo limita al 92 %
  for (const tam of [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1280, height: 900 },
    { width: 1024, height: 768 },
    { width: 800, height: 360 },
    { width: 1000, height: 1000 },
    { width: 412, height: 915 },
    { width: 360, height: 640 },
    { width: 2560, height: 1080 },
    { width: 1920, height: 420 },
  ]) {
    test(`con ${tam.width}x${tam.height} se pide el vídeo y el sobre entero se ve dentro de la ventana`, async ({ page }) => {
      await page.setViewportSize(tam)
      await retenerVideo(page)
      await page.goto('/')
      await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
      await expect(page.locator('#video-apertura')).toHaveAttribute('src', /\/video\/sobre\.mp4$/)
      await page.locator('#video-apertura').dispatchEvent('playing')
      const medido = await page.evaluate(() => {
        const caja = document.querySelector('#escenario')!.getBoundingClientRect()
        return {
          ventana: { ancho: innerWidth, alto: innerHeight },
          caja: { left: caja.left, top: caja.top, width: caja.width, height: caja.height },
          video: (() => {
            const v = document.querySelector('#video-apertura')!.getBoundingClientRect()
            return { left: v.left, top: v.top, width: v.width, height: v.height }
          })(),
          sinScrollHorizontal: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        }
      })
      const esperada = cajaEscenario(medido.ventana.ancho, medido.ventana.alto)!
      for (const clave of ['left', 'top', 'width', 'height'] as const) {
        expect(Math.abs(medido.caja[clave] - esperada[clave])).toBeLessThanOrEqual(1)
        expect(Math.abs(medido.video[clave] - esperada[clave])).toBeLessThanOrEqual(1)
      }
      const sobre = cajaSobreEnVentana(medido.caja)
      expect(sobre.left).toBeGreaterThanOrEqual(0)
      expect(sobre.top).toBeGreaterThanOrEqual(0)
      expect(sobre.left + sobre.width).toBeLessThanOrEqual(medido.ventana.ancho)
      expect(sobre.top + sobre.height).toBeLessThanOrEqual(medido.ventana.alto)
      expect(medido.sinScrollHorizontal).toBe(true)
    })
  }

  test('con una ventana 16:9 el escenario es la ventana', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await arrancarVideo(page)
    const caja = await page.locator('#escenario').evaluate((e) => {
      const c = e.getBoundingClientRect()
      return { left: c.left, top: c.top, width: c.width, height: c.height, ancho: innerWidth, alto: innerHeight }
    })
    expect(Math.abs(caja.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(caja.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(caja.width - caja.ancho)).toBeLessThanOrEqual(1)
    expect(Math.abs(caja.height - caja.alto)).toBeLessThanOrEqual(1)
  })

  test('los tokens CSS del escenario coinciden con geometria.ts', async ({ page }) => {
    await page.goto('/')
    const tokens = await page.evaluate(() => {
      const raiz = getComputedStyle(document.documentElement)
      const leer = (n: string) => raiz.getPropertyValue(n).trim()
      return {
        x: Number(leer('--sobre-centro-x')),
        y: Number(leer('--sobre-centro-y')),
        anchoMax: leer('--escenario-max-ancho'),
        altoMax: leer('--escenario-max-alto'),
      }
    })
    expect(tokens).toEqual({
      x: CENTRO_SOBRE.x,
      y: CENTRO_SOBRE.y,
      anchoMax: `${LIMITE_ANCHO_VW}vw`,
      altoMax: `${LIMITE_ALTO_DVH}dvh`,
    })
  })

  test('el vídeo y la imagen del sobre están en public y el vídeo viejo ya no', async ({ page }) => {
    const video = await page.request.get('/video/sobre.mp4')
    expect(video.status()).toBe(200)
    expect(video.headers()['content-type']).toBe('video/mp4')
    const imagen = await page.request.get('/img/sobre-abierto.webp')
    expect(imagen.status()).toBe(200)
    expect(imagen.headers()['content-type']).toBe('image/webp')
    const viejo = await page.request.get('/video/video_carta.mp4')
    expect([404, 200]).toContain(viejo.status())
    expect(viejo.headers()['content-type']).not.toBe('video/mp4')
  })

  test('si la imagen fija no carga, al llegar a 1,4 s la carta aparece con un fundido', async ({ page, problemas }) => {
    await page.route('**/img/sobre-abierto.webp', (ruta) => ruta.abort())
    await capturarFundidoAlAbrir(page)
    await arrancarVideo(page)
    const poner = await simularVideo(page)
    await poner(1.4)
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 3000 })
    await esperarFundidoAlAbrir(page)
    await expect(page.locator('#titol')).toBeFocused()
    await expect(page.locator('#escenario')).toBeHidden()
    const inesperados = problemas.filter((p) => !p.includes('ERR_FAILED'))
    expect(inesperados).toEqual([])
    problemas.length = 0
  })

  test('si la imagen fija no responde, a los 4 s la carta aparece con un fundido (D10)', async ({ page }) => {
    await page.route('**/img/sobre-abierto.webp', () => {})
    await retenerVideo(page)
    await capturarFundidoAlAbrir(page)
    // La imagen pendiente retrasa `load`, así que no se espera a él
    await page.goto('/', { waitUntil: 'commit' })
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
    await page.locator('#video-apertura').dispatchEvent('playing')
    const poner = await simularVideo(page)
    await poner(1.4)
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 6000 })
    await esperarFundidoAlAbrir(page)
    await expect(page.locator('#titol')).toBeFocused()
    await expect(page.locator('#escenario')).toBeHidden()
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
    expect(peticiones.filter((url) => url.includes('/video/') || url.includes('sobre-abierto'))).toEqual([])
    await expect(page.locator('#escenario')).toBeHidden()
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
