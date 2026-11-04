import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SOBRE_QUIETO_S,
  VIDEO_APERTURA,
  esperarEvento,
  esperarMomentoVideo,
  momentoAlcanzado,
  topeFin,
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

describe('VIDEO_APERTURA', () => {
  it('apunta al vídeo del sobre', () => {
    expect(VIDEO_APERTURA).toBe('/video/sobre.mp4')
  })
})

describe('momentoAlcanzado', () => {
  it('el momento del sobre quieto es 1,4 s', () => {
    expect(SOBRE_QUIETO_S).toBe(1.4)
  })

  it('es false justo antes del momento y true en él y después', () => {
    expect(momentoAlcanzado(1.39, SOBRE_QUIETO_S)).toBe(false)
    expect(momentoAlcanzado(1.4, SOBRE_QUIETO_S)).toBe(true)
    expect(momentoAlcanzado(3.04, SOBRE_QUIETO_S)).toBe(true)
  })

  it.each([NaN, -Infinity, Infinity])('con tiempo actual %s es false', (actual) => {
    expect(momentoAlcanzado(actual, 1.4)).toBe(false)
  })

  it.each([NaN, Infinity])('con momento %s es false', (momento) => {
    expect(momentoAlcanzado(2, momento)).toBe(false)
  })
})

describe('esperarMomentoVideo', () => {
  /** Vídeo falso: EventTarget con duración, tiempo y rVFC simulados (los pendientes quedan en `pendientes`). */
  function crearVideo(conRvfc = true) {
    const video = new EventTarget() as EventTarget & Record<string, unknown>
    const pendientes = new Map<number, () => void>()
    let siguiente = 1
    video.duration = 3.04
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
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    expect(pendientes.size).toBe(1)
    objetivo.currentTime = 1.4
    fotograma()
    await expect(espera).resolves.toBe(true)
    expect(pendientes.size).toBe(0)
  })

  it('mientras no llega el corte, el rVFC se vuelve a armar', () => {
    const { video, objetivo, pendientes, fotograma } = crearVideo()
    void esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.currentTime = 1.3
    fotograma()
    expect(pendientes.size).toBe(1)
  })

  it('timeupdate o ended posteriores a resolver no hacen nada', async () => {
    const { video, objetivo, pedir, cancelar, fotograma } = crearVideo()
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.currentTime = 1.4
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
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.currentTime = 1.4
    objetivo.dispatchEvent(new Event('timeupdate'))
    fotograma()
    fotograma()
    await expect(espera).resolves.toBe(true)
    expect(cancelar.mock.calls.length).toBeLessThanOrEqual(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('un fotograma que llega tras resolver por timeupdate no re-arma el callback', async () => {
    const { video, objetivo, pendientes, pedir } = crearVideo()
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    const cb = [...pendientes.values()][0]
    objetivo.currentTime = 1.4
    objetivo.dispatchEvent(new Event('timeupdate'))
    await espera
    const antes = pedir.mock.calls.length
    cb?.()
    expect(pedir.mock.calls.length).toBe(antes)
    expect(pendientes.size).toBe(0)
  })

  it('resuelve true con ended y limpia', async () => {
    const { video, objetivo, pendientes } = crearVideo()
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.dispatchEvent(new Event('ended'))
    await expect(espera).resolves.toBe(true)
    expect(pendientes.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resuelve false con error y limpia', async () => {
    const { video, objetivo, pendientes } = crearVideo()
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.dispatchEvent(new Event('error'))
    await expect(espera).resolves.toBe(false)
    expect(pendientes.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('resuelve false al vencer el tope y limpia', async () => {
    const { video, pendientes } = crearVideo()
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(espera).resolves.toBe(false)
    expect(pendientes.size).toBe(0)
  })

  it('sin requestVideoFrameCallback corta por timeupdate', async () => {
    const { video, objetivo } = crearVideo(false)
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.currentTime = 1.4
    objetivo.dispatchEvent(new Event('timeupdate'))
    await expect(espera).resolves.toBe(true)
  })

  it('sin duración conocida igualmente corta al llegar al momento', async () => {
    const { video, objetivo } = crearVideo()
    objetivo.duration = NaN
    const espera = esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000)
    objetivo.currentTime = 1.4
    objetivo.dispatchEvent(new Event('timeupdate'))
    await expect(espera).resolves.toBe(true)
  })

  it('antes del momento, timeupdate no resuelve', async () => {
    const { video, objetivo } = crearVideo()
    let resultado: boolean | undefined
    void esperarMomentoVideo(video, SOBRE_QUIETO_S, 20000).then((v) => {
      resultado = v
    })
    objetivo.currentTime = 1.39
    objetivo.dispatchEvent(new Event('timeupdate'))
    await vi.advanceTimersByTimeAsync(10)
    expect(resultado).toBeUndefined()
  })
})
