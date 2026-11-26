/** Plan puro del temblor con el que una casilla avisa de que falta algo. */

export const DESPLAZAMIENTO_TEMBLOR_PX = 8
export const DURACION_TEMBLOR_MS = 450

/** Fracciones del desplazamiento en cada vaivén: a un lado y a otro, cada vez menos. */
const VAIVENES = [-1, 0.9, -0.75, 0.55, -0.35, 0.15] as const

export function planTemblor(): { keyframes: Keyframe[]; opciones: KeyframeAnimationOptions } {
  const posiciones = [0, ...VAIVENES.map((v) => v * DESPLAZAMIENTO_TEMBLOR_PX), 0]
  return {
    keyframes: posiciones.map((x) => ({ transform: `translateX(${x}px)` })),
    opciones: { duration: DURACION_TEMBLOR_MS, easing: 'ease-in-out' },
  }
}
