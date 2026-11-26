import './estilos/base.css'
import './estilos/carta.css'
import './estilos/apertura.css'
import './estilos/papel-apertura.css'
import './estilos/formulario.css'
import './estilos/carrusel.css'
import { iniciarCarta } from './carta/carta'
import { envioSimulado } from './formulario/envio'
import { iniciarFormulario } from './formulario/formulario'

iniciarCarta(document.body)

const form = document.querySelector<HTMLFormElement>('#form-confirmacio')
if (form) iniciarFormulario(form, envioSimulado)
