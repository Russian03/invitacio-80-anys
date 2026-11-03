/** Textos de la interfaz en catalán para el formulario (módulo puro). */
export const ERRORES = {
  nomVacio: 'Escriu el teu nom',
  nomCorto: 'El nom ha de tenir almenys 2 lletres',
  nomLargo: 'El nom és massa llarg (màxim 80 caràcters)',
  assistira: 'Indica si vindràs',
  alergensLargo: 'Massa llarg (màxim 300 caràcters)',
  comentariLargo: 'Massa llarg (màxim 500 caràcters)',
  envio: "No s'ha pogut enviar. Torna-ho a provar.",
} as const

/** Mensaje de confirmación. El nombre se devuelve tal cual: quien lo pinte debe usar `textContent`. */
export function textoExito(nom: string, assistira: boolean): string {
  return assistira
    ? `Gràcies, ${nom}! Hem rebut la teva resposta. T'esperem.`
    : `Gràcies per avisar, ${nom}. Et trobarem a faltar.`
}
