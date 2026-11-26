import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOPE_ENVIO_MS, crearEnvio, urlValida } from '../../src/formulario/envio'
import type { Respuesta } from '../../src/formulario/validacion'
import { URL_PRUEBA } from '../destino-prueba'

const respuesta: Respuesta = { nom: 'Maria', assistira: true, alergens: 'gluten' }
const contesta = (cuerpo: string, status = 200) => vi.fn<typeof fetch>(async () => new Response(cuerpo, { status }))

describe('urlValida', () => {
  it.each([URL_PRUEBA, 'https://script.google.com/a/macros/exemple.cat/s/AKfy-c_b9/exec'])('acepta %s', (url) => {
    expect(urlValida(url)).toBe(true)
  })

  it.each([
    undefined,
    '',
    'http://script.google.com/macros/s/ID/exec',
    'https://script.google.com.mal.example/macros/s/ID/exec',
    'https://example.com/macros/s/ID/exec',
    'https://script.google.com/macros/s/ID/dev',
    'https://script.google.com/macros/s/ID/exec?x=1',
  ])('rechaza %j', (url) => {
    expect(urlValida(url)).toBe(false)
  })
})

describe('crearEnvio', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('manda la respuesta en JSON como texto plano, sin cookies ni referencia a la página', async () => {
    const pedir = contesta('{"ok":true}')
    await expect(crearEnvio(URL_PRUEBA, pedir)(respuesta)).resolves.toEqual({ ok: true })
    const [url, opciones] = pedir.mock.calls[0]!
    expect(url).toBe(URL_PRUEBA)
    expect(opciones).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' })
    // `text/plain` evita la consulta previa (preflight), que Apps Script no contesta
    expect(opciones!.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' })
    expect(JSON.parse(opciones!.body as string)).toEqual(respuesta)
  })

  it('sin destino configurado no finge que ha llegado', async () => {
    const pedir = contesta('{"ok":true}')
    await expect(crearEnvio(undefined, pedir)(respuesta)).resolves.toEqual({ ok: false, motivo: 'servidor' })
    expect(pedir).not.toHaveBeenCalled()
  })

  it.each([
    ['dice que no', '{"ok":false}', 200],
    ['contesta una página de error', '<html>Error</html>', 200],
    ['contesta otra cosa', 'null', 200],
    ['falla', '{"ok":true}', 500],
  ])('si el servidor %s, es un error', async (_caso, cuerpo, status) => {
    await expect(crearEnvio(URL_PRUEBA, contesta(cuerpo, status))(respuesta)).resolves.toEqual({ ok: false, motivo: 'servidor' })
  })

  it('sin red es un error de red', async () => {
    const pedir = vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('sin red')))
    await expect(crearEnvio(URL_PRUEBA, pedir)(respuesta)).resolves.toEqual({ ok: false, motivo: 'xarxa' })
  })

  it('si no contesta a tiempo, corta y avisa', async () => {
    vi.useFakeTimers()
    const pedir = vi.fn<typeof fetch>(
      (_url, opciones) =>
        new Promise((_resolver, rechazar) => opciones!.signal!.addEventListener('abort', () => rechazar(new Error('cortado')))),
    )
    const promesa = crearEnvio(URL_PRUEBA, pedir)(respuesta)
    await vi.advanceTimersByTimeAsync(TOPE_ENVIO_MS)
    await expect(promesa).resolves.toEqual({ ok: false, motivo: 'xarxa' })
  })
})
