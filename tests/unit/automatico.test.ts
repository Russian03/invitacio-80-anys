import { describe, expect, it } from 'vitest'
import { INTERVALO_FOTO_MS, esperaTrasPaso, puedePasarSola, type Condiciones } from '../../src/carrusel/automatico'

const TODO_A_FAVOR: Condiciones = {
  abierta: true,
  aLaVista: true,
  pestanaVisible: true,
  sujeta: false,
  conTeclado: false,
}

describe('puedePasarSola', () => {
  it('pasa una foto cada tres segundos', () => {
    expect(INTERVALO_FOTO_MS).toBe(3000)
  })

  it.each([
    [0, 3000],
    [1200, 1800],
    [3000, 0],
    [5000, 0],
    [-1, 3000],
    [Number.NaN, 3000],
  ])('si el último paso ha durado %s ms, espera %s ms para el siguiente', (paso, espera) => {
    expect(esperaTrasPaso(paso)).toBe(espera)
  })

  it('pasa sola con la carta abierta, la pila a la vista y nadie tocándola', () => {
    expect(puedePasarSola(TODO_A_FAVOR)).toBe(true)
  })

  it.each(['abierta', 'aLaVista', 'pestanaVisible'] as const)('no pasa si falta «%s»', (clave) => {
    expect(puedePasarSola({ ...TODO_A_FAVOR, [clave]: false })).toBe(false)
  })

  it.each(['sujeta', 'conTeclado'] as const)('se detiene con «%s»', (clave) => {
    expect(puedePasarSola({ ...TODO_A_FAVOR, [clave]: true })).toBe(false)
  })
})
