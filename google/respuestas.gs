/**
 * Recibe las confirmaciones de la web y las apunta en esta hoja de cálculo.
 * Se pega en la hoja (Extensiones → Apps Script) y se publica como aplicación web: ver README → Respuestas.
 * No lleva claves ni direcciones: la hoja y el correo son los de quien lo publica.
 * La línea siguiente limita el permiso del programa a esta hoja de cálculo: no puede tocar ningún otro fichero.
 *
 * @OnlyCurrentDoc
 */

// Pon `true` si quieres un correo con cada respuesta
const AVISAR_POR_CORREO = false

const NOMBRE_HOJA = 'Respostes'
/** Topes de seguridad contra envíos masivos o desmesurados. */
const MAX_RESPUESTAS = 500
const MAX_CUERPO = 2500
const CABECERA = ['Data', 'Nom i cognoms', 'Hi serà?', 'Al·lèrgens o intoleràncies']

function doPost(evento) {
  const respuesta = leer(evento)
  if (!respuesta) return contestar(false)
  try {
    if (!apuntar(respuesta)) return contestar(false)
  } catch (error) {
    // Al que envía no se le enseña ningún detalle; queda en el registro de Apps Script
    console.error(error)
    return contestar(false)
  }
  avisar(respuesta)
  return contestar(true)
}

/** Añade la fila; `false` si la hoja ya está en su tope. */
function apuntar(respuesta) {
  // De una en una: dos envíos a la vez no deben pisarse
  const cerrojo = LockService.getScriptLock()
  cerrojo.waitLock(10000)
  try {
    const hoja = hojaDeRespuestas()
    if (hoja.getLastRow() > MAX_RESPUESTAS) return false
    hoja.appendRow([new Date(), comoTexto(respuesta.nom), siONo(respuesta), comoTexto(respuesta.alergens)])
    return true
  } finally {
    cerrojo.releaseLock()
  }
}

/** Abrir la dirección en el navegador sirve para comprobar que está publicada. No enseña ningún dato. */
function doGet() {
  return contestar(true)
}

function contestar(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok })).setMimeType(ContentService.MimeType.JSON)
}

/** La respuesta ya comprobada, o `null` si no es válida. Los límites son los del formulario. */
function leer(evento) {
  try {
    if (evento.postData.contents.length > MAX_CUERPO) return null
    const datos = JSON.parse(evento.postData.contents)
    const nom = limpiar(typeof datos.nom === 'string' ? datos.nom : '')
    if (nom.length < 2 || nom.length > 80) return null
    if (typeof datos.assistira !== 'boolean') return null
    if (typeof datos.alergens !== 'string' || datos.alergens.length > 300) return null
    return { nom: nom, assistira: datos.assistira, alergens: limpiar(datos.alergens) }
  } catch (error) {
    return null
  }
}

/** En una sola línea, sin caracteres de control y sin espacios sobrantes. */
function limpiar(texto) {
  return texto.replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ').trim()
}

/**
 * Un texto que empieza como una fórmula lleva un punto delante: así no se ejecuta ni en la hoja ni al exportarla y
 * abrirla en Excel.
 */
function comoTexto(texto) {
  return /^[=+\-@'＝＋－＠]/.test(texto) ? '· ' + texto : texto
}

function siONo(respuesta) {
  return respuesta.assistira ? 'Sí' : 'No'
}

function hojaDeRespuestas() {
  const libro = SpreadsheetApp.getActiveSpreadsheet()
  const existente = libro.getSheetByName(NOMBRE_HOJA)
  if (existente) return existente
  const hoja = libro.insertSheet(NOMBRE_HOJA)
  hoja.appendRow(CABECERA)
  hoja.setFrozenRows(1)
  return hoja
}

/** El aviso es un extra: si falla, la respuesta ya está apuntada. */
function avisar(respuesta) {
  if (!AVISAR_POR_CORREO) return
  try {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      'Nova resposta: ' + respuesta.nom,
      [
        CABECERA[1] + ': ' + respuesta.nom,
        CABECERA[2] + ' ' + siONo(respuesta),
        CABECERA[3] + ': ' + respuesta.alergens,
      ].join('\n'),
    )
  } catch (error) {
    console.error(error)
  }
}
