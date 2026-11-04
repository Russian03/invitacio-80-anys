import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conTope } from '../../src/movimiento'

describe('conTope', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resuelve en cuanto resuelve la promesa, antes del tope', async () => {
    let resuelta = false
    void conTope(Promise.resolve(), 1000).then(() => {
      resuelta = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(resuelta).toBe(true)
  })

  it('con una promesa que nunca resuelve, espera al tope', async () => {
    let resuelta = false
    void conTope(new Promise(() => {}), 1200).then(() => {
      resuelta = true
    })
    await vi.advanceTimersByTimeAsync(1199)
    expect(resuelta).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(resuelta).toBe(true)
  })

  it('si la promesa rechaza, resuelve sin rechazar', async () => {
    await expect(conTope(Promise.reject(new Error('fallo')), 1000)).resolves.toBeUndefined()
  })

  it('permite un tope de 0 ms', async () => {
    const promesa = conTope(new Promise(() => {}), 0)
    await vi.advanceTimersByTimeAsync(0)
    await expect(promesa).resolves.toBeUndefined()
  })

  it('limpia el temporizador cuando la promesa llega antes', async () => {
    await conTope(Promise.resolve(), 1000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
