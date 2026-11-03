import { describe, expect, it } from 'vitest'
import { validarRespuesta, type EntradaFormulario } from '../../src/formulario/validacion'
import { ERRORES } from '../../src/formulario/textos'

const entradaValida: EntradaFormulario = {
  nom: 'Maria Puig',
  assistira: 'sí',
  alergens: '',
  comentari: '',
}

const con = (cambios: Partial<EntradaFormulario>): EntradaFormulario => ({ ...entradaValida, ...cambios })

const erroresDe = (entrada: EntradaFormulario) => {
  const resultado = validarRespuesta(entrada)
  if (resultado.ok) throw new Error('se esperaban errores')
  return resultado.errores
}

describe('validarRespuesta', () => {
  it('acepta una entrada válida, recorta los textos y convierte assistira a booleano', () => {
    const resultado = validarRespuesta({
      nom: '  Maria Puig  ',
      assistira: 'sí',
      alergens: '  gluten ',
      comentari: ' Hola ',
    })
    expect(resultado).toEqual({
      ok: true,
      respuesta: { nom: 'Maria Puig', assistira: true, alergens: 'gluten', comentari: 'Hola' },
    })
  })

  it('convierte "no" en assistira false', () => {
    const resultado = validarRespuesta(con({ assistira: 'no' }))
    expect(resultado.ok && resultado.respuesta.assistira).toBe(false)
  })

  it('con "no" y alergens vacío no hay error', () => {
    expect(validarRespuesta(con({ assistira: 'no', alergens: '' })).ok).toBe(true)
  })

  describe('nom', () => {
    it('vacío da nomVacio', () => {
      expect(erroresDe(con({ nom: '' })).nom).toBe(ERRORES.nomVacio)
    })
    it('solo espacios da nomVacio', () => {
      expect(erroresDe(con({ nom: '    ' })).nom).toBe(ERRORES.nomVacio)
    })
    it('1 carácter da nomCorto', () => {
      expect(erroresDe(con({ nom: 'A' })).nom).toBe(ERRORES.nomCorto)
    })
    it('2 caracteres es válido', () => {
      expect(validarRespuesta(con({ nom: 'Al' })).ok).toBe(true)
    })
    it('80 caracteres es válido', () => {
      expect(validarRespuesta(con({ nom: 'a'.repeat(80) })).ok).toBe(true)
    })
    it('81 caracteres da nomLargo', () => {
      expect(erroresDe(con({ nom: 'a'.repeat(81) })).nom).toBe(ERRORES.nomLargo)
    })
    it('los espacios de los extremos no cuentan para el máximo', () => {
      expect(validarRespuesta(con({ nom: ` ${'a'.repeat(80)} ` })).ok).toBe(true)
    })
    it('HTML como nombre pasa sin cambios (escapar es cosa de la salida)', () => {
      const nom = '<img src=x onerror=alert(1)>'
      const resultado = validarRespuesta(con({ nom }))
      expect(resultado.ok && resultado.respuesta.nom).toBe(nom)
    })
    it('acepta acentos y emojis', () => {
      expect(validarRespuesta(con({ nom: 'Núria Çabrera 🎉' })).ok).toBe(true)
    })
  })

  describe('assistira', () => {
    it.each([null, '', 'potser', 'SÍ', 'si', 'true'])('%j da error', (valor) => {
      expect(erroresDe(con({ assistira: valor })).assistira).toBe(ERRORES.assistira)
    })
  })

  describe('longitudes opcionales', () => {
    it('alergens 300 es válido', () => {
      expect(validarRespuesta(con({ alergens: 'a'.repeat(300) })).ok).toBe(true)
    })
    it('alergens 301 da error', () => {
      expect(erroresDe(con({ alergens: 'a'.repeat(301) })).alergens).toBe(ERRORES.alergensLargo)
    })
    it('comentari 500 es válido', () => {
      expect(validarRespuesta(con({ comentari: 'a'.repeat(500) })).ok).toBe(true)
    })
    it('comentari 501 da error', () => {
      expect(erroresDe(con({ comentari: 'a'.repeat(501) })).comentari).toBe(ERRORES.comentariLargo)
    })
  })

  it('una entrada vacía devuelve a la vez los errores de nom y assistira', () => {
    const errores = erroresDe({ nom: '', assistira: null, alergens: '', comentari: '' })
    expect(errores).toEqual({ nom: ERRORES.nomVacio, assistira: ERRORES.assistira })
  })

  it('devuelve todos los errores a la vez, también los opcionales', () => {
    const errores = erroresDe({
      nom: 'A',
      assistira: 'x',
      alergens: 'a'.repeat(301),
      comentari: 'a'.repeat(501),
    })
    expect(Object.keys(errores).sort()).toEqual(['alergens', 'assistira', 'comentari', 'nom'])
  })
})
