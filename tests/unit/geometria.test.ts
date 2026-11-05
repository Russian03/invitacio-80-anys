import { describe, expect, it } from 'vitest'
import {
  BOCA,
  CAJA_SOBRE,
  FOTOGRAMA,
  bocaEnVentana,
  cajaEscenario,
  cajaPapelEnSobre,
  cajaSobreEnVentana,
  poligonoBoca,
  transformDesde,
} from '../../src/carta/geometria'

describe('constantes del fotograma', () => {
  it('el fotograma es 1280x720 y el sobre cabe dentro', () => {
    expect(FOTOGRAMA).toEqual({ ancho: 1280, alto: 720 })
    expect(CAJA_SOBRE.x0).toBeGreaterThan(0)
    expect(CAJA_SOBRE.x1).toBeLessThan(FOTOGRAMA.ancho)
    expect(CAJA_SOBRE.y0).toBeGreaterThan(0)
    expect(CAJA_SOBRE.y1).toBeLessThan(FOTOGRAMA.alto)
  })

  it('la boca es la línea medida: 7 puntos ordenados por x, dentro del sobre, con la parte baja en el centro', () => {
    expect(BOCA).toHaveLength(7)
    expect(BOCA[0]).toEqual({ x: 350, y: 308 })
    expect(BOCA[6]).toEqual({ x: 918, y: 308 })
    for (let i = 1; i < BOCA.length; i++) expect(BOCA[i]!.x).toBeGreaterThan(BOCA[i - 1]!.x)
    for (const p of BOCA) {
      expect(p.x).toBeGreaterThanOrEqual(CAJA_SOBRE.x0)
      expect(p.x).toBeLessThanOrEqual(CAJA_SOBRE.x1)
    }
    expect(Math.max(...BOCA.map((p) => p.y))).toBe(399)
    expect(Math.min(...BOCA.map((p) => p.y))).toBe(308)
  })
})

describe('cajaEscenario', () => {
  it('con una ventana 16:9 el escenario es la ventana (cover exacto)', () => {
    const caja = cajaEscenario(1920, 1080)!
    expect(caja.width).toBeCloseTo(1920, 0)
    expect(caja.height).toBeCloseTo(1080, 0)
  })

  it('es siempre 16:9', () => {
    for (const [w, h] of [[1280, 900], [1024, 768], [800, 360], [412, 915], [2560, 1080]] as const) {
      const caja = cajaEscenario(w, h)!
      expect(caja.width / caja.height).toBeCloseTo(16 / 9, 5)
    }
  })

  it('cubre la ventana (cover) cuando el sobre cabe con aire', () => {
    for (const [w, h] of [[1920, 1080], [1280, 900], [1024, 768]] as const) {
      const caja = cajaEscenario(w, h)!
      expect(caja.left).toBeLessThanOrEqual(0.5)
      expect(caja.top).toBeLessThanOrEqual(0.5)
      expect(caja.left + caja.width).toBeGreaterThanOrEqual(w - 0.5)
      expect(caja.top + caja.height).toBeGreaterThanOrEqual(h - 0.5)
    }
  })

  it('en una ventana ultrapanorámica (2560x1080) el escenario no llega a los lados y el sobre queda centrado', () => {
    const caja = cajaEscenario(2560, 1080)!
    expect(caja.width).toBeLessThan(2560)
    const sobre = cajaSobreEnVentana(caja)
    expect(sobre.left + sobre.width / 2).toBeCloseTo(1280, 0)
    expect(sobre.top + sobre.height / 2).toBeCloseTo(540, 0)
  })

  it.each([
    [412, 915, 850],
    [800, 360, 800],
  ])('en %sx%s el escenario mide %s de ancho (sobre al 92 % como mucho)', (w, h, ancho) => {
    expect(cajaEscenario(w, h)!.width).toBeCloseTo(ancho, -1)
  })

  it.each([
    [1920, 1080],
    [1280, 900],
    [1024, 768],
    [800, 360],
    [412, 915],
    [360, 640],
    [2560, 1080],
    [1920, 420],
  ])('en %sx%s el sobre entero cae dentro de la ventana', (w, h) => {
    const sobre = cajaSobreEnVentana(cajaEscenario(w, h)!)
    expect(sobre.left).toBeGreaterThanOrEqual(0)
    expect(sobre.top).toBeGreaterThanOrEqual(0)
    expect(sobre.left + sobre.width).toBeLessThanOrEqual(w)
    expect(sobre.top + sobre.height).toBeLessThanOrEqual(h)
  })

  it('el sobre queda centrado en la ventana', () => {
    const sobre = cajaSobreEnVentana(cajaEscenario(412, 915)!)
    expect(sobre.left + sobre.width / 2).toBeCloseTo(206, 0)
    expect(sobre.top + sobre.height / 2).toBeCloseTo(457.5, 0)
  })

  it.each([
    [0, 1080],
    [1920, 0],
    [-1, 100],
    [NaN, 100],
    [100, Infinity],
  ])('con ventana %s x %s devuelve null', (w, h) => {
    expect(cajaEscenario(w, h)).toBeNull()
  })
})

