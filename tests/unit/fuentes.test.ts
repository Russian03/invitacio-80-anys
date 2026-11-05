import { describe, expect, it, vi } from 'vitest'
import { FUENTES_CARTA, cargarFuentes } from '../../src/fuentes'

describe('cargarFuentes', () => {
  it('pide cada descriptor de FUENTES_CARTA', async () => {
    const load = vi.fn().mockResolvedValue([])
    await cargarFuentes({ load })
    expect(load.mock.calls.map((llamada) => llamada[0])).toEqual([...FUENTES_CARTA])
  })

  it('resuelve aunque una carga rechace', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValue([])
    await expect(cargarFuentes({ load })).resolves.toBeUndefined()
    expect(load).toHaveBeenCalledTimes(FUENTES_CARTA.length)
  })

  it('resuelve al momento si no hay conjunto de fuentes', async () => {
    await expect(cargarFuentes(undefined)).resolves.toBeUndefined()
  })

  it('no resuelve antes de que acaben las cargas', async () => {
    let terminar: () => void = () => {}
    const load = vi.fn().mockReturnValue(new Promise<FontFace[]>((r) => (terminar = () => r([]))))
    let resuelta = false
    const espera = cargarFuentes({ load }).then(() => (resuelta = true))
    await Promise.resolve()
    await Promise.resolve()
    expect(resuelta).toBe(false)
    terminar()
    await espera
    expect(resuelta).toBe(true)
  })

  it('resuelve si load lanza de forma síncrona', async () => {
    const load = vi.fn(() => {
      throw new Error('sintaxis')
    })
    await expect(cargarFuentes({ load })).resolves.toBeUndefined()
  })
})
