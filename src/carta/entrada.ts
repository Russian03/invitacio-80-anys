import { EASE_SALIDA } from '../movimiento'
import { DESPLAZAMIENTO_ENTRADA_PX, planEntrada } from './plan-entrada'

/**
 * Entrada escalonada de lo inicial: cada elemento sube `DESPLAZAMIENTO_ENTRADA_PX` y aparece. `fill: 'backwards'`
 * los mantiene ocultos durante su retraso, sin parpadeo. Si `animate` no existe, no hace nada y el contenido se ve.
 */
export function animarEntrada(elementos: readonly HTMLElement[]): Animation[] {
  const plan = planEntrada(elementos.length)
  return elementos.flatMap((elemento, i) => {
    const paso = plan[i]
    if (!paso || typeof elemento.animate !== 'function') return []
    return [
      elemento.animate(
        [
          { opacity: 0, transform: `translateY(${DESPLAZAMIENTO_ENTRADA_PX}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: paso.duracionMs, delay: paso.retrasoMs, easing: EASE_SALIDA, fill: 'backwards' },
      ),
    ]
  })
}