describe('cajaSobreEnVentana', () => {
  it('con el fotograma a su tamaño y en el origen es la caja del sobre', () => {
    const caja = cajaSobreEnVentana({ left: 0, top: 0, width: 1280, height: 720 })
    expect(caja).toEqual({
      left: CAJA_SOBRE.x0,
      top: CAJA_SOBRE.y0,
      width: CAJA_SOBRE.x1 - CAJA_SOBRE.x0,
      height: CAJA_SOBRE.y1 - CAJA_SOBRE.y0,
    })
  })
})

describe('bocaEnVentana', () => {
  it('con el escenario a escala 1 y en el origen devuelve los puntos del fotograma', () => {
    expect(bocaEnVentana({ left: 0, top: 0, width: 1280, height: 720 })).toEqual(BOCA)
  })

  it('escala x2 y desplaza', () => {
    const boca = bocaEnVentana({ left: 10, top: 20, width: 2560, height: 1440 })
    expect(boca).toEqual(BOCA.map((p) => ({ x: 10 + p.x * 2, y: 20 + p.y * 2 })))
  })
})

describe('cajaPapelEnSobre', () => {
  it('queda dentro de la boca, con margen a los lados y bajo la V', () => {
    const escenario = { left: 0, top: 0, width: 1280, height: 720 }
    const papel = cajaPapelEnSobre(escenario)
    expect(papel.left).toBeGreaterThan(BOCA[0]!.x)
    expect(papel.left + papel.width).toBeLessThan(BOCA[BOCA.length - 1]!.x)
    expect(papel.top).toBe(Math.min(...BOCA.map((p) => p.y)))
  })

  it('escala con el escenario', () => {
    const uno = cajaPapelEnSobre({ left: 0, top: 0, width: 1280, height: 720 })
    const dos = cajaPapelEnSobre({ left: 0, top: 0, width: 2560, height: 1440 })
    expect(dos.width).toBeCloseTo(uno.width * 2, 5)
  })
})

describe('transformDesde', () => {
  it('con cajas iguales no mueve ni escala', () => {
    const caja = { left: 50, top: 60, width: 400, height: 900 }
    expect(transformDesde(caja, caja)).toEqual({ x: 0, y: 0, escala: 1 })
  })

  it('escala uniforme por el ancho y traslada la esquina superior izquierda', () => {
    const final = { left: 100, top: 50, width: 800, height: 1000 }
    const inicial = { left: 300, top: 400, width: 400 }
    expect(transformDesde(final, inicial)).toEqual({ x: 200, y: 350, escala: 0.5 })
  })

  it.each([0, NaN, -5, Infinity])('con ancho final %s devuelve null', (ancho) => {
    expect(
      transformDesde({ left: 0, top: 0, width: ancho, height: 10 }, { left: 0, top: 0, width: 5 }),
    ).toBeNull()
  })

  it.each([0, NaN, -5])('con ancho inicial %s devuelve null', (ancho) => {
    expect(
      transformDesde({ left: 0, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: ancho }),
    ).toBeNull()
  })
})

describe('poligonoBoca', () => {
  const cuenta = (css: string) => css.slice(css.indexOf('(') + 1, -1).split(',').length
  const BOCA_PRUEBA = [
    { x: 10, y: 20 },
    { x: 30, y: 50 },
    { x: 70, y: 40 },
    { x: 90, y: 25 },
  ]

  it('cerrado y abierto tienen N + 4 puntos (interpolables)', () => {
    expect(cuenta(poligonoBoca(BOCA, false, 900))).toBe(BOCA.length + 4)
    expect(cuenta(poligonoBoca(BOCA, true, 900))).toBe(BOCA.length + 4)
  })

  it('cerrado sigue la línea de izquierda a derecha, de derecha a izquierda, con los lados a la altura de los extremos', () => {
    expect(poligonoBoca(BOCA_PRUEBA, false, 100)).toBe(
      'polygon(0px 0px, 100% 0px, 100% 25px, 90px 25px, 70px 40px, 30px 50px, 10px 20px, 0px 20px)',
    )
  })

  it('abierto lleva todos los puntos al alto de la ventana', () => {
    expect(poligonoBoca(BOCA_PRUEBA, true, 100)).toBe(
      'polygon(0px 0px, 100% 0px, 100% 100px, 90px 100px, 70px 100px, 30px 100px, 10px 100px, 0px 100px)',
    )
  })
})
