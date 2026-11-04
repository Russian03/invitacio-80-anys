import { defineConfig } from 'vite'

// S-04. Se inyecta solo en la build: el servidor de desarrollo de Vite mete estilos en línea.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"

export default defineConfig({
  build: { sourcemap: false },
  plugins: [
    {
      name: 'csp-produccion',
      apply: 'build',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ],
    },
  ],
})
