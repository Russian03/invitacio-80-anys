import {
  DURACION_FUNDIDO_MS,
  TOPE_APERTURA_MS,
  TOPE_FUENTES_MS,
  conTope,
  prefiereMovimientoReducido,
} from '../movimiento'
import { ESTADO_INICIAL, contenidoInerte, transicion, type EventoCarta } from './estado-carta'
import { TOPE_ARRANQUE_VIDEO_MS, VIDEO_APERTURA, esperarEvento, topeFin } from './video'

/** Espera a que acaben las animaciones de la raíz; las canceladas (finished rechaza) se absorben. */
function terminadas(raiz: Element): Promise<unknown> {
  return Promise.allSettled(raiz.getAnimations({ subtree: true }).map((animacion) => animacion.finished))
}

/**
 * Lleva la carta de cerrada a abierta: el estado vive en `data-estado` del body.
 * Se abre al terminar el vídeo de apertura; con movimiento reducido (sin vídeo) o
 * si el vídeo falla, con un fundido. Si falta algún elemento, no toca nada y la carta
 * queda visible.
 */
export function iniciarCarta(body: HTMLElement): void {
  const carta = body.querySelector<HTMLElement>('#carta')
  const titulo = body.querySelector<HTMLElement>('#titol')
  const video = body.querySelector<HTMLVideoElement>('#video-apertura')
  if (!carta || !titulo || !video) return

  history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)

  let estado = ESTADO_INICIAL
  const aplicar = () => {
    body.dataset.estado = estado
    carta.inert = contenidoInerte(estado)
  }

  const pasar = (evento: EventoCarta) => {
    const siguiente = transicion(estado, evento)
    if (siguiente === estado) return
    estado = siguiente
    aplicar()
    if (estado !== 'abierta') return
    titulo.focus({ preventScroll: true })
    if (evento === 'fallo') {
      carta.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURACION_FUNDIDO_MS, easing: 'ease-out' })
    }
  }

  // Estado seguro: carta abierta con fundido y descarga del vídeo soltada (D10, D14). Llamarla dos veces es inocuo
  const fallar = () => {
    pasar('fallo')
    video.pause()
    video.removeAttribute('src')
    video.load()
  }

  const abrirSinVideo = async () => {
    pasar('abrir')
    await conTope(terminadas(carta), TOPE_APERTURA_MS)
    pasar('fin-animacion')
  }

  const abrirConVideo = async () => {
    // Los listeners se registran antes de asignar `src` para no perder un error temprano
    const arranque = esperarEvento(video, 'playing', ['error'], TOPE_ARRANQUE_VIDEO_MS)
    video.muted = true
    video.src = VIDEO_APERTURA
    pasar('abrir')
    video.play().catch(fallar)
    if (!(await arranque)) return fallar()
    const fin = await esperarEvento(video, 'ended', ['error'], topeFin(video.duration))
    if (estado !== 'abriendo') return
    if (!fin) return fallar()
    pasar('fin-animacion')
  }

  const abrir = async () => {
    await conTope(document.fonts?.ready ?? Promise.resolve(), TOPE_FUENTES_MS)
    if (prefiereMovimientoReducido()) return abrirSinVideo()
    return abrirConVideo()
  }

  aplicar()
  // Si algo falla, lo seguro es enseñar la carta abierta (D10)
  void abrir().catch(fallar)
}
