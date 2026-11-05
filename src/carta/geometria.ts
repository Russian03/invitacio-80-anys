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

export const FOTOGRAMA = { ancho: 1280, alto: 720 } as const

/** Caja del sobre abierto dentro del fotograma. */
export const CAJA_SOBRE = { x0: 348, y0: 56, x1: 919, y1: 579 } as const

/** Boca del sobre: borde superior de la parte delantera, medido en el fotograma, ordenado por x. */
export const BOCA: readonly Punto[] = [
  { x: 350, y: 308 },
  { x: 429, y: 324 },
  { x: 531, y: 399 },
  { x: 737, y: 399 },
  { x: 802, y: 348 },
  { x: 842, y: 322 },
  { x: 918, y: 308 },
]

/** Y del punto más alto (menor y) de una línea de boca. */
export const yMasAlta = (boca: readonly Punto[]) => Math.min(...boca.map((p) => p.y))

/** Y del punto más bajo (mayor y) de una línea de boca. */
export const yMasBaja = (boca: readonly Punto[]) => Math.max(...boca.map((p) => p.y))

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

/** Y de ventana de una y del fotograma (misma escala que `bocaEnVentana`). */
export function yEnVentana(escenario: Caja, yFotograma: number): number {
  return escenario.top + yFotograma * (escenario.width / FOTOGRAMA.ancho)
}

/** Boca del sobre en píxeles de ventana. */
export function bocaEnVentana(escenario: Caja): Punto[] {
  return BOCA.map((p) => aVentana(escenario, p))
}

/** Caja inicial del papel metido en el sobre: ancho de la boca menos los lados, borde superior a la altura del punto más alto de la boca. */
export function cajaPapelEnSobre(escenario: Caja): Pick<Caja, 'left' | 'top' | 'width'> {
  const escala = escenario.width / FOTOGRAMA.ancho
  return {
    left: escenario.left + PAPEL_EN_SOBRE.x0 * escala,
    top: escenario.top + yMasAlta(BOCA) * escala,
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
 * `clip-path` que deja ver lo que está por encima de la línea de la boca (`abierta = false`) o todo (`true`,
 * todos los puntos de la línea al alto de la ventana). Siempre N + 4 puntos para poder interpolar entre los dos.
 * Recorrido: 0,0 → 100%,0 → 100%,y del último → puntos de derecha a izquierda → 0,y del primero.
 */
export function poligonoBoca(boca: readonly Punto[], abierta: boolean, altoVentana: number): string {
  const alto = (p: Punto) => (abierta ? altoVentana : p.y)
  const primero = boca[0]
  const ultimo = boca[boca.length - 1]
  if (!primero || !ultimo) return 'polygon(0px 0px, 100% 0px, 100% 0px)'
  const puntos = [
    '0px 0px',
    '100% 0px',
    `100% ${alto(ultimo)}px`,
    ...[...boca].reverse().map((p) => `${p.x}px ${alto(p)}px`),
    `0px ${alto(primero)}px`,
  ]
  return `polygon(${puntos.join(', ')})`
}
