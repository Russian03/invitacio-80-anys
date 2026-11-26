import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { envioSimulado } from '../../src/formulario/envio'
import type { Respuesta } from '../../src/formulario/validacion'

const respuesta: Respuesta = { nom: 'Maria', assistira: true, alergens: '' }

describe('envioSimulado', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('no se resuelve antes de 800 ms', async () => {
    let resuelta = false
    void envioSimulado(respuesta).then(() => {
      resuelta = true
    })
    await vi.advanceTimersByTimeAsync(799)
    expect(resuelta).toBe(false)
  })

  it('se resuelve con { ok: true } al llegar a 800 ms', async () => {
    const promesa = envioSimulado(respuesta)
    await vi.advanceTimersByTimeAsync(800)
    await expect(promesa).resolves.toEqual({ ok: true })
  })

  it('permite una espera de 0 ms', async () => {
    const promesa = envioSimulado(respuesta, 0)
    await vi.advanceTimersByTimeAsync(0)
    await expect(promesa).resolves.toEqual({ ok: true })
  })
})
