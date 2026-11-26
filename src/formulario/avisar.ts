/** Lleva a quien rellena hasta lo que falta: foco en la primera casilla con error, a la vista, y un temblor. */

import { prefiereMovimientoReducido } from '../movimiento'
import { planTemblor } from './plan-temblor'
import type { Campo } from './validacion'

/** Margen para que el desplazamiento suave arranque antes de darlo por quieto. */
const ARRANQUE_SCROLL_MS = 100
const FOTOGRAMAS_QUIETO = 3
const TOPE_SCROLL_MS = 900

/** Resuelve cuando el elemento deja de moverse en pantalla, o al vencer el tope. */
function esperarQuieto(elemento: Element): Promise<void> {
  return new Promise((resolver) => {
    const tope = setTimeout(resolver, TOPE_SCROLL_MS)
    const inicio = performance.now()
    let anterior = Number.NaN
    let quieto = 0
    const mirar = () => {
      const { top } = elemento.getBoundingClientRect()
      quieto = top === anterior && performance.now() - inicio > ARRANQUE_SCROLL_MS ? quieto + 1 : 0
      anterior = top
      if (quieto < FOTOGRAMAS_QUIETO) return void requestAnimationFrame(mirar)
      clearTimeout(tope)
      resolver()
    }
    requestAnimationFrame(mirar)
  })
}

/** `campos`: los que tienen error, en el orden del formulario. Con movimiento reducido no hay temblor ni scroll suave. */
export async function avisarErrores(form: HTMLFormElement, campos: readonly Campo[]): Promise<void> {
  const controles = campos.flatMap((campo) => form.querySelector<HTMLElement>(`[name="${campo}"]`) ?? [])
  const primero = controles[0]
  if (!primero) return
  const reducido = prefiereMovimientoReducido()
  // El foco primero y sin salto: el desplazamiento lo hace `scrollIntoView`
  primero.focus({ preventScroll: true })
  const bloque = primero.closest('.campo') ?? primero
  bloque.scrollIntoView({ block: 'center', behavior: reducido ? 'auto' : 'smooth' })
  if (reducido) return
  // Tiembla cuando ya está a la vista
  await esperarQuieto(bloque)
  const { keyframes, opciones } = planTemblor()
  for (const control of controles) {
    // Las dos respuestas tiemblan juntas
    const casilla = control.closest<HTMLElement>('.opciones') ?? control
    casilla.animate?.(keyframes, opciones)
  }
}
