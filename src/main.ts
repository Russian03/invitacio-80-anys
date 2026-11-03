import './estilos/base.css'
import './estilos/carta.css'
import './estilos/formulario.css'
import { envioSimulado } from './formulario/envio'
import { iniciarFormulario } from './formulario/formulario'

const form = document.querySelector<HTMLFormElement>('#form-confirmacio')
if (form) iniciarFormulario(form, envioSimulado)
