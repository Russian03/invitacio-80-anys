import { describe, expect, it } from 'vitest'
import { TEXTO_NO_DISPONIBLE } from '../../src/carrusel/textos'

describe('TEXTO_NO_DISPONIBLE', () => {
  it('está en catalán', () => {
    expect(TEXTO_NO_DISPONIBLE).toBe('Imatge no disponible')
  })
})
