import {
  bocaEnVentana,
  cajaPapelEnSobre,
  poligonoBoca,
  yMasAlta,
  yMasBaja,
  type Caja,
  type Transformacion,
} from './geometria'
import { VELOCIDAD_PX_S } from './plan-papel'

/** En móvil en vertical la carta sale plegada en tríptico; en el resto, como siempre. */
export const CONSULTA_TRIPTICO = '(max-width: 599px) and (orientation: portrait)'

/** Tamaño máximo del tríptico abierto respecto a la carta final, para que el zoom se note. */
export const ESCALA_ABIERTO = 0.8
/** Parte de la ventana (ancho y alto) que puede ocupar como mucho el tríptico abierto. */
const OCUPACION_MAXIMA = 0.86
/** Aire entre el borde inferior del paquete y el punto más alto de la boca antes de pasar delante. */
const MARGEN_FUERA_PX = 8

export const DURACION_MINIMA_SUBIDA_MS = 400
export const DURACION_MAXIMA_SUBIDA_MS = 700
export const DURACION_CENTRAR_MS = 500
export const DURACION_SOLAPA_MS = 600
/** La solapa de abajo empieza este tiempo después de la de arriba. */
export const RETRASO_SOLAPA_ABAJO_MS = 400
/** Pausa con la carta abierta antes del zoom. */
export const PAUSA_ABIERTO_MS = 120
export const DURACION_ZOOM_MS = 650

type Tramo = readonly [desde: number, hasta: number]
type Ventana = Pick<Caja, 'width' | 'height'>

export interface PlanTriptico {
  /** Alto de cada panel, en px de la carta final (sin escalar). */
  readonly altoPanel: number
  /** Paquete plegado metido en el sobre, bajo la boca (no se ve). */
  readonly escondido: Transformacion
  /** Paquete entero por encima de la boca: aquí pasa delante del sobre. */
  readonly fuera: Transformacion
  /** Tríptico (abierto) centrado y entero dentro de la ventana; el paquete plegado queda en su panel central. */
  readonly centrado: Transformacion
  readonly clipCerrado: string
  readonly clipAbierto: string
  readonly duracionTotalMs: number
  /** Offsets (0-1) de la línea temporal. */
  readonly momentos: {
    readonly fuera: number
    readonly centrado: number
    readonly arriba: Tramo
    readonly abajo: Tramo
    /** Empieza el zoom: hasta aquí se ve el tríptico y desde aquí la hoja única. */
    readonly zoom: number
  }
  readonly fundidoEscenario: Tramo
}

const esPositivo = (n: number) => Number.isFinite(n) && n > 0

/**
 * Calcula, en píxeles de ventana, cómo sale la carta plegada del sobre, se despliega y crece hasta `cajaCarta`
 * (la caja final de `#carta`). Las transformaciones son del tríptico entero, con origen arriba a la izquierda
 * y colocado en `cajaCarta`. Medidas no válidas: `null`.
 */
export function planTriptico(escenario: Caja, cajaCarta: Caja, ventana: Ventana): PlanTriptico | null {
  if (![escenario.width, cajaCarta.width, cajaCarta.height, ventana.width, ventana.height].every(esPositivo)) return null
  const altoPanel = cajaCarta.height / 3
  const sobre = cajaPapelEnSobre(escenario)
  const boca = bocaEnVentana(escenario)

  const escalaSobre = sobre.width / cajaCarta.width
  /** Transformación que deja el panel central (el paquete) con su borde superior en `y`. */
  const enSobre = (y: number): Transformacion => ({
    x: sobre.left - cajaCarta.left,
    y: y - cajaCarta.top - altoPanel * escalaSobre,
    escala: escalaSobre,
  })
  const escondido = enSobre(yMasBaja(boca))
  const fuera = enSobre(yMasAlta(boca) - MARGEN_FUERA_PX - altoPanel * escalaSobre)

  const escala = Math.min(
    ESCALA_ABIERTO,
    (OCUPACION_MAXIMA * ventana.height) / cajaCarta.height,
    (OCUPACION_MAXIMA * ventana.width) / cajaCarta.width,
  )
  const centrado: Transformacion = {
    x: (ventana.width - cajaCarta.width * escala) / 2 - cajaCarta.left,
    y: (ventana.height - cajaCarta.height * escala) / 2 - cajaCarta.top,
    escala,
  }

  const subidaMs = Math.round(
    Math.min(
      DURACION_MAXIMA_SUBIDA_MS,
      Math.max(DURACION_MINIMA_SUBIDA_MS, ((escondido.y - fuera.y) / VELOCIDAD_PX_S) * 1000),
    ),
  )
  const finCentrar = subidaMs + DURACION_CENTRAR_MS
  const inicioAbajo = finCentrar + RETRASO_SOLAPA_ABAJO_MS
  const inicioZoom = inicioAbajo + DURACION_SOLAPA_MS + PAUSA_ABIERTO_MS
  const duracionTotalMs = inicioZoom + DURACION_ZOOM_MS
  const en = (ms: number) => ms / duracionTotalMs

  return {
    altoPanel,
    escondido,
    fuera,
    centrado,
    clipCerrado: poligonoBoca(boca, false, ventana.height),
    clipAbierto: poligonoBoca(boca, true, ventana.height),
    duracionTotalMs,
    momentos: {
      fuera: en(subidaMs),
      centrado: en(finCentrar),
      arriba: [en(finCentrar), en(finCentrar + DURACION_SOLAPA_MS)],
      abajo: [en(inicioAbajo), en(inicioAbajo + DURACION_SOLAPA_MS)],
      zoom: en(inicioZoom),
    },
    fundidoEscenario: [en(subidaMs), en(finCentrar)],
  }
}
