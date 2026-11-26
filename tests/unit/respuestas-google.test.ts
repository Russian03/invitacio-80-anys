import { describe, expect, it, vi } from 'vitest'
import codigo from '../../google/respuestas.gs?raw'

type Fila = unknown[]

/** Ejecuta el script de Apps Script con una hoja de cálculo de mentira. */
function cargar({ correo = false, falloCorreo = false, falloHoja = false } = {}) {
  const hojas = new Map<string, Fila[]>()
  const crear = (filas: Fila[]) => ({
    appendRow: (fila: Fila) => void filas.push(fila),
    getLastRow: () => filas.length,
    setFrozenRows: () => {},
  })
  const libro = {
    getSheetByName: (nombre: string) => (hojas.has(nombre) ? crear(hojas.get(nombre)!) : null),
    insertSheet: (nombre: string) => {
      hojas.set(nombre, [])
      return crear(hojas.get(nombre)!)
    },
  }
  const cerrojo = { waitLock: vi.fn(), releaseLock: vi.fn() }
  const enviarCorreo = vi.fn(() => {
    if (falloCorreo) throw new Error('sin cuota')
  })
  const fuente = codigo.replace('const AVISAR_POR_CORREO = false', `const AVISAR_POR_CORREO = ${correo}`)
  const script = new Function(
    'SpreadsheetApp', 'LockService', 'ContentService', 'MailApp', 'Session', 'console',
    `${fuente}\nreturn { doPost, doGet }`,
  )(
    {
      getActiveSpreadsheet: () => {
        if (falloHoja) throw new Error('No tienes permiso para llamar a SpreadsheetApp')
        return libro
      },
    },
    { getScriptLock: () => cerrojo },
    { MimeType: { JSON: 'json' }, createTextOutput: (texto: string) => ({ texto, setMimeType() { return this } }) },
    { sendEmail: enviarCorreo },
    { getEffectiveUser: () => ({ getEmail: () => 'duena@example.com' }) },
    { error: () => {} },
  ) as { doPost: (e: unknown) => { texto: string }; doGet: () => { texto: string } }
  const enviar = (cuerpo: unknown) =>
    JSON.parse(script.doPost({ postData: { contents: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } }).texto) as { ok: boolean }
  return { enviar, doGet: script.doGet, filas: () => hojas.get('Respostes') ?? [], cerrojo, enviarCorreo }
}

const maria = { nom: 'Maria Puig', assistira: true, alergens: 'gluten' }

