import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANCHO_MINIMO_PAPEL_PX,
  PAPEL_POR_ALTO,
  PROPORCION_MINIMA_VIDEO,
  RECORTE_FINAL_S,
  finAlcanzado,
  esperarEvento,
  esperarFinVideo,
  topeFin,
  ventanaAdmiteVideo,
} from '../../src/carta/video'

describe('esperarEvento', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resuelve true si llega el evento de éxito antes del tope', async () => {
    const objetivo = new EventTarget()
    const espera = esperarEvento(objetivo, 'playing', ['error'], 1000)
    objetivo.dispatchEvent(new Event('playing'))
    await expect(espera).resolves.toBe(true)
  })

  it('resuelve false si llega un evento de fallo', async () => {
    const objetivo = new EventTarget()
    const espera = esperarEvento(objetivo, 'playing', ['error'], 1000)
    objetivo.dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBe(false)
  })

  it('resuelve false al vencer el tope y no antes', async () => {
    const objetivo = new EventTarget()
    let resultado: boolean | undefined
    void esperarEvento(objetivo, 'playing', ['error'], 1000).then((valor) => {
      resultado = valor
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(resultado).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(resultado).toBe(false)
  })

  it('al resolver quita los listeners y el temporizador', async () => {
    const objetivo = new EventTarget()
    const espera = esperarEvento(objetivo, 'playing', ['error'], 1000)
    objetivo.dispatchEvent(new Event('playing'))
    await espera
    expect(vi.getTimerCount()).toBe(0)
    // un fallo posterior no cambia el resultado ya resuelto ni lanza
    objetivo.dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBe(true)
  })
})

describe('topeFin', () => {
  it('suma el margen a la duración', () => {
    expect(topeFin(8)).toBe(10000)
  })

  it.each([NaN, Infinity, 0, -3])('con duración %s usa el tope fijo', (duracion) => {
    expect(topeFin(duracion)).toBe(15000)
  })
})

describe('finAlcanzado', () => {
  it('el recorte final es de 1,5 s', () => {
    expect(RECORTE_FINAL_S).toBe(1.5)
  })

  it('es false antes de duración - recorte y true justo en él y después', () => {
    expect(finAlcanzado(10, 8.49)).toBe(false)
    expect(finAlcanzado(10, 8.5)).toBe(true)
    expect(finAlcanzado(10, 10)).toBe(true)
  })

  it('admite un recorte distinto', () => {
    expect(finAlcanzado(10, 8.9, 1)).toBe(false)
    expect(finAlcanzado(10, 9, 1)).toBe(true)
  })

  it.each([NaN, Infinity, 0, -3, 1.5, 1])('con duración %s solo vale ended (false)', (duracion) => {
    expect(finAlcanzado(duracion, 100)).toBe(false)
  })

  it.each([NaN, -Infinity])('con tiempo actual %s es false', (actual) => {
    expect(finAlcanzado(10, actual)).toBe(false)
  })
})

