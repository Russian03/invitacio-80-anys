/** Descriptores de las fuentes propias de la carta. Deben coincidir con los `@font-face` de base.css. */
export const FUENTES_CARTA = ['400 1em "Pinyon Script"', '400 1em "Albert Sans"', '600 1em "Albert Sans"'] as const

/**
 * Pide de forma explícita cada fuente de la carta: `document.fonts.ready` puede resolver
 * antes de que el navegador haya empezado a cargarlas. Nunca rechaza; sin conjunto resuelve al momento.
 */
export async function cargarFuentes(conjunto: Pick<FontFaceSet, 'load'> | undefined): Promise<void> {
  if (!conjunto) return
  await Promise.allSettled(
    FUENTES_CARTA.map(async (descriptor) => {
      await conjunto.load(descriptor)
    }),
  )
}
