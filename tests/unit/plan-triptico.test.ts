import { describe, expect, it } from 'vitest'
import { bocaEnVentana, cajaEscenario, cajaPapelEnSobre, yMasAlta, yMasBaja, type Caja, type Transformacion } from '../../src/carta/geometria'
import { planTriptico, type PlanTriptico } from '../../src/carta/plan-triptico'

const VENTANAS = [
  { ancho: 360, alto: 640 },
  { ancho: 390, alto: 844 },
  { ancho: 412, alto: 915 },
  { ancho: 599, alto: 700 },
]

/** Medidas como las de la página mientras se abre: carta con 16 px a cada lado, 48 px arriba y el alto de la ventana. */
function medidas({ ancho, alto }: { ancho: number; alto: number }) {
  const escenario = cajaEscenario(ancho, alto)!
  const carta: Caja = { left: 16, top: 48, width: ancho - 32, height: alto }
  return { escenario, carta, ventana: { width: ancho, height: alto } }
}

/** Caja en pantalla del panel central (el paquete plegado) con una transformación. */
function paquete(carta: Caja, plan: PlanTriptico, t: Transformacion): Caja {
  return {
    left: carta.left + t.x,
    top: carta.top + t.y + plan.altoPanel * t.escala,
    width: carta.width * t.escala,
    height: plan.altoPanel * t.escala,
  }
}

describe('planTriptico', () => {
  for (const ventana of VENTANAS) {
    const { escenario, carta, ventana: caja } = medidas(ventana)
    const plan = planTriptico(escenario, carta, caja)!
    const boca = bocaEnVentana(escenario)

    describe(`en ${ventana.ancho}x${ventana.alto}`, () => {
      it('cada panel mide un tercio de la carta', () => {
        expect(plan.altoPanel * 3).toBeCloseTo(carta.height)
      })

      it('empieza escondido bajo la boca y con el ancho del papel dentro del sobre', () => {
        const p = paquete(carta, plan, plan.escondido)
        expect(p.top).toBeCloseTo(yMasBaja(boca))
        expect(p.width).toBeCloseTo(cajaPapelEnSobre(escenario).width)
        expect(p.left).toBeCloseTo(cajaPapelEnSobre(escenario).left)
      })

      it('sale entero por encima de la boca sin salirse de la ventana', () => {
        const p = paquete(carta, plan, plan.fuera)
        expect(p.top + p.height).toBeLessThanOrEqual(yMasAlta(boca))
        expect(p.top).toBeGreaterThanOrEqual(0)
      })

      it('abierto cabe entero en la ventana y queda centrado', () => {
        const { x, y, escala } = plan.centrado
        const izquierda = carta.left + x
        const arriba = carta.top + y
        const ancho = carta.width * escala
        const alto = carta.height * escala
        expect(izquierda).toBeGreaterThan(0)
        expect(arriba).toBeGreaterThan(0)
        expect(izquierda).toBeCloseTo(ventana.ancho - izquierda - ancho)
        expect(arriba).toBeCloseTo(ventana.alto - arriba - alto)
        // Queda margen para que el zoom se note
        expect(escala).toBeLessThanOrEqual(0.8)
      })

      it('sale, se centra, abre arriba, abre abajo y hace zoom en ese orden', () => {
        const { fuera, centrado, arriba, abajo, zoom } = plan.momentos
        expect(fuera).toBeGreaterThan(0)
        expect(centrado).toBeGreaterThan(fuera)
        expect(arriba[0]).toBeGreaterThanOrEqual(centrado)
        expect(abajo[0]).toBeGreaterThan(arriba[0])
        expect(arriba[1]).toBeGreaterThan(arriba[0])
        expect(abajo[1]).toBeGreaterThan(abajo[0])
        expect(zoom).toBeGreaterThanOrEqual(abajo[1])
        expect(zoom).toBeLessThan(1)
      })

      it('toda la animación del papel dura como mucho 3,3 s', () => {
        expect(plan.duracionTotalMs).toBeGreaterThan(2000)
        expect(plan.duracionTotalMs).toBeLessThanOrEqual(3300)
      })

      it('el sobre se funde mientras la carta va al centro, antes de desplegarse', () => {
        expect(plan.fundidoEscenario).toEqual([plan.momentos.fuera, plan.momentos.centrado])
      })

      it('los recortes cerrado y abierto tienen el mismo número de puntos', () => {
        expect(plan.clipCerrado.split(',')).toHaveLength(plan.clipAbierto.split(',').length)
      })
    })
  }

  it('devuelve null sin medidas válidas', () => {
    const { escenario, carta, ventana } = medidas(VENTANAS[0]!)
    expect(planTriptico(escenario, { ...carta, height: 0 }, ventana)).toBeNull()
    expect(planTriptico(escenario, { ...carta, width: 0 }, ventana)).toBeNull()
    expect(planTriptico(escenario, carta, { width: 0, height: 640 })).toBeNull()
    expect(planTriptico(escenario, carta, { width: 360, height: Number.NaN })).toBeNull()
    expect(planTriptico({ ...escenario, width: 0 }, carta, ventana)).toBeNull()
  })
})
