# Invitació 80 anys

[![Publicar](https://github.com/Russian03/invitacio-80-anys/actions/workflows/publicar.yml/badge.svg)](https://github.com/Russian03/invitacio-80-anys/actions/workflows/publicar.yml)

Invitación web en catalán a un 80 cumpleaños, pensada primero para el móvil y para invitados de todas las edades: un sobre que se abre solo, una carta que sale de él, fotos apiladas y un formulario de confirmación.

> **Estado:** publicada en <https://russian03.github.io/invitacio-80-anys/>. Falta el número de cuenta. Las respuestas se guardan en una hoja de cálculo (ver [Respuestas](#respuestas)).

## Tecnología

HTML, CSS y TypeScript sin framework ni dependencias en producción. [Vite](https://vite.dev) para la build, [Vitest](https://vitest.dev) y [Playwright](https://playwright.dev) para los tests.

## Puesta en marcha

Requiere Node.js 22 o superior (la versión usada en CI está en `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba los tipos y genera `dist/` |
| `npm run preview` | Sirve la build generada |
| `npm run check` | Solo la comprobación de tipos |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests en navegador, escritorio y móvil |
| `npm run test:subruta` | Comprueba la web publicada en una subcarpeta |

Antes de los tests en navegador, una sola vez: `npx playwright install chromium`.

## Estructura

```
index.html          Página única
src/
  carta/            Apertura del sobre y de la carta (en móvil, en tríptico)
  carrusel/         Pila de fotos
  formulario/       Validación y envío
  estilos/          Un CSS por componente; variables en base.css
google/             Script que apunta las respuestas en una hoja de cálculo
public/             Fuentes, imágenes y vídeo
tests/
  unit/             Lógica pura (sin navegador)
  e2e/              Recorridos en navegador
  despliegue/       Publicación en subcarpeta
.github/workflows/  CI y publicación
```

## Respuestas

Cada confirmación se apunta como una fila en una hoja de cálculo de Google, mediante [`google/respuestas.gs`](google/respuestas.gs). La hoja solo la ve quien tú autorices.

**1. Preparar la hoja**

1. En Google Drive, crear una hoja de cálculo nueva (por ejemplo, «Respostes 80 anys»).
2. Abrir *Extensiones → Apps Script*, borrar lo que haya, pegar todo el contenido de `google/respuestas.gs` y guardar. Para recibir un correo con cada respuesta, cambiar antes `AVISAR_POR_CORREO` a `true`.
3. *Implementar → Nueva implementación*, tipo **Aplicación web**, con **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier usuario**.
4. *Implementar → Autorizar acceso*. Google avisa de que no ha verificado la aplicación, porque el script es tuyo: *Configuración avanzada → Ir a … (no seguro) → Permitir*.
5. Copiar la **URL de la aplicación web**, que acaba en `/exec`.

**2. Conectar la web**

La web toma la URL de la variable `VITE_URL_RESPUESTAS` al generarse. Sin ella, el formulario avisa de que no se ha podido enviar.

- En tu ordenador: crear el fichero `.env.local` (no se sube al repositorio) con la línea `VITE_URL_RESPUESTAS=` seguida de la URL, y volver a generar la web.
- Para publicar: *Settings → Secrets and variables → Actions → Variables → New repository variable*, con nombre `VITE_URL_RESPUESTAS` y la URL como valor. Sin esta variable la publicación se detiene.

Si se cambia el script, pegarlo de nuevo y publicarlo con *Implementar → Gestionar implementaciones → editar → Versión: nueva*, para que la URL no cambie.

**3. Ver el recuento**

La hoja se actualiza sola: el script corre en Google y añade la fila en el momento. Para tener los totales al día, en otra pestaña (con la hoja en español; en inglés se separa con `,` en vez de `;`):

| Celda | Fórmula |
|---|---|
| Vienen | `=COUNTUNIQUEIFS(Respostes!B2:B; Respostes!C2:C; "Sí")` |
| No vienen | `=COUNTUNIQUEIFS(Respostes!B2:B; Respostes!C2:C; "No")` |

Quien responda dos veces con el mismo nombre cuenta una sola vez.

## Publicación

Cada cambio en `main` pasa los tests. Mientras el repositorio es privado no se publica nada.

Para publicar, con la hoja ya preparada y en este orden:

1. Subir `main` a GitHub (`git push -u origin main`).
2. Crear la variable: *Settings → Secrets and variables → Actions → Variables → New repository variable*, nombre `VITE_URL_RESPUESTAS`.
3. Pasar el repositorio a público (*Settings → General → Change visibility*). La primera ejecución automática puede fallar porque Pages aún no está activado.
4. Activar una sola vez *Settings → Pages → Source: GitHub Actions*.
5. En *Actions → Publicar*, pulsar *Run workflow*.
6. Abrir la web publicada, enviar una respuesta de prueba y comprobar que llega a la hoja.

A partir de ahí, cada cambio en `main` se publica solo en `https://russian03.github.io/invitacio-80-anys/`.

Antes de publicar, recordar que serán visibles para cualquiera el código y la web, incluidos los textos, las fotos, el lugar, la fecha y el número de cuenta. La etiqueta `noindex` pide a los buscadores que no la indexen, pero no restringe el acceso.

## Privacidad y seguridad

- Sin cookies ni analítica; fuentes alojadas en el propio sitio. Lo único que sale a un tercero es la respuesta del formulario, hacia Google, cuando el invitado la envía.
- La build añade una política de seguridad de contenido (CSP): solo se ejecuta código del propio sitio y solo se envían datos a Google.
- La web no puede leer la hoja. El permiso es del script, limitado a su propia hoja (`@OnlyCurrentDoc`).
- La URL del script acepta envíos de cualquiera que la conozca, no solo de la web, y se puede ver en la web publicada. Lo máximo que permite es añadir filas: no leerlas, cambiarlas ni borrarlas.
- Cada envío se valida, se limpia y se guarda como texto, sin ejecutar fórmulas. A partir de 500 respuestas el script deja de apuntar.
- No hay protección contra quien quiera enviar respuestas falsas. Si pasa, borrar las filas y publicar el script como una implementación nueva (cambia la URL).
- La hoja no debe compartirse con enlace público, y la cuenta de Google y la de GitHub conviene protegerlas con verificación en dos pasos.
- Ninguna clave en el repositorio: los ficheros `.env` están ignorados.

## Licencias

Las fuentes Pinyon Script y Albert Sans se distribuyen con licencia OFL 1.1 (ver `public/fuentes/`). El resto del proyecto: todos los derechos reservados.
