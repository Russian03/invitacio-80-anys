export type EstadoCarta = 'cerrada' | 'abriendo' | 'abierta' | 'cerrando'
export type EventoCarta = 'abrir' | 'fin-animacion' | 'fallo' | 'cerrar'

export const ESTADO_INICIAL: EstadoCarta = 'cerrada'

const TRANSICIONES: Record<EstadoCarta, Partial<Record<EventoCarta, EstadoCarta>>> = {
  cerrada: { abrir: 'abriendo', fallo: 'abierta' },
  abriendo: { 'fin-animacion': 'abierta', fallo: 'abierta' },
  abierta: { cerrar: 'cerrando' },
  cerrando: { 'fin-animacion': 'cerrada' },
}

/** Siguiente estado de la carta; un evento no válido en ese estado no cambia nada. */
export function transicion(estado: EstadoCarta, evento: EventoCarta): EstadoCarta {
  return TRANSICIONES[estado][evento] ?? estado
}

/** El contenido de la carta solo se puede usar con la carta abierta. */
export function contenidoInerte(estado: EstadoCarta): boolean {
  return estado !== 'abierta'
}
