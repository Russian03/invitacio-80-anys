import { describe, expect, it } from 'vitest'
import { anterior, parseGrados, profundidades, siguiente } from '../../src/carrusel/pila'

describe('siguiente y anterior', () => {
  it('con 6 fotos, siguiente de la última vuelve a la primera', () => {
    expect(siguiente(5, 6)).toBe(0)
    expect(siguiente(0, 6)).toBe(1)
  })

  it('con 6 fotos, anterior de la primera es la última', () => {
    expect(anterior(0, 6)).toBe(5)
    expect(anterior(3, 6)).toBe(2)
  })

  it('con 1 foto siempre es 0', () => {
    expect(siguiente(0, 1)).toBe(0)
    expect(anterior(0, 1)).toBe(0)
  })

  it.each([0, -1, Number.NaN, 2.5])('con total %s devuelven 0', (total) => {
    expect(siguiente(0, total)).toBe(0)
    expect(anterior(0, total)).toBe(0)
  })

  it.each([-1, 6, 1.5, Number.NaN])('con arriba %s fuera de rango devuelven 0', (arriba) => {
    expect(siguiente(arriba, 6)).toBe(0)
    expect(anterior(arriba, 6)).toBe(0)
  })
})

describe('profundidades', () => {
  it('con la foto 2 arriba de 6 da [4, 5, 0, 1, 2, 3]', () => {
    expect(profundidades(2, 6)).toEqual([4, 5, 0, 1, 2, 3])
  })

  it('con 1 foto es [0]', () => {
    expect(profundidades(0, 1)).toEqual([0])
  })

  it.each([0, -1, Number.NaN, 2.5])('con total %s devuelve una lista vacía', (total) => {
    expect(profundidades(0, total)).toEqual([])
  })
})

describe('parseGrados', () => {
  it.each([
    ['-4deg', -4],
    [' 3deg ', 3],
    ['-1.5deg', -1.5],
    ['', 0],
    ['abc', 0],
  ])('%j da %s', (texto, esperado) => {
    expect(parseGrados(texto)).toBe(esperado)
  })
})
