/** Rebote al pulsar botones y respuestas. El hundimiento mientras se mantienen pulsados lo hace el CSS. */

import { prefiereMovimientoReducido } from './movimiento'

const DURACION_REBOTE_MS = 320
const REBOTE: Keyframe[] = [
  { transform: 'scale(0.95)' },
  { transform: 'scale(1.03)', offset: 0.55 },
  { transform: 'scale(1)' },
]

function rebotar(elemento: Element | null | undefined): void {
  if (!elemento || prefiereMovimientoReducido()) return
  elemento.animate?.(REBOTE, { duration: DURACION_REBOTE_MS, easing: 'ease-out' })
}

export function iniciarPulsacion(documento: Document): void {
  const objetivo = (evento: Event, selector: string) =>
    evento.target instanceof Element ? evento.target.closest(selector) : null
  documento.addEventListener('click', (evento) => rebotar(objetivo(evento, '.boton-primario, .pastilla')))
  // En las respuestas, `change`: un clic en la etiqueta lanza dos clics
  documento.addEventListener('change', (evento) => rebotar(objetivo(evento, '.opcion')))
  // Safari en iPhone solo aplica `:active` si alguien escucha los toques
  documento.addEventListener('touchstart', () => {}, { passive: true })
}
