/** Único sitio donde se elige el vídeo; aquí irá la elección por orientación. */
export const VIDEO_APERTURA = '/video/video_carta.mp4'

/**
 * Proporción mínima (ancho/alto) de ventana para reproducir el vídeo 16:9 (D22). Entre 1,2 y ≈1,49 el
 * vídeo (`cover`) recorta los lados y su papel llega al borde de la ventana, mientras que el papel HTML
 * queda a 16 px de cada lado: salto visible de 16 px por lado, aceptado. Por debajo se muestra la carta
 * con fundido y no se descarga el vídeo.
 * Pendiente (02d): el móvil en vertical queda sin vídeo hasta que llegue el vídeo 9:16.
 */
export const PROPORCION_MINIMA_VIDEO = 1.2

/** Papel del último fotograma respecto al alto de la ventana: 0,8266 × 16/9 (el `146.94dvh` de `carta.css`). */
export const PAPEL_POR_ALTO = 1.4694

/** Ancho mínimo del papel (D23). `--ancho-minimo-papel` de `base.css` debe valer lo mismo (lo comprueba un test). */
export const ANCHO_MINIMO_PAPEL_PX = 600

export const TOPE_ARRANQUE_VIDEO_MS = 4000
export const MARGEN_FIN_VIDEO_MS = 2000
export const TOPE_FIN_VIDEO_MS = 15000

/**
 * Segundos finales del vídeo que se recortan: el papel ya está quieto y la carta tarda en aparecer.
 * La apertura se da por terminada al llegar a `duración - RECORTE_FINAL_S`, igual que con `ended`.
 */
export const RECORTE_FINAL_S = 1.5

/**
 * `true` si la ventana es lo bastante apaisada y alta para reproducir el vídeo: así el papel del
 * fotograma (`alto × PAPEL_POR_ALTO`) no baja del ancho mínimo y coincide con el papel HTML.
 * Medidas no válidas, `false`.
 */
export function ventanaAdmiteVideo(ancho: number, alto: number): boolean {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) return false
  return ancho / alto >= PROPORCION_MINIMA_VIDEO && alto * PAPEL_POR_ALTO >= ANCHO_MINIMO_PAPEL_PX
}

/** `true` si el vídeo ha llegado al punto de corte. Con duración desconocida o ≤ recorte, siempre `false` (solo vale `ended`). */
export function finAlcanzado(duracionS: number, actualS: number, recorteS: number = RECORTE_FINAL_S): boolean {
  if (!Number.isFinite(duracionS) || duracionS <= recorteS || !Number.isFinite(actualS)) return false
  return actualS >= duracionS - recorteS
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
 * `true` si el vídeo termina (`ended` o corte de `RECORTE_FINAL_S`); `false` si hay `error` o vence el tope.
 * El corte se mira con `requestVideoFrameCallback` si existe y con `timeupdate` en cualquier caso.
 * Nunca rechaza; al resolver quita listeners, callback y temporizador.
 */
export function esperarFinVideo(video: HTMLVideoElement, ms: number): Promise<boolean> {
  return new Promise((resolver) => {
    let idFotograma: number | undefined
    let terminado = false
    const comprobar = () => {
      if (finAlcanzado(video.duration, video.currentTime)) terminar(true)
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
