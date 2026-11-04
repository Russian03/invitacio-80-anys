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

test.describe('apertura con vídeo', () => {
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

  test('el vídeo se ve entero (contain) sobre el fondo de la mesa mientras se abre', async ({ page }) => {
    await retenerVideo(page)
    await page.goto('/')
    const video = page.locator('#video-apertura')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
    await video.dispatchEvent('playing')
    const estilo = await video.evaluate((v) => {
      const e = getComputedStyle(v)
      const mesa = getComputedStyle(document.documentElement).getPropertyValue('--color-mesa').trim()
      const muestra = document.createElement('i')
      muestra.style.backgroundColor = mesa
      document.body.append(muestra)
      const colorMesa = getComputedStyle(muestra).backgroundColor
      muestra.remove()
      return { ajuste: e.objectFit, fondo: e.backgroundColor, colorMesa }
    })
    expect(estilo.ajuste).toBe('contain')
    expect(estilo.fondo).toBe(estilo.colorMesa)
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

  test('no hay scroll horizontal a 360 px durante la apertura', async ({ page }) => {
    await retenerVideo(page)
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-estado', 'abriendo')
    const sinScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(sinScroll).toBe(true)
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
