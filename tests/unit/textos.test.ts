import { describe, expect, it } from 'vitest'
import { ERRORES, textoExito } from '../../src/formulario/textos'

describe('textoExito', () => {
  it('si asiste, agradece y dice que lo esperan', () => {
    expect(textoExito('Maria', true)).toBe("Gràcies, Maria! Hem rebut la teva resposta. T'esperem.")
  })

  it('si no asiste, agradece el aviso', () => {
    expect(textoExito('Maria', false)).toBe('Gràcies per avisar, Maria. Et trobarem a faltar.')
  })

  it('no modifica el nombre (el HTML se muestra literal)', () => {
    expect(textoExito('<b>x</b>', true)).toContain('<b>x</b>')
  })
})

describe('ERRORES', () => {
  it('contiene el error genérico de envío en catalán', () => {
    expect(ERRORES.envio).toBe("No s'ha pogut enviar. Torna-ho a provar.")
  })
})
