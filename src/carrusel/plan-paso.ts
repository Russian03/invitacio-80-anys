/** Plan puro de las animaciones del carrusel: fotogramas y opciones para `animate`. Solo `transform` y `opacity`. */

import { EASE_ENTRADA, EASE_SALIDA } from '../movimiento'

export type Direccion = 'siguiente' | 'anterior'

/** Apartarse de la pila. */
export const DURACION_SALIDA_FOTO_MS = 500
/** Volver por detrás, hasta el fondo: es el tramo más lento. */
export const DURACION_VUELTA_FOTO_MS = 700
/** Cuánto se aparta la foto, en % de su ancho. */
export const DESPLAZAMIENTO_SALIDA_PCT = 110
/** Giro que gana la foto al apartarse. */
export const GIRO_SALIDA_GRADOS = 8
export const DURACION_FUNDIDO_FOTO_MS = 150

export interface Tramo {
  readonly keyframes: Keyframe[]
  readonly opciones: KeyframeAnimationOptions
}

const finito = (n: number) => (Number.isFinite(n) ? n : 0)
const postura = (x: string, giro: number) => ({ transform: `translateX(${x}) rotate(${giro}deg)` })

/**
 * Un paso: la foto se aparta hacia la izquierda si es `siguiente` y hacia la derecha si es `anterior`, cambia de capa y
 * vuelve a su inclinación.
 */
export function planPaso(direccion: Direccion, giroGrados: number): { salida: Tramo; vuelta: Tramo } {
  const giro = finito(giroGrados)
  const sentido = direccion === 'siguiente' ? -1 : 1
  const fuera = postura(`${sentido * DESPLAZAMIENTO_SALIDA_PCT}%`, giro + sentido * GIRO_SALIDA_GRADOS)
  return {
    salida: {
      keyframes: [postura('0px', giro), fuera],
      opciones: { duration: DURACION_SALIDA_FOTO_MS, easing: EASE_ENTRADA },
    },
    vuelta: {
      keyframes: [fuera, postura('0px', giro)],
      opciones: { duration: DURACION_VUELTA_FOTO_MS, easing: EASE_SALIDA },
    },
  }
}

/** Cambio con movimiento reducido: la nueva foto de arriba aparece. */
export function planFundido(): Tramo {
  return {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    opciones: { duration: DURACION_FUNDIDO_FOTO_MS, easing: 'linear' },
  }
}
