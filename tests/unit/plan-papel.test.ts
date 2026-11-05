import { describe, expect, it } from 'vitest'
import { BOCA, bocaEnVentana, cajaEscenario, cajaPapelEnSobre, poligonoBoca, type Transformacion } from '../../src/carta/geometria'
import {
  DURACION_MINIMA_FASE_MS,
  EASE_FASE,
  DURACION_MAXIMA_TOTAL_MS,
  FACTOR_LARGO_HOJA,
  MARGEN_ARRIBA_PX,
  Y_GIRO_FOTOGRAMA,
  VELOCIDAD_PX_S,
  planPapel,
  transformCss,
} from '../../src/carta/plan-papel'

const ESCENARIO = cajaEscenario(1920, 1080)!
const CARTA = { left: 580, top: 64, width: 760, height: 1016 }
/** Y de ventana del borde inferior de una hoja de `alto` px con una transformación. */
const bordeInferior = (t: Transformacion, alto: number) => CARTA.top + t.y + alto * t.escala

describe('planPapel', () => {
  it('el papel escondido está en la boca del sobre a la escala del ancho de la boca menos los lados', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    const enSobre = cajaPapelEnSobre(ESCENARIO)
    expect(plan.escondido.escala).toBeCloseTo(enSobre.width / CARTA.width, 6)
    expect(plan.escondido.x).toBeCloseTo(enSobre.left - CARTA.left, 6)
  })

  it('escondido: el borde superior del papel queda a la altura del punto más bajo de la boca, sin asomar', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    const boca = bocaEnVentana(ESCENARIO)
    expect(CARTA.top + plan.escondido.y).toBeCloseTo(Math.max(...boca.map((p) => p.y)), 6)
  })

  it('arriba: misma escala y x que escondido y más alto', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    expect(plan.arriba.escala).toBe(plan.escondido.escala)
    expect(plan.arriba.x).toBe(plan.escondido.x)
    expect(plan.arriba.y).toBeLessThan(plan.escondido.y)
  })

  it('Y_GIRO_FOTOGRAMA es la y del segundo punto de la boca (429, 324)', () => {
    expect(Y_GIRO_FOTOGRAMA).toBe(324)
    expect(Y_GIRO_FOTOGRAMA).toBe(BOCA[1]!.y)
  })

  it('giro: el borde inferior de la hoja queda en y=324 del fotograma mapeada a la ventana y el superior por encima del viewport', () => {
    for (const [esc, carta, alto] of [
      [ESCENARIO, CARTA, 1080],
      [cajaEscenario(1024, 768)!, { left: 132, top: 64, width: 760, height: 1200 }, 768],
      [cajaEscenario(412, 915)!, { left: 16, top: 48, width: 380, height: 867 }, 915],
    ] as const) {
      const plan = planPapel(esc, carta, alto)!
      const yGiro = esc.top + Y_GIRO_FOTOGRAMA * (esc.width / 1280)
      expect(carta.top + plan.arriba.y + plan.alturaHoja * plan.arriba.escala).toBeCloseTo(yGiro, 6)
      // el borde superior queda por encima del viewport (más que el margen mínimo, la hoja es FACTOR_LARGO_HOJA veces más larga)
      expect(carta.top + plan.arriba.y).toBeLessThanOrEqual(-MARGEN_ARRIBA_PX)
      const largoMinimo = (yGiro + MARGEN_ARRIBA_PX) / plan.arriba.escala
      expect(plan.alturaHoja).toBeCloseTo(largoMinimo * FACTOR_LARGO_HOJA, 6)
    }
  })

  it('1920x1080: el borde inferior en el giro es 486 (324 x 1,5)', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    expect(bordeInferior(plan.arriba, plan.alturaHoja)).toBeCloseTo(486, 6)
  })

  it('si la carta es más larga que la hoja del giro, la hoja crece hasta ella al bajar (no se recorta el destino)', () => {
    const plan = planPapel(ESCENARIO, { ...CARTA, height: 3000 }, 1080)!
    expect(plan.alturaHoja).toBeLessThan(3000)
    expect(CARTA.top + plan.arriba.y + plan.alturaHoja * plan.arriba.escala).toBeCloseTo(486, 6)
  })

  it('la hoja larga nunca deja ver su borde inferior al subir: escondida, su borde inferior queda por debajo de la ventana', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    expect(bordeInferior(plan.escondido, plan.alturaHoja)).toBeGreaterThan(1080)
  })

  it('la hoja es FACTOR_LARGO_HOJA (1,6) veces más larga y el recorrido de subida crece en esa proporción', () => {
    expect(FACTOR_LARGO_HOJA).toBe(1.6)
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    // 1920x1080: escala 1,5, borde inferior en 486, margen 40 -> hoja mínima (486+40)/escala
    expect(plan.alturaHoja).toBeCloseTo(((486 + MARGEN_ARRIBA_PX) / plan.arriba.escala) * 1.6, 6)
    const yBocaBaja = Math.max(...bocaEnVentana(ESCENARIO).map((p) => p.y))
    expect(plan.escondido.y - plan.arriba.y).toBeCloseTo(yBocaBaja - (486 - plan.alturaHoja * plan.arriba.escala), 6)
  })

  it('duraciones proporcionales a la distancia recorrida (misma velocidad), con mínimo por fase', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    const distSube = plan.escondido.y - plan.arriba.y
    expect(plan.duracionSubeMs).toBe(Math.max(DURACION_MINIMA_FASE_MS, Math.round((distSube / VELOCIDAD_PX_S) * 1000)))
    const arribaTop = CARTA.top + plan.arriba.y
    const distBaja = Math.max(Math.abs(CARTA.top - arribaTop), Math.abs(CARTA.top + CARTA.height - 486))
    expect(plan.duracionBajaMs).toBe(Math.max(DURACION_MINIMA_FASE_MS, Math.round((distBaja / VELOCIDAD_PX_S) * 1000)))
    expect(plan.duracionBajaMs).toBeLessThanOrEqual(plan.duracionSubeMs)
    expect(plan.duracionTotalMs).toBeLessThanOrEqual(2600)
    expect(plan.duracionTotalMs).toBe(plan.duracionSubeMs + plan.duracionBajaMs)
  })

  it('tope de duración total: una carta muy larga no pasa de DURACION_MAXIMA_TOTAL_MS y conserva la proporción subida/bajada', () => {
    expect(DURACION_MAXIMA_TOTAL_MS).toBe(2600)
    const plan = planPapel(cajaEscenario(1024, 768)!, { left: 132, top: 64, width: 760, height: 1200 }, 768)!
    expect(plan.duracionTotalMs).toBeLessThanOrEqual(2600)
    expect(plan.duracionTotalMs).toBe(plan.duracionSubeMs + plan.duracionBajaMs)
    expect(plan.duracionSubeMs / plan.duracionBajaMs).toBeCloseTo(1162 / 1531, 1)
  })

  it('la bajada tiene el mismo ritmo que la subida: velocidad media igual (distancia/duración) con ±1 ms de redondeo', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    const dSube = plan.escondido.y - plan.arriba.y
    const dBaja = Math.max(Math.abs(CARTA.top - (CARTA.top + plan.arriba.y)), Math.abs(CARTA.top + CARTA.height - 486))
    expect(dBaja / plan.duracionBajaMs).toBeCloseTo(dSube / plan.duracionSubeMs, 1)
  })

  it('una fase muy corta dura al menos DURACION_MINIMA_FASE_MS (400)', () => {
    const plan = planPapel(ESCENARIO, { ...CARTA, top: 400, height: 140 }, 1080)!
    expect(DURACION_MINIMA_FASE_MS).toBe(400)
    expect(plan.duracionBajaMs).toBeGreaterThanOrEqual(400)
  })

  it('misma familia de easing en subida y bajada (una sola curva simétrica)', () => {
    expect(EASE_FASE).toBe('cubic-bezier(0.45, 0.05, 0.55, 0.95)')
  })

  it('línea temporal única: el punto de giro es subida/total y el fundido del escenario va al final de la bajada; el fondo de escena no se funde (D36)', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    expect(plan.offsetArriba).toBeCloseTo(plan.duracionSubeMs / plan.duracionTotalMs, 10)
    expect(Object.keys(plan.fundido)).toEqual(['escenario'])
    const [desde, hasta] = plan.fundido.escenario
    expect(desde).toBeGreaterThanOrEqual(plan.offsetArriba)
    expect(hasta).toBeGreaterThan(desde)
    expect(hasta).toBeLessThanOrEqual(1)
  })

  it('los clip-path son los polígonos de la boca (N + 4 puntos), cerrado y abierto', () => {
    const plan = planPapel(ESCENARIO, CARTA, 1080)!
    const boca = bocaEnVentana(ESCENARIO)
    expect(plan.clipCerrado).toBe(poligonoBoca(boca, false, 1080))
    expect(plan.clipAbierto).toBe(poligonoBoca(boca, true, 1080))
    expect(plan.clipCerrado.split(',')).toHaveLength(boca.length + 4)
  })

  it('se adapta a una ventana vertical: escala menor que 1 y todo finito', () => {
    const esc = cajaEscenario(412, 915)!
    const plan = planPapel(esc, { left: 16, top: 48, width: 380, height: 867 }, 915)!
    expect(plan.escondido.escala).toBeGreaterThan(0)
    expect(plan.escondido.escala).toBeLessThan(1)
    for (const n of [plan.escondido.x, plan.escondido.y, plan.arriba.y, plan.alturaHoja, plan.duracionTotalMs]) expect(Number.isFinite(n)).toBe(true)
  })

  it('con medidas no válidas devuelve null', () => {
    expect(planPapel(ESCENARIO, { ...CARTA, width: 0 }, 1080)).toBeNull()
    expect(planPapel(ESCENARIO, CARTA, 0)).toBeNull()
  })
})

describe('transformCss', () => {
  it('escribe translate y scale uniforme', () => {
    expect(transformCss({ x: 10, y: -20.5, escala: 0.5 })).toBe('translate(10px, -20.5px) scale(0.5)')
  })
})
