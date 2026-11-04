/**
 * Geometría pura del escenario del sobre. Las medidas del vídeo `sobre.mp4` (fotograma 1280×720)
 * se expresan en unidades del fotograma y se pasan a píxeles de ventana con la caja del escenario.
 * Los tokens `--sobre-*` de `base.css` repiten estas fracciones (lo comprueba un test e2e).
 */

export interface Punto {
  readonly x: number
  readonly y: number
}

export interface Caja {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface Transformacion {
  readonly x: number
  readonly y: number
  readonly escala: number
}

export interface PuntosBoca {
  readonly izquierda: Punto
  readonly derecha: Punto
  readonly vertice: Punto
}

export const FOTOGRAMA = { ancho: 1280, alto: 720 } as const

/** Caja del sobre abierto dentro del fotograma. */
export const CAJA_SOBRE = { x0: 348, y0: 56, x1: 919, y1: 579 } as const

/** Boca del sobre: dos esquinas y el vértice de la V. */
export const BOCA: PuntosBoca = {
  izquierda: { x: 350, y: 308 },
  derecha: { x: 918, y: 308 },
  vertice: { x: 640, y: 400 },
}

/** Tramo horizontal del papel dentro del sobre: la boca menos ≈30 px por lado. */
export const PAPEL_EN_SOBRE = { x0: 380, x1: 888 } as const

/** Centro del sobre en el fotograma (fracciones): (348+919)/2/1280 y (56+579)/2/720, redondeadas. */
export const CENTRO_SOBRE = { x: 0.495, y: 0.441 } as const

/**
 * Límites del escenario para que el sobre mida como mucho el 92 % del ancho (0,92 / 0,446) o del alto
 * (0,92 / (0,726 × 9/16)) de la ventana, en `vw` y `dvh`.
 */
export const LIMITE_ANCHO_VW = 206.3
export const LIMITE_ALTO_DVH = 225.3

const PROPORCION = FOTOGRAMA.ancho / FOTOGRAMA.alto

const esPositivo = (n: number) => Number.isFinite(n) && n > 0

/**
 * Caja del escenario 16:9 para una ventana: cubre la ventana (cover) mientras el sobre quepa con aire; si no,
 * se limita para que el sobre mida como mucho el 92 % del ancho o del alto. Centrado sobre el sobre.
 * Misma fórmula que `apertura.css`. Con ventana 16:9 coincide con la ventana. Medidas no válidas: `null`.
 */
export function cajaEscenario(anchoVentana: number, altoVentana: number): Caja | null {
  if (!esPositivo(anchoVentana) || !esPositivo(altoVentana)) return null
  const width = Math.min(
    Math.max(anchoVentana, altoVentana * PROPORCION),
    (LIMITE_ANCHO_VW / 100) * anchoVentana,
    (LIMITE_ALTO_DVH / 100) * altoVentana,
  )
  const height = width / PROPORCION
  return {
    left: anchoVentana / 2 - 0.5 * width + desplazamiento((0.5 - CENTRO_SOBRE.x) * width, width, anchoVentana),
    top: altoVentana / 2 - 0.5 * height + desplazamiento((0.5 - CENTRO_SOBRE.y) * height, height, altoVentana),
    width,
    height,
  }
}

/**
 * Cuánto se desplaza la caja (centrada en la ventana) para centrar el sobre. Si la caja cubre la ventana en ese eje
 * solo puede moverse lo que le sobra (para no dejar huecos); si es menor, se mueve lo que haga falta.
 */
function desplazamiento(deseado: number, caja: number, ventana: number): number {
  const holgura = caja >= ventana ? (caja - ventana) / 2 : Infinity
  return Math.max(-holgura, Math.min(holgura, deseado))
}

/** Pasa un punto, en unidades del fotograma, a píxeles de ventana. */
function aVentana(escenario: Caja, punto: Punto): Punto {
  const escala = escenario.width / FOTOGRAMA.ancho
  return { x: escenario.left + punto.x * escala, y: escenario.top + punto.y * escala }
}

/** Caja del sobre en píxeles de ventana. */
export function cajaSobreEnVentana(escenario: Caja): Caja {
  const escala = escenario.width / FOTOGRAMA.ancho
  return {
    left: escenario.left + CAJA_SOBRE.x0 * escala,
    top: escenario.top + CAJA_SOBRE.y0 * escala,
    width: (CAJA_SOBRE.x1 - CAJA_SOBRE.x0) * escala,
    height: (CAJA_SOBRE.y1 - CAJA_SOBRE.y0) * escala,
  }
}

/** Boca del sobre en píxeles de ventana. */
export function bocaEnVentana(escenario: Caja): PuntosBoca {
  return {
    izquierda: aVentana(escenario, BOCA.izquierda),
    derecha: aVentana(escenario, BOCA.derecha),
    vertice: aVentana(escenario, BOCA.vertice),
  }
}

/** Caja inicial del papel metido en el sobre: ancho de la boca menos los lados, borde superior a la altura de las esquinas. */
export function cajaPapelEnSobre(escenario: Caja): Pick<Caja, 'left' | 'top' | 'width'> {
  const escala = escenario.width / FOTOGRAMA.ancho
  return {
    left: escenario.left + PAPEL_EN_SOBRE.x0 * escala,
    top: escenario.top + BOCA.izquierda.y * escala,
    width: (PAPEL_EN_SOBRE.x1 - PAPEL_EN_SOBRE.x0) * escala,
  }
}

/**
 * Transformación (origen arriba a la izquierda, escala uniforme por el ancho) que lleva `cajaFinal`
 * a la posición y ancho de `cajaInicial`. Anchos no válidos: `null`.
 */
export function transformDesde(
  cajaFinal: Caja,
  cajaInicial: Pick<Caja, 'left' | 'top' | 'width'>,
): Transformacion | null {
  if (!esPositivo(cajaFinal.width) || !esPositivo(cajaInicial.width)) return null
  return {
    x: cajaInicial.left - cajaFinal.left,
    y: cajaInicial.top - cajaFinal.top,
    escala: cajaInicial.width / cajaFinal.width,
  }
}

/**
 * `clip-path` de 7 puntos que deja ver lo que está sobre la V de la boca (`abierta = false`) o todo (`true`,
 * V y laterales al alto de la ventana). Siempre 7 puntos para poder interpolar entre los dos.
 */
export function poligonoBoca(boca: PuntosBoca, abierta: boolean, altoVentana: number): string {
  const yLado = abierta ? altoVentana : boca.izquierda.y
  const yVertice = abierta ? altoVentana : boca.vertice.y
  const yEsquinaDer = abierta ? altoVentana : boca.derecha.y
  const puntos = [
    '0px 0px',
    '100% 0px',
    `100% ${yLado}px`,
    `${boca.derecha.x}px ${yEsquinaDer}px`,
    `${boca.vertice.x}px ${yVertice}px`,
    `${boca.izquierda.x}px ${abierta ? altoVentana : boca.izquierda.y}px`,
    `0px ${yLado}px`,
  ]
  return `polygon(${puntos.join(', ')})`
}
