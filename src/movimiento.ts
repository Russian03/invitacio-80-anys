export const DURACION_FUNDIDO_MS = 300
export const TOPE_FUENTES_MS = 1200
export const TOPE_APERTURA_MS = 4000

/** Resuelve con lo primero que ocurra: la promesa (aunque rechace) o el tope. Nunca rechaza. */
export function conTope(promesa: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolver) => {
    const temporizador = setTimeout(resolver, ms)
    const terminar = () => {
      clearTimeout(temporizador)
      resolver()
    }
    promesa.then(terminar, terminar)
  })
}

/** JS decide si descarga el vídeo, así que lee la preferencia del sistema (D16). */
export function prefiereMovimientoReducido(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Curva de salida de los tokens CSS (`--ease-salida`); WAAPI no lee variables CSS. */
export const EASE_SALIDA = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const EASE_ENTRADA_SALIDA = 'cubic-bezier(0.65, 0, 0.35, 1)'
