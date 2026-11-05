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
    const cuerpo = await page.locator('#carta section.bloque p').first().evaluate((el) => getComputedStyle(el).fontFamily)
    expect(cuerpo.startsWith('"Albert Sans"')).toBe(true)
  })

  test('la fuente de script se precarga con crossorigin', async ({ page }) => {
    await page.goto('/')
    const precarga = page.locator('link[rel="preload"][as="font"][crossorigin]')
    await expect(precarga).toHaveCount(1)
    await expect(precarga).toHaveAttribute('href', '/fuentes/pinyon-script-latin-400.woff2')
  })
})
