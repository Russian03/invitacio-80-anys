import { describe, expect, it } from 'vitest'
import {
  DESPLAZAMIENTO_ENTRADA_PX,
  DURACION_ENTRADA_MS,
  DURACION_MAXIMA_ENTRADA_MS,
  PASO_ENTRADA_MS,
  RETRASO_INICIAL_ENTRADA_MS,
  planEntrada,
} from '../../src/carta/plan-entrada'

describe('planEntrada', () => {
  it('con 5 elementos los retrasos son 200, 320, 440, 560 y 680 y cada uno dura 500 ms', () => {
    const plan = planEntrada(5)
    expect(plan.map((p) => p.retrasoMs)).toEqual([200, 320, 440, 560, 680])
    expect(plan.every((p) => p.duracionMs === 500)).toBe(true)
  })

  it('con 1 elemento hay un solo paso con el retraso inicial', () => {
    expect(planEntrada(1)).toEqual([{ retrasoMs: RETRASO_INICIAL_ENTRADA_MS, duracionMs: DURACION_ENTRADA_MS }])
  })

  it.each([0, -1, Number.NaN, 2.5, Infinity])('con %s devuelve una lista vacía', (cantidad) => {
    expect(planEntrada(cantidad)).toEqual([])
  })

  it('con 20 elementos el total no pasa de 1400 ms y los retrasos crecen sin ser negativos', () => {
    const plan = planEntrada(20)
    expect(plan).toHaveLength(20)
    const ultimo = plan[plan.length - 1]!
    expect(ultimo.retrasoMs + ultimo.duracionMs).toBeLessThanOrEqual(DURACION_MAXIMA_ENTRADA_MS)
    plan.forEach((p, i) => {
      expect(p.retrasoMs).toBeGreaterThanOrEqual(0)
      if (i > 0) expect(p.retrasoMs).toBeGreaterThan(plan[i - 1]!.retrasoMs)
    })
  })

  it('con pocos elementos usa el paso sin comprimir', () => {
    const plan = planEntrada(2)
    expect(plan[1]!.retrasoMs - plan[0]!.retrasoMs).toBe(PASO_ENTRADA_MS)
  })

  it('el desplazamiento es de 12 px', () => {
    expect(DESPLAZAMIENTO_ENTRADA_PX).toBe(12)
  })
})
