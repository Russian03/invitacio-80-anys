import type { EnviarRespuesta, Resultado } from './envio'
import { ERRORES, textoExito } from './textos'
import { validarRespuesta, type Campo, type EntradaFormulario, type ErroresRespuesta } from './validacion'

const CAMPOS: readonly Campo[] = ['nom', 'assistira', 'alergens', 'comentari']
const TEXTO_BOTON_ENVIANDO = 'Enviant…'

function textoDe(datos: FormData, nombre: string): string {
  const valor = datos.get(nombre)
  return typeof valor === 'string' ? valor : ''
}

function leerEntrada(form: HTMLFormElement): EntradaFormulario {
  const datos = new FormData(form)
  const assistira = textoDe(datos, 'assistira')
  return {
    nom: textoDe(datos, 'nom'),
    assistira: assistira === '' ? null : assistira,
    alergens: textoDe(datos, 'alergens'),
    comentari: textoDe(datos, 'comentari'),
  }
}

function controlesDe(form: HTMLFormElement, campo: Campo): Element[] {
  return Array.from(form.querySelectorAll(`[name="${campo}"]`))
}

function limpiarErrores(form: HTMLFormElement): void {
  for (const campo of CAMPOS) {
    const aviso = form.querySelector<HTMLElement>(`#error-${campo}`)
    if (aviso) {
      aviso.hidden = true
      aviso.textContent = ''
    }
    controlesDe(form, campo).forEach((control) => control.removeAttribute('aria-invalid'))
  }
}

function mostrarErrores(form: HTMLFormElement, errores: ErroresRespuesta): void {
  for (const campo of CAMPOS) {
    const mensaje = errores[campo]
    if (mensaje === undefined) continue
    const aviso = form.querySelector<HTMLElement>(`#error-${campo}`)
    if (aviso) {
      aviso.textContent = mensaje
      aviso.hidden = false
    }
    controlesDe(form, campo).forEach((control) => control.setAttribute('aria-invalid', 'true'))
  }
}

/**
 * Conecta el formulario de confirmación: valida, envía y muestra el resultado.
 * Si falta algún elemento esperado de la página, no hace nada.
 */
export function iniciarFormulario(form: HTMLFormElement, enviar: EnviarRespuesta): void {
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  const errorEnvio = form.querySelector<HTMLElement>('#error-envio')
  const exito = document.querySelector<HTMLElement>('#exito')
  const exitoTexto = document.querySelector<HTMLElement>('#exito-texto')
  if (!boton || !errorEnvio || !exito || !exitoTexto) return

  const textoOriginalBoton = boton.textContent
  let enviando = false

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    if (enviando) return

    limpiarErrores(form)
    errorEnvio.hidden = true
    errorEnvio.textContent = ''

    const validacion = validarRespuesta(leerEntrada(form))
    if (!validacion.ok) {
      mostrarErrores(form, validacion.errores)
      return
    }

    enviando = true
    boton.disabled = true
    boton.textContent = TEXTO_BOTON_ENVIANDO
    try {
      const { respuesta } = validacion
      let resultado: Resultado
      try {
        resultado = await enviar(respuesta)
      } catch {
        resultado = { ok: false, motivo: 'xarxa' }
      }
      if (resultado.ok) {
        exitoTexto.textContent = textoExito(respuesta.nom, respuesta.assistira)
        form.hidden = true
        exito.hidden = false
      } else {
        errorEnvio.textContent = ERRORES.envio
        errorEnvio.hidden = false
      }
    } finally {
      enviando = false
      boton.disabled = false
      boton.textContent = textoOriginalBoton
    }
  })
}
