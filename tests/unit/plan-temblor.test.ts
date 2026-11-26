import { describe, expect, it } from 'vitest'
import { DESPLAZAMIENTO_TEMBLOR_PX, DURACION_TEMBLOR_MS, planTemblor } from '../../src/formulario/plan-temblor'

describe('planTemblor', () => {
  const { keyframes, opciones } = planTemblor()
  const desplazamientos = keyframes.map((k) => Number(/translateX\((-?[\d.]+)px\)/.exec(String(k.transform))![1]))

  it('es corto y se hace una sola vez', () => {
    expect(DURACION_TEMBLOR_MS).toBe(450)
    expect(opciones).toEqual({ duration: 450, easing: 'ease-in-out' })
  })

  it('empieza y acaba en su sitio', () => {
    expect(desplazamientos[0]).toBe(0)
    expect(desplazamientos.at(-1)).toBe(0)
  })

  it('va a un lado y a otro, cada vez menos', () => {
    const medio = desplazamientos.slice(1, -1)
    expect(Math.abs(medio[0]!)).toBe(DESPLAZAMIENTO_TEMBLOR_PX)
    for (let i = 1; i < medio.length; i++) {
      expect(medio[i]! * medio[i - 1]!).toBeLessThan(0)
      expect(Math.abs(medio[i]!)).toBeLessThanOrEqual(Math.abs(medio[i - 1]!))
    }
  })

  it('solo mueve en horizontal', () => {
    for (const k of keyframes) expect(Object.keys(k)).toEqual(['transform'])
  })
})
