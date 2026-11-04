import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esperarEvento, topeFin } from '../../src/carta/video'

describe('esperarEvento', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resuelve true si llega el evento de éxito antes del tope', async () => {
    const objetivo = new EventTarget()
    const espera = esperarEvento(objetivo, 'playing', ['error'], 1000)
    objetivo.dispatchEvent(new Event('playing'))
    await expect(espera).resolves.toBe(true)
  })

  it('resuelve false si llega un evento de fallo', async () => {
    const objetivo = new EventTarget()
    const espera = esperarEvento(objetivo, 'playing', ['error'], 1000)
    objetivo.dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBe(false)
  })

  it('resuelve false al vencer el tope y no antes', async () => {
    const objetivo = new EventTarget()
    let resultado: boolean | undefined
    void esperarEvento(objetivo, 'playing', ['error'], 1000).then((valor) => {
      resultado = valor
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(resultado).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(resultado).toBe(false)
  })

  it('al resolver quita los listeners y el temporizador', async () => {
    const objetivo = new EventTarget()
    const espera = esperarEvento(objetivo, 'playing', ['error'], 1000)
    objetivo.dispatchEvent(new Event('playing'))
    await espera
    expect(vi.getTimerCount()).toBe(0)
    // un fallo posterior no cambia el resultado ya resuelto ni lanza
    objetivo.dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBe(true)
  })
})

describe('topeFin', () => {
  it('suma el margen a la duración', () => {
    expect(topeFin(8)).toBe(10000)
  })

  it.each([NaN, Infinity, 0, -3])('con duración %s usa el tope fijo', (duracion) => {
    expect(topeFin(duracion)).toBe(15000)
  })
})
