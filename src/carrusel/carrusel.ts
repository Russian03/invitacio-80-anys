/** Pila de fotos que pasan solas; con el teclado, también a mano. Las decisiones salen de módulos puros. */

import { conTope, prefiereMovimientoReducido } from '../movimiento'
import { INTERVALO_FOTO_MS, esperaTrasPaso, puedePasarSola } from './automatico'
import { anterior, parseGrados, profundidades, siguiente } from './pila'
import { planFundido, planPaso, type Direccion, type Tramo } from './plan-paso'
import { TEXTO_NO_DISPONIBLE } from './textos'

/** Margen sobre la duración antes de dar por terminada una animación que no avisa. */
const MARGEN_TOPE_MS = 500
/** Parte de la pila que tiene que verse para que las fotos pasen. */
const FRACCION_A_LA_VISTA = 0.6

const giroDe = (foto: HTMLElement) => parseGrados(getComputedStyle(foto).getPropertyValue('--giro'))

/** Anima si se puede. `terminada` resuelve siempre, aunque la animación se cancele o no avance. */
function animar(el: HTMLElement, tramo: Tramo, extra: KeyframeAnimationOptions = {}) {
  if (typeof el.animate !== 'function') return { terminada: Promise.resolve(), cancelar: () => {} }
  const animacion = el.animate(tramo.keyframes, { ...tramo.opciones, ...extra })
  return {
    terminada: conTope(animacion.finished, Number(tramo.opciones.duration) + MARGEN_TOPE_MS),
    cancelar: () => animacion.cancel(),
  }
}

/** Si la foto no carga, muestra un aviso dentro del marco. */
function vigilarImagen(figura: HTMLElement): void {
  const img = figura.querySelector('img')
  if (!img) return
  const marcar = () => {
    if (figura.dataset.estado === 'error') return
    figura.dataset.estado = 'error'
    const aviso = document.createElement('p')
    aviso.className = 'foto-error'
    aviso.textContent = TEXTO_NO_DISPONIBLE
    figura.append(aviso)
  }
  if (img.complete && img.naturalWidth === 0) marcar()
  else img.addEventListener('error', marcar, { once: true })
}

export function iniciarCarrusel(seccion: HTMLElement): void {
  const pila = seccion.querySelector<HTMLElement>('.pila')
  if (!pila) return
  const fotos = [...pila.querySelectorAll<HTMLElement>('.foto')]
  const total = fotos.length
  if (total === 0) {
    seccion.hidden = true
    return
  }
  fotos.forEach(vigilarImagen)

  let arriba = 0
  let animando = false
  /** Puntero que mantiene pulsada la pila. */
  let sujeta: { readonly puntero: number; readonly tactil: boolean } | null = null
  let aLaVista = false
  let espera: ReturnType<typeof setTimeout> | undefined

  /** Capas y visibilidad para el lector de pantalla según la foto de arriba. */
  const pintar = () => {
    profundidades(arriba, total).forEach((profundidad, i) => {
      const foto = fotos[i]!
      foto.style.zIndex = String(total - profundidad)
      if (profundidad === 0) foto.removeAttribute('aria-hidden')
      else foto.setAttribute('aria-hidden', 'true')
    })
  }
  pintar()
  if (total < 2) return
  pila.tabIndex = 0

  /** Vuelve a contar el tiempo de la foto de arriba, o lo para si ahora no deben pasar. */
  const programar = (ms = INTERVALO_FOTO_MS) => {
    clearTimeout(espera)
    if (animando) return
    const puede = puedePasarSola({
      abierta: document.body.dataset.estado === 'abierta',
      aLaVista,
      pestanaVisible: !document.hidden,
      sujeta: sujeta !== null,
      conTeclado: pila.matches(':focus-visible'),
    })
    if (puede) espera = setTimeout(() => void pasar('siguiente'), ms)
  }

  const mover = async (direccion: Direccion) => {
    const destino = direccion === 'siguiente' ? siguiente(arriba, total) : anterior(arriba, total)
    if (prefiereMovimientoReducido()) {
      arriba = destino
      pintar()
      await animar(fotos[arriba]!, planFundido()).terminada
      return
    }
    // Hacia delante se mueve la de arriba; hacia atrás, la que vuelve desde el fondo
    const foto = fotos[direccion === 'siguiente' ? arriba : destino]!
    const plan = planPaso(direccion, giroDe(foto))
    // `forwards`: la foto no salta a su sitio antes de cambiar de capa
    const salida = animar(foto, plan.salida, { fill: 'forwards' })
    await salida.terminada
    arriba = destino
    pintar()
    const vuelta = animar(foto, plan.vuelta)
    salida.cancelar()
    await vuelta.terminada
  }

  const pasar = async (direccion: Direccion) => {
    if (animando) return
    animando = true
    clearTimeout(espera)
    const inicio = performance.now()
    try {
      await mover(direccion)
    } finally {
      animando = false
      programar(esperaTrasPaso(performance.now() - inicio))
    }
  }

  pila.addEventListener('keydown', (evento) => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    evento.preventDefault()
    void pasar(evento.key === 'ArrowLeft' ? 'anterior' : 'siguiente')
  })

  // Un dedo o el ratón pulsando la pila solo la detienen: las fotos no se arrastran
  pila.addEventListener('pointerdown', (evento) => {
    if (!evento.isPrimary || evento.button !== 0) return
    sujeta = { puntero: evento.pointerId, tactil: evento.pointerType !== 'mouse' }
    programar()
  })

  /** Se suelta donde sea, también fuera de la pila. */
  const liberar = (evento: PointerEvent) => {
    if (sujeta?.puntero !== evento.pointerId) return
    sujeta = null
    programar()
  }
  window.addEventListener('pointerup', liberar)
  window.addEventListener('pointercancel', liberar)

  // Dejar el dedo quieto para mirar una foto no debe abrir el menú de la imagen
  pila.addEventListener('contextmenu', (evento) => {
    if (sujeta?.tactil) evento.preventDefault()
  })

  const revisar = () => programar()
  pila.addEventListener('focus', revisar)
  pila.addEventListener('blur', revisar)
  document.addEventListener('visibilitychange', revisar)
  new MutationObserver(revisar).observe(document.body, { attributeFilter: ['data-estado'] })
  // Sin IntersectionObserver no pasan solas: quedan las flechas del teclado
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entradas) => {
        aLaVista = (entradas.at(-1)?.intersectionRatio ?? 0) >= FRACCION_A_LA_VISTA
        programar()
      },
      { threshold: FRACCION_A_LA_VISTA },
    ).observe(pila)
  }
}
