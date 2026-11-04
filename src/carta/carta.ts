import {
  DURACION_FUNDIDO_MS,
  TOPE_APERTURA_MS,
  TOPE_FUENTES_MS,
  conTope,
  prefiereMovimientoReducido,
} from '../movimiento'
import { ESTADO_INICIAL, contenidoInerte, transicion, type EventoCarta } from './estado-carta'
import {
  IMAGEN_SOBRE,
  SOBRE_QUIETO_S,
  TOPE_ARRANQUE_VIDEO_MS,
  TOPE_IMAGEN_MS,
  VIDEO_APERTURA,
  esperarEvento,
  esperarMomentoVideo,
  topeFin,
} from './video'

/** Espera a que acaben las animaciones de la raíz; las canceladas (finished rechaza) se absorben. */
function terminadas(raiz: Element): Promise<unknown> {
  return Promise.allSettled(raiz.getAnimations({ subtree: true }).map((animacion) => animacion.finished))
}

/**
 * Lleva la carta de cerrada a abierta: el estado vive en `data-estado` del body.
 * Se reproduce el vídeo del sobre y, al quedar quieto (SOBRE_QUIETO_S), una imagen fija ocupa su sitio y la
 * carta aparece con un fundido; con movimiento reducido o si el vídeo falla, solo el fundido. Si falta algún
 * elemento, no toca nada y la carta queda visible.
 */
export function iniciarCarta(body: HTMLElement): void {
  const carta = body.querySelector<HTMLElement>('#carta')
  const titulo = body.querySelector<HTMLElement>('#titol')
  const video = body.querySelector<HTMLVideoElement>('#video-apertura')
  const imagen = body.querySelector<HTMLImageElement>('#sobre-abierto')
  if (!carta || !titulo || !video || !imagen) return

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
    // Fundido en dos casos: tras un fallo (carta abierta de golpe) o al relevar la imagen fija (`data-fase`).
    // Con movimiento reducido o sin vídeo, el fundido lo hace el CSS
    if (evento === 'fallo' || body.dataset.fase !== undefined) {
      const fundido = carta.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURACION_FUNDIDO_MS, easing: 'ease-out' })
      // La escena (imagen fija y fondo) se retira cuando la carta ya la tapa
      void conTope(fundido.finished, DURACION_FUNDIDO_MS * 3).then(() => delete body.dataset.fase)
    }
  }

  const soltarVideo = () => {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }

  // Estado seguro: carta abierta con fundido y descarga del vídeo soltada (D10, D14). Llamarla dos veces es inocuo
  const fallar = () => {
    pasar('fallo')
    soltarVideo()
  }

  const abrirSinVideo = async () => {
    body.dataset.sinVideo = ''
    pasar('abrir')
    await conTope(terminadas(carta), TOPE_APERTURA_MS)
    pasar('fin-animacion')
  }

  const abrirConVideo = async () => {
    // Los listeners se registran antes de asignar `src` para no perder un error temprano
    const arranque = esperarEvento(video, 'playing', ['error'], TOPE_ARRANQUE_VIDEO_MS)
    video.muted = true
    // La imagen fija se descarga y decodifica mientras suena el vídeo, para que el relevo no parpadee
    imagen.src = IMAGEN_SOBRE
    // Con tope: si la petición se cuelga, `false` lleva a `fallar()` en lugar de dejar la carta oculta (D10)
    const imagenLista = Promise.race([
      imagen.decode().then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolver) => setTimeout(resolver, TOPE_IMAGEN_MS, false)),
    ])
    video.src = VIDEO_APERTURA
    pasar('abrir')
    video.play().catch(fallar)
    if (!(await arranque)) return fallar()
    const quieto = await esperarMomentoVideo(video, SOBRE_QUIETO_S, topeFin(video.duration))
    if (estado !== 'abriendo') return
    if (!quieto || !(await imagenLista) || estado !== 'abriendo') return fallar()
    // Sobre quieto: imagen fija en lugar del vídeo, que se suelta para que no decodifique en vano
    body.dataset.fase = 'papel-sube'
    soltarVideo()
    pasar('fin-animacion')
  }

  const abrir = async () => {
    await conTope(document.fonts?.ready ?? Promise.resolve(), TOPE_FUENTES_MS)
    if (prefiereMovimientoReducido()) {
      return abrirSinVideo()
    }
    return abrirConVideo()
  }

  aplicar()
  // Si algo falla, lo seguro es enseñar la carta abierta (D10)
  void abrir().catch(fallar)
}
