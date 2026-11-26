/** Cuándo pasan las fotos solas. Puro: carrusel.ts reúne las condiciones y pone el temporizador. */

/** Pasa una foto cada este tiempo, contando lo que tarda en moverse. */
export const INTERVALO_FOTO_MS = 3000

/** Espera hasta el siguiente paso cuando el anterior ha durado `duracionPasoMs`; con un dato no válido, el intervalo entero. */
export function esperaTrasPaso(duracionPasoMs: number): number {
  if (!Number.isFinite(duracionPasoMs) || duracionPasoMs < 0) return INTERVALO_FOTO_MS
  return Math.max(0, INTERVALO_FOTO_MS - duracionPasoMs)
}

export interface Condiciones {
  /** La carta ha terminado de abrirse. */
  readonly abierta: boolean
  /** La mayor parte de la pila está en pantalla. */
  readonly aLaVista: boolean
  readonly pestanaVisible: boolean
  /** Un dedo o el botón del ratón mantiene pulsada la pila. */
  readonly sujeta: boolean
  /** El foco del teclado está en la pila. */
  readonly conTeclado: boolean
}

/**
 * Sin botones, quien quiera mirar una foto con calma la para sujetándola o con el foco del teclado. El ratón encima no
 * cuenta: al bajar con la rueda el cursor queda sobre las fotos y parecería que no avanzan.
 */
export function puedePasarSola(c: Condiciones): boolean {
  return c.abierta && c.aLaVista && c.pestanaVisible && !c.sujeta && !c.conTeclado
}
