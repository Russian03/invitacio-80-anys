/** Envío de las respuestas a la hoja de cálculo, mediante el script de `google/respuestas.gs`. */

import type { ErroresRespuesta, Respuesta } from './validacion'

export type Resultado = {
  ok: boolean
  errores?: ErroresRespuesta
  motivo?: 'xarxa' | 'servidor'
}

export type EnviarRespuesta = (respuesta: Respuesta) => Promise<Resultado>

/** Apps Script tarda unos segundos en arrancar; pasado este tiempo se da por perdido. */
export const TOPE_ENVIO_MS = 20_000

/** Solo la dirección publicada de una aplicación web de Apps Script (acaba en `/exec`). */
const DIRECCION = /^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[\w.-]+)\/s\/[\w-]+\/exec$/

export function urlValida(url: string | undefined): url is string {
  return url !== undefined && DIRECCION.test(url)
}

const FALLO_SERVIDOR: Resultado = { ok: false, motivo: 'servidor' }

/** Sin dirección válida nunca dice que ha llegado: es preferible un error a perder respuestas. */
export function crearEnvio(url: string | undefined, pedir: typeof fetch = (...args) => fetch(...args)): EnviarRespuesta {
  return async (respuesta) => {
    if (!urlValida(url)) return FALLO_SERVIDOR
    const corte = new AbortController()
    const tope = setTimeout(() => corte.abort(), TOPE_ENVIO_MS)
    try {
      let contestacion: Response
      try {
        contestacion = await pedir(url, {
          method: 'POST',
          // `text/plain`: sin consulta previa (preflight), que Apps Script no contesta
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(respuesta),
          // Sin cookies de Google del invitado ni la dirección de la invitación
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: corte.signal,
        })
      } catch {
        return { ok: false, motivo: 'xarxa' }
      }
      if (!contestacion.ok) return FALLO_SERVIDOR
      const datos = (await contestacion.json().catch(() => null)) as { ok?: unknown } | null
      return datos?.ok === true ? { ok: true } : FALLO_SERVIDOR
    } finally {
      clearTimeout(tope)
    }
  }
}
