/** Una sola línea temporal de WAAPI para la animación del papel: todas las animaciones duran lo mismo. */

const MARGEN_TOPE_MS = 1500

export interface Animacion {
  /** Resuelve `true` si todo llega al final y `false` si se cancela o vence el tope. */
  readonly terminada: Promise<boolean>
  /** Detiene las animaciones y deja las capas ocultas (sin parpadeo de la escena). */
  readonly cancelar: () => void
}

export function lineaTiempo(duracionMs: number, ocultar: () => void) {
  const animaciones: Animation[] = []
  let temporizador: ReturnType<typeof setTimeout> | undefined

  return {
    animar(el: Element, keyframes: Keyframe[]): void {
      animaciones.push(el.animate(keyframes, { duration: duracionMs, easing: 'linear', fill: 'both' }))
    },
    /** Llamar una vez, con todas las animaciones ya creadas. */
    esperar(): Animacion {
      const cancelar = () => {
        clearTimeout(temporizador)
        animaciones.forEach((a) => a.cancel())
        ocultar()
      }
      const terminada = (async () => {
        const tope = new Promise<void>((resolver) => {
          temporizador = setTimeout(resolver, duracionMs + MARGEN_TOPE_MS)
        })
        await Promise.race([Promise.allSettled(animaciones.map((a) => a.finished)), tope])
        clearTimeout(temporizador)
        return animaciones.every((a) => a.playState === 'finished')
      })()
      return { terminada, cancelar }
    },
  }
}
