/** Orden puro de la pila de fotos (plan 05, T1). `arriba` es el índice de la foto de arriba. */

function totalValido(total: number): boolean {
  return Number.isInteger(total) && total >= 1
}

function arribaValido(arriba: number, total: number): boolean {
  return totalValido(total) && Number.isInteger(arriba) && arriba >= 0 && arriba < total
}

/** Foto que queda arriba al pasar a la siguiente; 0 si los datos no son válidos. */
export function siguiente(arriba: number, total: number): number {
  if (!arribaValido(arriba, total)) return 0
  return (arriba + 1) % total
}

/** Foto que queda arriba al volver a la anterior; 0 si los datos no son válidos. */
export function anterior(arriba: number, total: number): number {
  if (!arribaValido(arriba, total)) return 0
  return (arriba - 1 + total) % total
}

/** Profundidad de cada foto en la pila (0 = arriba). Lista vacía si `total` no es válido. */
export function profundidades(arriba: number, total: number): number[] {
  if (!totalValido(total)) return []
  return Array.from({ length: total }, (_, i) => (((i - arriba) % total) + total) % total)
}

/** Convierte un valor CSS como `-1.5deg` en grados; 0 si está vacío o no es numérico. */
export function parseGrados(texto: string): number {
  const valor = Number.parseFloat(texto)
  return Number.isFinite(valor) ? valor : 0
}
