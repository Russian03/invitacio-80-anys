/** Único sitio donde se elige el vídeo; aquí irá la elección por orientación. */
export const VIDEO_APERTURA = '/video/video_carta.mp4'

export const TOPE_ARRANQUE_VIDEO_MS = 4000
export const MARGEN_FIN_VIDEO_MS = 2000
export const TOPE_FIN_VIDEO_MS = 15000

/**
 * `true` si llega `exito`; `false` si llega alguno de `fallos` o vence el tope.
 * Nunca rechaza; al resolver quita los listeners y el temporizador.
 */
export function esperarEvento(
  objetivo: EventTarget,
  exito: string,
  fallos: readonly string[],
  ms: number,
): Promise<boolean> {
  return new Promise((resolver) => {
    const alExito = () => terminar(true)
    const alFallo = () => terminar(false)
    const temporizador = setTimeout(alFallo, ms)
    const terminar = (resultado: boolean) => {
      clearTimeout(temporizador)
      objetivo.removeEventListener(exito, alExito)
      for (const fallo of fallos) objetivo.removeEventListener(fallo, alFallo)
      resolver(resultado)
    }
    objetivo.addEventListener(exito, alExito)
    for (const fallo of fallos) objetivo.addEventListener(fallo, alFallo)
  })
}

/** Tiempo máximo hasta `ended`: la duración más un margen, o un tope fijo si no se conoce. */
export function topeFin(duracionS: number): number {
  return Number.isFinite(duracionS) && duracionS > 0 ? duracionS * 1000 + MARGEN_FIN_VIDEO_MS : TOPE_FIN_VIDEO_MS
}