describe('esperarFinVideo', () => {
  /** Vídeo falso: EventTarget con duración, tiempo y rVFC simulados (los pendientes quedan en `pendientes`). */
  function crearVideo(conRvfc = true) {
    const video = new EventTarget() as EventTarget & Record<string, unknown>
    const pendientes = new Map<number, () => void>()
    let siguiente = 1
    video.duration = 10
    video.currentTime = 0
    const pedir = vi.fn((cb: () => void) => {
      const id = siguiente++
      pendientes.set(id, cb)
      return id
    })
    const cancelar = vi.fn((id: number) => {
      pendientes.delete(id)
    })
    if (conRvfc) {
      video.requestVideoFrameCallback = pedir
      video.cancelVideoFrameCallback = cancelar
    }
    /** Dispara el callback de fotograma pendiente (si lo hay) como haría el navegador. */
    const fotograma = () => {
      const [id, cb] = [...pendientes][0] ?? []
      if (id === undefined || !cb) return
      pendientes.delete(id)
      cb()
    }
    return { video: video as unknown as HTMLVideoElement, objetivo: video, pendientes, pedir, cancelar, fotograma }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('al cortar por rVFC no queda ningún rVFC pendiente', async () => {
    const { video, objetivo, pendientes, fotograma } = crearVideo()
    const espera = esperarFinVideo(video, 20000)
    expect(pendientes.size).toBe(1)
    objetivo.currentTime = 9
    fotograma()
    await expect(espera).resolves.toBe(true)
    expect(pendientes.size).toBe(0)
  })

  it('mientras no llega el corte, el rVFC se vuelve a armar', () => {
    const { video, objetivo, pendientes, fotograma } = crearVideo()
    void esperarFinVideo(video, 20000)
    objetivo.currentTime = 1
    fotograma()
    expect(pendientes.size).toBe(1)
  })

  it('timeupdate o ended posteriores a resolver no hacen nada', async () => {
    const { video, objetivo, pedir, cancelar, fotograma } = crearVideo()
    const espera = esperarFinVideo(video, 20000)
    objetivo.currentTime = 9
    fotograma()
    await espera
    const llamadasPedir = pedir.mock.calls.length
    const llamadasCancelar = cancelar.mock.calls.length
    objetivo.dispatchEvent(new Event('timeupdate'))
    objetivo.dispatchEvent(new Event('ended'))
    objetivo.dispatchEvent(new Event('error'))
    await vi.advanceTimersByTimeAsync(30000)
    expect(pedir.mock.calls.length).toBe(llamadasPedir)
    expect(cancelar.mock.calls.length).toBe(llamadasCancelar)
  })

  it('el corte por rVFC y por timeupdate no duplican la limpieza', async () => {
    const { video, objetivo, cancelar, fotograma } = crearVideo()
    const espera = esperarFinVideo(video, 20000)
    objetivo.currentTime = 9
    objetivo.dispatchEvent(new Event('timeupdate'))
    fotograma()
    fotograma()
    await expect(espera).resolves.toBe(true)
    expect(cancelar.mock.calls.length).toBeLessThanOrEqual(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('un fotograma que llega tras resolver por timeupdate no re-arma el callback', async () => {
    const { video, objetivo, pendientes, pedir } = crearVideo()
    const espera = esperarFinVideo(video, 20000)
    const cb = [...pendientes.values()][0]
    objetivo.currentTime = 9
    objetivo.dispatchEvent(new Event('timeupdate'))
    await espera
    const antes = pedir.mock.calls.length
    cb?.()
    expect(pedir.mock.calls.length).toBe(antes)
    expect(pendientes.size).toBe(0)
  })

  it('resuelve true con ended y limpia', async () => {
    const { video, objetivo, pendientes } = crearVideo()
    const espera = esperarFinVideo(video, 20000)
    objetivo.dispatchEvent(new Event('ended'))
    await expect(espera).resolves.toBe(true)
    expect(pendientes.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resuelve false con error y limpia', async () => {
    const { video, objetivo, pendientes } = crearVideo()
    const espera = esperarFinVideo(video, 20000)
    objetivo.dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBe(false)
    expect(pendientes.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resuelve false al vencer el tope y limpia', async () => {
    const { video, pendientes } = crearVideo()
    const espera = esperarFinVideo(video, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(espera).resolves.toBe(false)
    expect(pendientes.size).toBe(0)
  })

  it('sin requestVideoFrameCallback corta por timeupdate', async () => {
    const { video, objetivo } = crearVideo(false)
    const espera = esperarFinVideo(video, 20000)
    objetivo.currentTime = 9
    objetivo.dispatchEvent(new Event('timeupdate'))
    await expect(espera).resolves.toBe(true)
  })
})

describe('ventanaAdmiteVideo', () => {
  it('admite ventanas de ordenador habituales (16:9, 16:10 y ultrapanorámicas)', () => {
    expect(ventanaAdmiteVideo(1920, 1080)).toBe(true)
    expect(ventanaAdmiteVideo(1440, 900)).toBe(true)
    expect(ventanaAdmiteVideo(2560, 1080)).toBe(true)
  })

  it('admite justo la proporción mínima y no una pizca menos', () => {
    expect(ventanaAdmiteVideo(PROPORCION_MINIMA_VIDEO * 1000, 1000)).toBe(true)
    expect(ventanaAdmiteVideo(PROPORCION_MINIMA_VIDEO * 1000 - 1, 1000)).toBe(false)
  })

  it('admite ventanas algo más cuadradas, desde 1,2:1 (1280x900, 1024x768)', () => {
    expect(ventanaAdmiteVideo(1280, 900)).toBe(true)
    expect(ventanaAdmiteVideo(1024, 768)).toBe(true)
  })

  it('no admite ventanas casi cuadradas ni verticales', () => {
    expect(ventanaAdmiteVideo(1199, 1000)).toBe(false)
    expect(ventanaAdmiteVideo(1000, 1000)).toBe(false)
    expect(ventanaAdmiteVideo(412, 915)).toBe(false)
  })

  it('no admite ventanas anchas y bajas donde el papel quedaría por debajo del ancho mínimo', () => {
    expect(ventanaAdmiteVideo(1920, 400)).toBe(false)
    expect(ventanaAdmiteVideo(1920, 408)).toBe(false)
    expect(ventanaAdmiteVideo(1920, 409)).toBe(true)
    expect(ventanaAdmiteVideo(1200, 400)).toBe(false)
    expect(ventanaAdmiteVideo(2560, 1080)).toBe(true)
  })

  it('el mínimo de alto es justo el que da el ancho mínimo del papel', () => {
    const altoMinimo = ANCHO_MINIMO_PAPEL_PX / PAPEL_POR_ALTO
    expect(ANCHO_MINIMO_PAPEL_PX).toBe(600)
    expect(ventanaAdmiteVideo(2000, altoMinimo)).toBe(true)
    expect(ventanaAdmiteVideo(2000, altoMinimo - 0.5)).toBe(false)
  })

  it('no admite medidas imposibles (0, negativas, NaN, Infinity)', () => {
    expect(ventanaAdmiteVideo(1920, 0)).toBe(false)
    expect(ventanaAdmiteVideo(0, 1080)).toBe(false)
    expect(ventanaAdmiteVideo(-1920, 1080)).toBe(false)
    expect(ventanaAdmiteVideo(NaN, 1080)).toBe(false)
    expect(ventanaAdmiteVideo(1920, Infinity)).toBe(false)
  })
})
