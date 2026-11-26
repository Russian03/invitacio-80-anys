import { expect, test } from '@playwright/test'

test('publicada en una subcarpeta, todo se carga desde ella y sin errores', async ({ page, baseURL }) => {
  const fuera: string[] = []
  const fallidas: string[] = []
  const pedidas: string[] = []
  page.on('request', (peticion) => {
    const url = peticion.url()
    if (url.startsWith('data:')) return
    pedidas.push(url)
    if (!url.startsWith(baseURL!)) fuera.push(url)
  })
  page.on('response', (respuesta) => {
    if (respuesta.status() >= 400) fallidas.push(`${respuesta.status()} ${respuesta.url()}`)
  })

  await page.goto('./')
  await expect(page.locator('body')).toHaveAttribute('data-estado', 'abierta', { timeout: 10_000 })
  // Las fotos son perezosas: se piden al acercarse
  await page.locator('#carrusel').scrollIntoViewIfNeeded()
  await page.waitForLoadState('networkidle')

  expect(fuera).toEqual([])
  expect(fallidas).toEqual([])
  for (const recurso of ['video/sobre.mp4', 'img/sobre-abierto.webp', 'img/papel.webp', 'img/marco-foto.png', 'img/fotos/mostra-1.svg']) {
    expect(pedidas).toContain(`${baseURL}${recurso}`)
  }
})
