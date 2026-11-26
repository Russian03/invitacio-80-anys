/** Único sitio donde se elige el vídeo; aquí irá la elección por orientación. */
export const VIDEO_APERTURA = `${import.meta.env.BASE_URL}video/sobre.mp4`

/** Imagen fija del sobre abierto y vacío (último fotograma): sustituye al vídeo al quedar quieto el sobre. */
export const IMAGEN_SOBRE = `${import.meta.env.BASE_URL}img/sobre-abierto.webp`

export const TOPE_ARRANQUE_VIDEO_MS = 4000
/** Espera máxima a que la imagen fija del sobre se descargue y decodifique. */
export const TOPE_IMAGEN_MS = 4000
export const MARGEN_FIN_VIDEO_MS = 2000
export const TOPE_FIN_VIDEO_MS = 15000

/**
 * Segundo del vídeo (3,04 s) en que el sobre ya está abierto y quieto (≈ fotograma 33, margen de 2 sobre el 32):
 * a partir de aquí se suelta el vídeo y se queda la imagen fija.
 */
export const SOBRE_QUIETO_S = 1.4

/** `true` si el tiempo actual del vídeo ha llegado al momento. Tiempos no finitos, `false`. */
export function momentoAlcanzado(actualS: number, momentoS: number): boolean {
  return Number.isFinite(actualS) && Number.isFinite(momentoS) && actualS >= momentoS
}

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

/**
 * `true` si el vídeo llega a `momentoS` (o termina con `ended`); `false` si hay `error` o vence el tope.
 * El momento se mira con `requestVideoFrameCallback` si existe y con `timeupdate` en cualquier caso.
 * Nunca rechaza; al resolver quita listeners, callback y temporizador.
 */
export function esperarMomentoVideo(video: HTMLVideoElement, momentoS: number, ms: number): Promise<boolean> {
  return new Promise((resolver) => {
    let idFotograma: number | undefined
    let terminado = false
    const comprobar = () => {
      if (momentoAlcanzado(video.currentTime, momentoS)) terminar(true)
    }
    const alFotograma = () => {
      comprobar()
      if (!terminado) idFotograma = video.requestVideoFrameCallback?.(alFotograma)
    }
    const alExito = () => terminar(true)
    const alFallo = () => terminar(false)
    const temporizador = setTimeout(alFallo, ms)
    const terminar = (resultado: boolean) => {
      if (terminado) return
      terminado = true
      clearTimeout(temporizador)
      video.removeEventListener('ended', alExito)
      video.removeEventListener('error', alFallo)
      video.removeEventListener('timeupdate', comprobar)
      if (idFotograma !== undefined) video.cancelVideoFrameCallback?.(idFotograma)
      resolver(resultado)
    }
    video.addEventListener('ended', alExito)
    video.addEventListener('error', alFallo)
    video.addEventListener('timeupdate', comprobar)
    idFotograma = video.requestVideoFrameCallback?.(alFotograma)
  })
}