describe('script de respuestas', () => {
  it('apunta cada respuesta en una fila, bajo la cabecera', () => {
    const s = cargar()
    expect(s.enviar(maria)).toEqual({ ok: true })
    expect(s.enviar({ nom: 'Joan', assistira: false, alergens: '' })).toEqual({ ok: true })
    const [cabecera, primera, segunda] = s.filas()
    expect(cabecera).toEqual(['Data', 'Nom i cognoms', 'Hi serà?', 'Al·lèrgens o intoleràncies'])
    expect(primera![0]).toBeInstanceOf(Date)
    expect(primera!.slice(1)).toEqual(['Maria Puig', 'Sí', 'gluten'])
    expect(segunda!.slice(1)).toEqual(['Joan', 'No', ''])
  })

  it('escribe de una en una y suelta el cerrojo', () => {
    const s = cargar()
    s.enviar(maria)
    expect(s.cerrojo.waitLock).toHaveBeenCalledOnce()
    expect(s.cerrojo.releaseLock).toHaveBeenCalledOnce()
  })

  // Con un punto delante no es una fórmula en la hoja ni al exportarla a CSV y abrirla en Excel
  it.each(['=HYPERLINK("http://mal.example")', '+1+1', '-2+3', '@SUM(A1)', "'=1+1", '＝1+1', '＋1', '－1', '＠algo'])(
    'neutraliza %s para que nunca se ejecute como fórmula',
    (valor) => {
      const s = cargar()
      s.enviar({ nom: valor, assistira: true, alergens: valor })
      expect(s.filas()[1]!.slice(1)).toEqual([`· ${valor}`, 'Sí', `· ${valor}`])
    },
  )

  it('no deja colar fórmulas detrás de espacios o saltos de línea', () => {
    const s = cargar()
    s.enviar({ nom: '  \t=1+1', assistira: true, alergens: '\r\n =2' })
    expect(s.filas()[1]!.slice(1)).toEqual(['· =1+1', 'Sí', '· =2'])
  })

  it('quita saltos de línea y caracteres de control, también del asunto del correo', () => {
    const s = cargar({ correo: true })
    s.enviar({ nom: 'Maria\r\nBcc: otra\u0000persona', assistira: true, alergens: 'gluten\nlactosa' })
    expect(s.filas()[1]!.slice(1)).toEqual(['Maria Bcc: otra persona', 'Sí', 'gluten lactosa'])
    expect(s.enviarCorreo.mock.calls[0]).toContain('Nova resposta: Maria Bcc: otra persona')
  })

  it('el HTML y el código se guardan como texto sin más', () => {
    const s = cargar()
    s.enviar({ nom: '<script>alert(1)</script>', assistira: true, alergens: "'; DROP TABLE x; --" })
    expect(s.filas()[1]!.slice(1)).toEqual(['<script>alert(1)</script>', 'Sí', "· '; DROP TABLE x; --"])
  })

  it('solo guarda los tres datos del formulario, aunque lleguen más', () => {
    const s = cargar()
    s.enviar({ ...maria, extra: '=1', __proto__: { admin: true }, data: 'x' })
    expect(s.filas()[1]).toHaveLength(4)
  })

  it('si la hoja falla, contesta que no sin enseñar detalles', () => {
    const s = cargar({ falloHoja: true })
    expect(s.enviar(maria)).toEqual({ ok: false })
    expect(s.cerrojo.releaseLock).toHaveBeenCalledOnce()
  })

  it('pide permiso solo sobre su propia hoja de cálculo', () => {
    expect(codigo).toContain('@OnlyCurrentDoc')
  })

  it.each([
    ['no es JSON', 'hola'],
    ['está vacía', 'null'],
    ['no tiene nombre', { ...maria, nom: '   ' }],
    ['tiene un nombre demasiado largo', { ...maria, nom: 'a'.repeat(81) }],
    ['no dice si asiste', { ...maria, assistira: 'sí' }],
    ['tiene alérgenos demasiado largos', { ...maria, alergens: 'a'.repeat(301) }],
    ['trae alérgenos que no son texto', { ...maria, alergens: 5 }],
    ['es desmesurada', { ...maria, relleno: 'a'.repeat(3000) }],
  ])('rechaza la respuesta que %s', (_caso, cuerpo) => {
    const s = cargar()
    expect(s.enviar(cuerpo)).toEqual({ ok: false })
    expect(s.filas()).toEqual([])
  })

  it('deja de apuntar al llegar a 500 respuestas', () => {
    const s = cargar()
    for (let i = 0; i < 500; i++) s.enviar(maria)
    expect(s.enviar(maria)).toEqual({ ok: false })
    expect(s.filas()).toHaveLength(501)
  })

  it('sin activarlo, no manda correos', () => {
    const s = cargar()
    s.enviar(maria)
    expect(s.enviarCorreo).not.toHaveBeenCalled()
  })

  it('activado, avisa por correo a quien es dueño de la hoja', () => {
    const s = cargar({ correo: true })
    s.enviar(maria)
    expect(s.enviarCorreo).toHaveBeenCalledWith(
      'duena@example.com',
      'Nova resposta: Maria Puig',
      'Nom i cognoms: Maria Puig\nHi serà? Sí\nAl·lèrgens o intoleràncies: gluten',
    )
  })

  it('si el correo falla, la respuesta queda apuntada igual', () => {
    const s = cargar({ correo: true, falloCorreo: true })
    expect(s.enviar(maria)).toEqual({ ok: true })
    expect(s.filas()).toHaveLength(2)
  })

  it('al abrir la dirección en el navegador contesta que está en marcha', () => {
    expect(JSON.parse(cargar().doGet().texto)).toEqual({ ok: true })
  })
})
