import { EASE_ENTRADA_SALIDA } from '../movimiento'
import { lineaTiempo, type Animacion } from './linea-tiempo'
import type { CapasPapel } from './papel'
import { EASE_FASE, transformCss } from './plan-papel'
import { CONSULTA_TRIPTICO, planTriptico } from './plan-triptico'

export interface CapasTriptico extends CapasPapel {
  readonly triptico: HTMLElement
}

/** Opacidad máxima de la sombra de una solapa al girar. */
const SOMBRA_GIRO = 0.35

/** En móvil en vertical la carta sale en tríptico. */
export function usaTriptico(): boolean {
  return window.matchMedia(CONSULTA_TRIPTICO).matches
}

/**
 * La carta sale del sobre plegada en tres (recortada por la boca, como el papel de escritorio), pasa delante, va al
 * centro mientras el sobre se funde, despliega la solapa de arriba y luego la de abajo, y ya abierta se cambia por la
 * hoja única (`#papel-apertura`), que hace zoom hasta la caja de `#carta`. Lanza si no se puede preparar (D10).
 */
export function animarTriptico(capas: CapasTriptico): Animacion {
  const { carta, boca, papel, escenario, triptico } = capas
  const r = carta.getBoundingClientRect()
  const ventana = boca.getBoundingClientRect()
  const plan = planTriptico(escenario.getBoundingClientRect(), r, ventana)
  const arriba = triptico.querySelector<HTMLElement>('.panel-arriba')
  const abajo = triptico.querySelector<HTMLElement>('.panel-abajo')
  if (!plan || !arriba || !abajo) throw new Error('no se puede preparar el tríptico')

  const caja = { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }
  Object.assign(triptico.style, caja)
  Object.assign(papel.style, caja)
  triptico.style.setProperty('--alto-panel', `${plan.altoPanel}px`)
  triptico.dataset.activo = ''
  boca.style.clipPath = plan.clipCerrado

  const linea = lineaTiempo(plan.duracionTotalMs, () => {
    escenario.style.opacity = '0'
    boca.style.display = 'none'
    papel.style.display = 'none'
    delete triptico.dataset.activo
  })
  const { fuera, centrado, zoom } = plan.momentos
  const escondido = transformCss(plan.escondido)
  const centro = transformCss(plan.centrado)

  // Sube, se centra y espera abierto; el zoom lo hace la hoja única, que releva al tríptico de golpe
  linea.animar(triptico, [
    { transform: escondido, opacity: 1, offset: 0, easing: EASE_FASE },
    { transform: transformCss(plan.fuera), opacity: 1, offset: fuera, easing: EASE_ENTRADA_SALIDA },
    { transform: centro, opacity: 1, offset: centrado },
    { transform: centro, opacity: 1, offset: zoom },
    { transform: centro, opacity: 0, offset: zoom },
    { transform: centro, opacity: 0, offset: 1 },
  ])
  linea.animar(papel, [
    { transform: centro, opacity: 0, offset: 0 },
    { transform: centro, opacity: 0, offset: zoom },
    { transform: centro, opacity: 1, offset: zoom, easing: EASE_ENTRADA_SALIDA },
    { transform: 'none', opacity: 1, offset: 1 },
  ])
  linea.animar(boca, [
    { clipPath: plan.clipCerrado, offset: 0 },
    { clipPath: plan.clipCerrado, offset: fuera, easing: 'step-start' },
    { clipPath: plan.clipAbierto, offset: 1 },
  ])
  linea.animar(escenario, [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: plan.fundidoEscenario[0] },
    { opacity: 0, offset: plan.fundidoEscenario[1] },
    { opacity: 0, offset: 1 },
  ])

  const solapas = [
    { panel: arriba, tramo: plan.momentos.arriba, plegado: 'rotateX(-180deg)' },
    { panel: abajo, tramo: plan.momentos.abajo, plegado: 'rotateX(180deg)' },
  ]
  for (const { panel, tramo: [desde, hasta], plegado } of solapas) {
    linea.animar(panel, [
      { transform: plegado, offset: 0 },
      { transform: plegado, offset: desde, easing: EASE_ENTRADA_SALIDA },
      { transform: 'rotateX(0deg)', offset: hasta },
      { transform: 'rotateX(0deg)', offset: 1 },
    ])
    // La cara interior sale de la sombra al abrirse y el dorso se oscurece al levantarse
    for (const velo of panel.querySelectorAll('.velo')) {
      const interior = velo.parentElement!.classList.contains('cara-frente')
      const [inicial, final] = interior ? [SOMBRA_GIRO, 0] : [0, SOMBRA_GIRO]
      linea.animar(velo, [
        { opacity: inicial, offset: 0 },
        { opacity: inicial, offset: desde, easing: EASE_ENTRADA_SALIDA },
        { opacity: final, offset: hasta },
        { opacity: final, offset: 1 },
      ])
    }
  }

  return linea.esperar()
}
