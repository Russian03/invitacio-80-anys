import { ERRORES } from './textos'

export type Campo = 'nom' | 'assistira' | 'alergens' | 'comentari'

export interface EntradaFormulario {
  nom: string
  assistira: string | null
  alergens: string
  comentari: string
}

export interface Respuesta {
  nom: string
  assistira: boolean
  alergens: string
  comentari: string
}

export type ErroresRespuesta = Partial<Record<Campo, string>>

export type ValidacionRespuesta =
  | { ok: true; respuesta: Respuesta }
  | { ok: false; errores: ErroresRespuesta }

export const LIMITES = { nomMin: 2, nomMax: 80, alergensMax: 300, comentariMax: 500 } as const

function errorDeNom(nom: string): string | undefined {
  if (nom.length === 0) return ERRORES.nomVacio
  if (nom.length < LIMITES.nomMin) return ERRORES.nomCorto
  if (nom.length > LIMITES.nomMax) return ERRORES.nomLargo
  return undefined
}

/**
 * Valida la entrada del formulario y devuelve todos los errores a la vez.
 * No escapa ni modifica el contenido (salvo `trim`): escapar es cosa de la salida (S-01).
 * Las longitudes se cuentan con `.length`, igual que `maxlength` del navegador.
 */
export function validarRespuesta(entrada: EntradaFormulario): ValidacionRespuesta {
  const nom = entrada.nom.trim()
  const alergens = entrada.alergens.trim()
  const comentari = entrada.comentari.trim()
  const errores: ErroresRespuesta = {}

  const errorNom = errorDeNom(nom)
  if (errorNom) errores.nom = errorNom
  if (entrada.assistira !== 'sí' && entrada.assistira !== 'no') errores.assistira = ERRORES.assistira
  if (alergens.length > LIMITES.alergensMax) errores.alergens = ERRORES.alergensLargo
  if (comentari.length > LIMITES.comentariMax) errores.comentari = ERRORES.comentariLargo

  if (Object.keys(errores).length > 0) return { ok: false, errores }
  return { ok: true, respuesta: { nom, assistira: entrada.assistira === 'sí', alergens, comentari } }
}
