import {
  BOCA,
  bocaEnVentana,
  cajaPapelEnSobre,
  poligonoBoca,
  yMasAlta,
  yMasBaja,
  yEnVentana,
  transformDesde,
  type Caja,
  type Transformacion,
} from './geometria'

/** Y del fotograma (segundo punto de la boca, 429,324) a la que llega el borde inferior de la hoja en el giro. */
export const Y_GIRO_FOTOGRAMA = BOCA[1]!.y
/** Cuánto sobrepasa por arriba la ventana el borde superior de la hoja en el giro. */
export const MARGEN_ARRIBA_PX = 40
/** Cuánto más larga que la mínima (borde superior `MARGEN_ARRIBA_PX` sobre la ventana) es la hoja decorativa: más recorrido de subida antes de ver su borde inferior. */
export const FACTOR_LARGO_HOJA = 1.6
/** Velocidad media del papel en píxeles por segundo: igual en la subida y en la bajada (duración proporcional a la distancia). */
export const VELOCIDAD_PX_S = 600
/** Tope de la duración total: si la distancia lo pasa, ambas fases se acortan en proporción. */
export const DURACION_MAXIMA_TOTAL_MS = 2600
/** Duración mínima de cada fase, para que un recorrido corto no sea un tirón. */
export const DURACION_MINIMA_FASE_MS = 400

/**
 * Easing de ambas fases: una sola curva ease-in-out simétrica. En el giro hay que parar (el papel invierte la
 * dirección), así que la velocidad llega a 0 arriba; con la misma curva y la velocidad media igual a ambos lados,
 * el ritmo es el mismo en la subida y en la bajada, sin frenazo largo ni arranque lento.
 */
export const EASE_FASE = 'cubic-bezier(0.45, 0.05, 0.55, 0.95)'

/** Cuánto antes del final empieza a fundirse el escenario (sobre): el fondo de escena es permanente (D36) y no se funde. */
export const FUNDIDO_ESCENARIO_MS = 450
const FIN_FUNDIDO_ESCENARIO_MS = 120

type Tramo = readonly [desde: number, hasta: number]

export interface PlanPapel {
  /** Papel metido en el bolsillo, con el borde en el punto más bajo de la boca (no se ve). */
  readonly escondido: Transformacion
  /** Papel arriba del todo: el borde inferior de la hoja queda en `Y_GIRO_FOTOGRAMA` (mapeada a la ventana). */
  readonly arriba: Transformacion
  /** Alto (px, sin escalar) de la hoja decorativa en el giro: lo justo para que su borde superior quede `MARGEN_ARRIBA_PX` por encima de la ventana; mide el de la carta al terminar de bajar. */
  readonly alturaHoja: number
  /** `clip-path` de la boca: solo se ve lo que está sobre la línea de la boca. */
  readonly clipCerrado: string
  /** `clip-path` con la ventana entera visible (mismo nº de puntos para interpolar). */
  readonly clipAbierto: string
  readonly duracionSubeMs: number
  readonly duracionBajaMs: number
  readonly duracionTotalMs: number
  /** Offset (0-1) de la línea temporal en que el papel está arriba del todo: aquí gira y pasa al frente. */
  readonly offsetArriba: number
  /** Tramo (offsets de la línea temporal) en que se funde el escenario (sobre), al final. */
  readonly fundido: { readonly escenario: Tramo }
}

const duracionPara = (distanciaPx: number) =>
  Math.max(DURACION_MINIMA_FASE_MS, Math.round((distanciaPx / VELOCIDAD_PX_S) * 1000))

/**
 * Calcula, en píxeles de ventana, cómo sale el papel decorativo del sobre. `cajaCarta` es la caja final del papel
 * (la de `#carta`). Arriba del todo el borde inferior de la hoja queda en la y 324 del fotograma (mapeada) y el
 * superior por encima de la ventana; desde ahí baja, con ease-out, y cambia de alto hasta la caja de `#carta`. Medidas no válidas: `null`.
 */
export function planPapel(escenario: Caja, cajaCarta: Caja, altoVentana: number): PlanPapel | null {
  if (!(altoVentana > 0) || !(cajaCarta.height > 0)) return null
  const base = transformDesde(cajaCarta, cajaPapelEnSobre(escenario))
  if (!base) return null
  const boca = bocaEnVentana(escenario)
  const yEscondido = base.y + (yMasBaja(boca) - yMasAlta(boca))
  const bordeInferiorArriba = yEnVentana(escenario, Y_GIRO_FOTOGRAMA)
  const alturaHoja = ((bordeInferiorArriba + MARGEN_ARRIBA_PX) / base.escala) * FACTOR_LARGO_HOJA
  const bordeSuperiorArriba = bordeInferiorArriba - alturaHoja * base.escala
  const yArriba = bordeSuperiorArriba - cajaCarta.top
  // Bajada: lo que se mueve el borde superior (hasta su sitio) o el inferior (hasta el final de la carta), el mayor
  const distanciaBaja = Math.max(
    Math.abs(cajaCarta.top - bordeSuperiorArriba),
    Math.abs(cajaCarta.top + cajaCarta.height - bordeInferiorArriba),
  )
  const sinTope = duracionPara(yEscondido - yArriba) + duracionPara(distanciaBaja)
  const ajuste = Math.min(1, DURACION_MAXIMA_TOTAL_MS / sinTope)
  const duracionSubeMs = Math.floor(duracionPara(yEscondido - yArriba) * ajuste)
  const duracionBajaMs = Math.floor(duracionPara(distanciaBaja) * ajuste)
  const duracionTotalMs = duracionSubeMs + duracionBajaMs
  return {
    escondido: { ...base, y: yEscondido },
    arriba: { ...base, y: yArriba },
    alturaHoja,
    clipCerrado: poligonoBoca(boca, false, altoVentana),
    clipAbierto: poligonoBoca(boca, true, altoVentana),
    duracionSubeMs,
    duracionBajaMs,
    duracionTotalMs,
    offsetArriba: duracionSubeMs / duracionTotalMs,
    fundido: {
      escenario: [1 - Math.min(FUNDIDO_ESCENARIO_MS, duracionBajaMs) / duracionTotalMs, 1 - FIN_FUNDIDO_ESCENARIO_MS / duracionTotalMs],
    },
  }
}

/** Transformación como texto CSS (origen arriba a la izquierda, escala uniforme). */
export function transformCss(t: Transformacion): string {
  return `translate(${t.x}px, ${t.y}px) scale(${t.escala})`
}
