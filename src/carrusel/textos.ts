/** Textos de interfaz del carrusel, en catalán (plan 05, T1). */

export const TEXTO_NO_DISPONIBLE = 'Imatge no disponible'

/** Contador visible: la posición es el índice de la foto más uno, igual que su `alt`. */
export function textoContador(arriba: number, total: number): string {
  return `${arriba + 1} de ${total}`
}
