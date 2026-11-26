import './estilos/base.css'
import './estilos/carta.css'
import './estilos/calendari.css'
import './estilos/apertura.css'
import './estilos/papel-apertura.css'
import './estilos/triptico.css'
import './estilos/formulario.css'
import './estilos/carrusel.css'
import './estilos/presentacio.css'
import './estilos/on-quan.css'
import './estilos/regal.css'
import './estilos/pulsacion.css'
import { iniciarCarrusel } from './carrusel/carrusel'
import { iniciarCarta } from './carta/carta'
import { crearEnvio } from './formulario/envio'
import { iniciarFormulario } from './formulario/formulario'
import { iniciarPulsacion } from './pulsacion'

iniciarCarta(document.body)
iniciarPulsacion(document)

const carrusel = document.querySelector<HTMLElement>('#carrusel')
if (carrusel) iniciarCarrusel(carrusel)

const form = document.querySelector<HTMLFormElement>('#form-confirmacio')
if (form) iniciarFormulario(form, crearEnvio(import.meta.env.VITE_URL_RESPUESTAS))
