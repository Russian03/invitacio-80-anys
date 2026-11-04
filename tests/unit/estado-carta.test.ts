import { describe, expect, it } from 'vitest'
import {
  ESTADO_INICIAL,
  contenidoInerte,
  transicion,
  type EstadoCarta,
  type EventoCarta,
} from '../../src/carta/estado-carta'

describe('transicion', () => {
  const validas: [EstadoCarta, EventoCarta, EstadoCarta][] = [
    ['cerrada', 'abrir', 'abriendo'],
    ['cerrada', 'fallo', 'abierta'],
    ['abriendo', 'fallo', 'abierta'],
    ['abriendo', 'fin-animacion', 'abierta'],
    ['abierta', 'cerrar', 'cerrando'],
    ['cerrando', 'fin-animacion', 'cerrada'],
  ]
  it.each(validas)('desde %s con %s pasa a %s', (estado, evento, esperado) => {
    expect(transicion(estado, evento)).toBe(esperado)
  })

  const invalidas: [EstadoCarta, EventoCarta][] = [
    ['abierta', 'fallo'],
    ['abierta', 'fin-animacion'],
    ['cerrada', 'fin-animacion'],
    ['cerrando', 'fallo'],
  ]
  it.each(invalidas)('desde %s un evento %s no cambia nada', (estado, evento) => {
    expect(transicion(estado, evento)).toBe(estado)
  })

  it('un fallo dos veces seguidas desde abriendo acaba en abierta', () => {
    const una = transicion('abriendo', 'fallo')
    expect(transicion(una, 'fallo')).toBe('abierta')
  })
})

describe('contenidoInerte', () => {
  it.each<EstadoCarta>(['cerrada', 'abriendo', 'cerrando'])('es true en %s', (estado) => {
    expect(contenidoInerte(estado)).toBe(true)
  })
  it('es false en abierta', () => {
    expect(contenidoInerte('abierta')).toBe(false)
  })
})

describe('ESTADO_INICIAL', () => {
  it('es cerrada', () => {
    expect(ESTADO_INICIAL).toBe('cerrada')
  })
})
