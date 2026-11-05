/** Duración de cada elemento: igual a `--dur-lenta` (diseno.md → Movimiento; D3). WAAPI no lee variables CSS. */
export const DURACION_ENTRADA_MS = 500
/** Espera desde que la carta pasa a `abierta` hasta que entra el primero (D3). */
export const RETRASO_INICIAL_ENTRADA_MS = 200
/** Separación entre elementos consecutivos (D3). */
export const PASO_ENTRADA_MS = 120
/** Tope del total (último retraso + duración): si hay muchos elementos, el paso se comprime (D3). */
export const DURACION_MAXIMA_ENTRADA_MS = 1400
/** Cuánto suben los elementos al entrar (D3). */
export const DESPLAZAMIENTO_ENTRADA_PX = 12

export interface PasoEntrada {
  readonly retrasoMs: number
  readonly duracionMs: number
}

/** Plan puro de la entrada inicial: un paso por elemento, o `[]` si `cantidad` no es un entero ≥ 1. */
export function planEntrada(cantidad: number): PasoEntrada[] {
  if (!Number.isInteger(cantidad) || cantidad < 1) return []
  const holgura = DURACION_MAXIMA_ENTRADA_MS - DURACION_ENTRADA_MS - RETRASO_INICIAL_ENTRADA_MS
  const paso = cantidad === 1 ? PASO_ENTRADA_MS : Math.min(PASO_ENTRADA_MS, holgura / (cantidad - 1))
  return Array.from({ length: cantidad }, (_, i) => ({
    retrasoMs: RETRASO_INICIAL_ENTRADA_MS + i * paso,
    duracionMs: DURACION_ENTRADA_MS,
  }))
}
