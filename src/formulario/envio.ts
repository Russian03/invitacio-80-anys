import type { ErroresRespuesta, Respuesta } from './validacion'

export type Resultado = {
  ok: boolean
  errores?: ErroresRespuesta
  motivo?: 'xarxa' | 'servidor'
}

export type EnviarRespuesta = (respuesta: Respuesta) => Promise<Resultado>

export const ESPERA_SIMULADA_MS = 800

/** Envío de mentira del hito 1: espera y dice que todo fue bien. No guarda ni envía nada. */
export function envioSimulado(
  _respuesta: Respuesta,
  esperaMs: number = ESPERA_SIMULADA_MS,
): Promise<Resultado> {
  return new Promise((resolver) => {
    setTimeout(() => resolver({ ok: true }), esperaMs)
  })
}
