import { describe, expect, it } from 'vitest'
import { TEXTO_NO_DISPONIBLE, textoContador } from '../../src/carrusel/textos'

describe('textoContador', () => {
  it('la posición es el índice más uno', () => {
    expect(textoContador(0, 6)).toBe('1 de 6')
    expect(textoContador(1, 6)).toBe('2 de 6')
    expect(textoContador(5, 6)).toBe('6 de 6')
  })
})

describe('TEXTO_NO_DISPONIBLE', () => {
  it('está en catalán', () => {
    expect(TEXTO_NO_DISPONIBLE).toBe('Imatge no disponible')
  })
})
