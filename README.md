# Invitació 80 anys

[![Publicar](https://github.com/Russian03/invitacio-80-anys/actions/workflows/publicar.yml/badge.svg)](https://github.com/Russian03/invitacio-80-anys/actions/workflows/publicar.yml)

Invitación web en catalán a un 80 cumpleaños, pensada primero para el móvil y para invitados de todas las edades: un sobre que se abre solo, una carta que sale de él, fotos apiladas y un formulario de confirmación.

> **Estado:** en desarrollo. Falta el número de cuenta y el formulario **todavía no guarda las respuestas**.

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
public/             Fuentes, imágenes y vídeo
tests/
  unit/             Lógica pura (sin navegador)
  e2e/              Recorridos en navegador
  despliegue/       Publicación en subcarpeta
.github/workflows/  CI y publicación
```

## Publicación

Cada cambio en `main` pasa los tests. Mientras el repositorio es privado no se publica nada.

Para publicar:

1. Pasar el repositorio a público (*Settings → General → Change visibility*).
2. Activar una sola vez *Settings → Pages → Source: GitHub Actions*.
3. En *Actions → Publicar*, pulsar *Run workflow*.

A partir de ahí, cada cambio en `main` se publica solo en `https://russian03.github.io/invitacio-80-anys/`.

Antes de publicar, recordar que serán visibles para cualquiera el código y la web, incluidos los textos y las fotos. La etiqueta `noindex` pide a los buscadores que no la indexen, pero no restringe el acceso.

## Privacidad y seguridad

- Sin cookies, analítica ni peticiones a terceros; fuentes alojadas en el propio sitio.
- La build añade una política de seguridad de contenido (CSP).
- Ninguna clave en el repositorio: los ficheros `.env` están ignorados.

## Licencias

Las fuentes Pinyon Script y Albert Sans se distribuyen con licencia OFL 1.1 (ver `public/fuentes/`). El resto del proyecto: todos los derechos reservados.
