import { DURACION_FUNDIDO_MS, TOPE_APERTURA_MS, TOPE_FUENTES_MS, conTope } from '../movimiento'
import { ESTADO_INICIAL, contenidoInerte, transicion, type EventoCarta } from './estado-carta'

/** Espera a que acaben las animaciones de la raíz; las canceladas (finished rechaza) se absorben. */
function terminadas(raiz: Element): Promise<unknown> {
  return Promise.allSettled(raiz.getAnimations({ subtree: true }).map((animacion) => animacion.finished))
}

/**
 * Lleva la carta de cerrada a abierta: el estado vive en `data-estado` del body
 * y el CSS hace el fundido. Si falta algún elemento, no toca nada y la carta
 * queda visible.
 */
export function iniciarCarta(body: HTMLElement): void {
  const carta = body.querySelector<HTMLElement>('#carta')
  const titulo = body.querySelector<HTMLElement>('#titol')
  if (!carta || !titulo) return

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

  const abrir = async () => {
    await conTope(document.fonts?.ready ?? Promise.resolve(), TOPE_FUENTES_MS)
    pasar('abrir')
    await conTope(terminadas(carta), TOPE_APERTURA_MS)
    pasar('fin-animacion')
  }

  aplicar()
  // Si algo falla, lo seguro es enseñar la carta abierta (D10)
  void abrir().catch(() => pasar('fallo'))
}
