import { describe, expect, it } from 'vitest'
import {
  DURACION_FUNDIDO_FOTO_MS,
  DURACION_SALIDA_FOTO_MS,
  DURACION_VUELTA_FOTO_MS,
  planFundido,
  planPaso,
} from '../../src/carrusel/plan-paso'
import { EASE_ENTRADA, EASE_SALIDA } from '../../src/movimiento'

const transforms = (keyframes: readonly Keyframe[]) => keyframes.map((k) => k.transform)

describe('planPaso', () => {
  it('va despacio: 500 ms para apartarse y 700 ms para irse al fondo', () => {
    expect(DURACION_SALIDA_FOTO_MS).toBe(500)
    expect(DURACION_VUELTA_FOTO_MS).toBe(700)
    const { salida, vuelta } = planPaso('siguiente', 3)
    expect(salida.opciones).toMatchObject({ duration: 500, easing: EASE_ENTRADA })
    expect(vuelta.opciones).toMatchObject({ duration: 700, easing: EASE_SALIDA })
  })

  it('siguiente sale por la izquierda y vuelve a su inclinación', () => {
    const { salida, vuelta } = planPaso('siguiente', 3)
    expect(transforms(salida.keyframes)).toEqual(['translateX(0px) rotate(3deg)', 'translateX(-110%) rotate(-5deg)'])
    expect(transforms(vuelta.keyframes)).toEqual(['translateX(-110%) rotate(-5deg)', 'translateX(0px) rotate(3deg)'])
  })

  it('anterior sale por la derecha', () => {
    const { salida } = planPaso('anterior', -4)
    expect(salida.keyframes[1]?.transform).toBe('translateX(110%) rotate(4deg)')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('con giro %s usa 0', (valor) => {
    expect(planPaso('siguiente', valor).salida.keyframes[0]?.transform).toBe('translateX(0px) rotate(0deg)')
  })

  it('solo anima transform', () => {
    const { salida, vuelta } = planPaso('anterior', 2)
    for (const k of [...salida.keyframes, ...vuelta.keyframes]) expect(Object.keys(k)).toEqual(['transform'])
  })
})

describe('planFundido', () => {
  it('es un fundido de 150 ms sin desplazamiento', () => {
    expect(DURACION_FUNDIDO_FOTO_MS).toBe(150)
    expect(planFundido()).toEqual({ keyframes: [{ opacity: 0 }, { opacity: 1 }], opciones: { duration: 150, easing: 'linear' } })
  })
})
