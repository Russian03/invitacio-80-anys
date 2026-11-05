import type { Caja } from './geometria'
import { EASE_FASE, planPapel, transformCss } from './plan-papel'

export interface CapasPapel {
  readonly body: HTMLElement
  readonly carta: HTMLElement
  readonly boca: HTMLElement
  readonly papel: HTMLElement
  readonly escenario: HTMLElement
}

const MARGEN_TOPE_MS = 1500

const aCaja = (r: DOMRect): Caja => ({ left: r.left, top: r.top, width: r.width, height: r.height })

/**
 * Papel decorativo en una sola línea temporal (duración según la distancia): sube por detrás de la parte delantera del sobre (recortado por la
 * línea de la boca, así su borde inferior sigue esa línea), llega arriba del todo con velocidad 0 (su borde inferior queda en la y 324 del fotograma, el superior por encima de la ventana), pasa al frente
 * (se quita el recorte) y baja con ease-out, cambiando de alto hasta la caja de `#carta`.
 * El sobre se queda detrás y solo se funde al final; el fondo de escena es permanente (D36) y no se toca. Resuelve `true` si llega al final y `false`
 * si se cancela o vence el tope. Lanza si no se puede preparar (medidas no válidas o `animate` roto): quien llama lo
 * trata como fallo (D10). `cancelar()` detiene las animaciones y deja las capas ocultas (sin parpadeo de la escena).
 */
export function animarPapel(capas: CapasPapel): { terminada: Promise<boolean>; cancelar: () => void } {
  const { carta, boca, papel, escenario } = capas
  const animaciones: Animation[] = []
  let temporizador: ReturnType<typeof setTimeout> | undefined
  const cancelar = () => {
    clearTimeout(temporizador)
    animaciones.forEach((a) => a.cancel())
    escenario.style.opacity = '0'
    boca.style.display = 'none'
    papel.style.display = 'none'
  }
  const animar = (el: Element, keyframes: Keyframe[], duration: number) => {
    const a = el.animate(keyframes, { duration, easing: 'linear', fill: 'both' })
    animaciones.push(a)
    return a
  }

  // Se mide la caja REAL del escenario y de la capa del recorte, no `innerWidth`/`vw` teóricos: con una barra de scroll clásica
  // `100vw` y `innerWidth` pueden diferir de lo que se pinta, y la boca se desplazaba ≈ la mitad de la barra
  const cajaCarta = aCaja(carta.getBoundingClientRect())
  const escena = aCaja(escenario.getBoundingClientRect())
  const altoVentana = boca.getBoundingClientRect().height
  const plan = planPapel(escena, cajaCarta, altoVentana)
  if (!plan) throw new Error('medidas de la ventana no válidas')

  // El papel ocupa la caja final de #carta (a scroll 0); el transform lo mete en el sobre
  Object.assign(papel.style, {
    left: `${cajaCarta.left}px`,
    top: `${cajaCarta.top}px`,
    width: `${cajaCarta.width}px`,
    height: `${plan.alturaHoja}px`,
  })
  const { offsetArriba: arriba, fundido, duracionTotalMs: total } = plan
  const fundir = ([desde, hasta]: readonly [number, number]): Keyframe[] => [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: desde },
    { opacity: 0, offset: hasta },
    { opacity: 0, offset: 1 },
  ]
  const todas = [
    // Misma curva y misma velocidad media (duración proporcional a la distancia) en la subida y en la bajada;
    // la hoja cambia de alto hasta el alto de #carta mientras baja
    animar(
      papel,
      [
        { transform: transformCss(plan.escondido), height: `${plan.alturaHoja}px`, offset: 0, easing: EASE_FASE },
        { transform: transformCss(plan.arriba), height: `${plan.alturaHoja}px`, offset: arriba, easing: EASE_FASE },
        { transform: 'none', height: `${cajaCarta.height}px`, offset: 1 },
      ],
      total,
    ),
    // Recorte cerrado hasta arriba del todo; ahí pasa al frente de golpe (el papel ya está sobre la línea de la boca)
    animar(
      boca,
      [
        { clipPath: plan.clipCerrado, offset: 0 },
        { clipPath: plan.clipCerrado, offset: arriba, easing: 'step-start' },
        { clipPath: plan.clipAbierto, offset: 1 },
      ],
      total,
    ),
    animar(escenario, fundir(fundido.escenario), total),
  ]
  boca.style.clipPath = plan.clipCerrado

  const terminada = (async () => {
    const tope = new Promise<void>((resolver) => {
      temporizador = setTimeout(resolver, total + MARGEN_TOPE_MS)
    })
    await Promise.race([Promise.allSettled(todas.map((a) => a.finished)), tope])
    clearTimeout(temporizador)
    return todas.every((a) => a.playState === 'finished')
  })()

  return { terminada, cancelar }
}
