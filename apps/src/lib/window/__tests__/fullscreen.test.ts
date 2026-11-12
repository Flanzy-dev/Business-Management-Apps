// Vitest's environment is 'node' (vite.config.ts), so window/document
// don't exist unless stubbed here — same reason src/lib/app/environment.ts's
// header gives for staying DOM-type-free. Each test stubs exactly the
// globals its scenario needs and vi.unstubAllGlobals() in afterEach keeps
// them from leaking between tests.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canToggleFullScreen, subscribeFullScreen, toggleFullScreen } from '../fullscreen'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubElectron(overrides: Partial<{
  toggleFullScreen: () => Promise<void>
  isFullScreen: () => Promise<boolean>
  onFullScreenChange: (cb: (on: boolean) => void) => () => void
}> = {}) {
  const electronAPI = {
    toggleFullScreen: vi.fn().mockResolvedValue(undefined),
    isFullScreen: vi.fn().mockResolvedValue(false),
    onFullScreenChange: vi.fn().mockReturnValue(vi.fn()),
    ...overrides,
  }
  vi.stubGlobal('window', { electronAPI })
  return electronAPI
}

function stubBrowserFullscreen({ fullscreenElement = null as unknown }: { fullscreenElement?: unknown } = {}) {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined)
  const exitFullscreen = vi.fn().mockResolvedValue(undefined)
  const listeners: Record<string, (() => void)[]> = {}
  const document = {
    documentElement: { requestFullscreen },
    fullscreenElement,
    exitFullscreen,
    addEventListener: vi.fn((type: string, handler: () => void) => {
      listeners[type] = [...(listeners[type] ?? []), handler]
    }),
    removeEventListener: vi.fn((type: string, handler: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler)
    }),
  }
  vi.stubGlobal('window', {})
  vi.stubGlobal('document', document)
  return { document, requestFullscreen, exitFullscreen, listeners }
}

describe('canToggleFullScreen / toggleFullScreen — Electron path', () => {
  it('reports supported and calls the bridge, never the DOM API', async () => {
    const electronAPI = stubElectron()
    const { requestFullscreen } = stubBrowserFullscreen()
    // stubBrowserFullscreen() above already stubbed window to {} — redo with
    // electronAPI attached so both bridge() and hasDomFullscreen() are live,
    // proving the Electron branch is preferred when both are available.
    vi.stubGlobal('window', { electronAPI })

    expect(canToggleFullScreen()).toBe(true)
    await toggleFullScreen()

    expect(electronAPI.toggleFullScreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).not.toHaveBeenCalled()
  })
})

describe('toggleFullScreen — browser fallback (no electronAPI)', () => {
  it('requests fullscreen when not currently fullscreen', async () => {
    const { requestFullscreen, exitFullscreen } = stubBrowserFullscreen({ fullscreenElement: null })

    expect(canToggleFullScreen()).toBe(true)
    await toggleFullScreen()

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('exits fullscreen when already fullscreen', async () => {
    const { requestFullscreen, exitFullscreen } = stubBrowserFullscreen({ fullscreenElement: {} })

    await toggleFullScreen()

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it('swallows a rejected requestFullscreen (e.g. called outside a user gesture)', async () => {
    const { document } = stubBrowserFullscreen({ fullscreenElement: null })
    ;(document.documentElement.requestFullscreen as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'))

    await expect(toggleFullScreen()).resolves.toBeUndefined()
  })
})

describe('neither Electron bridge nor DOM Fullscreen API available', () => {
  it('canToggleFullScreen is false and toggleFullScreen is a safe no-op', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', { documentElement: {} })

    expect(canToggleFullScreen()).toBe(false)
    await expect(toggleFullScreen()).resolves.toBeUndefined()
  })
})

describe('subscribeFullScreen', () => {
  it('primes the callback from isFullScreen(), then forwards onFullScreenChange pushes', async () => {
    let pushHandler: ((on: boolean) => void) | undefined
    const electronAPI = stubElectron({
      isFullScreen: vi.fn().mockResolvedValue(true),
      onFullScreenChange: vi.fn((cb: (on: boolean) => void) => {
        pushHandler = cb
        return vi.fn()
      }),
    })

    const cb = vi.fn()
    subscribeFullScreen(cb)
    await Promise.resolve()

    expect(cb).toHaveBeenCalledWith(true)
    pushHandler?.(false)
    expect(cb).toHaveBeenCalledWith(false)
    expect(electronAPI.onFullScreenChange).toHaveBeenCalledTimes(1)
  })

  it("unsubscribe stops a late isFullScreen() prime from reaching the callback", async () => {
    let resolveIsFullScreen: (v: boolean) => void = () => {}
    stubElectron({
      isFullScreen: vi.fn(() => new Promise<boolean>((resolve) => { resolveIsFullScreen = resolve })),
    })

    const cb = vi.fn()
    const unsubscribe = subscribeFullScreen(cb)
    unsubscribe()
    resolveIsFullScreen(true)
    await Promise.resolve()

    expect(cb).not.toHaveBeenCalled()
  })

  it('browser fallback: primes from document.fullscreenElement and tracks fullscreenchange', () => {
    const { document } = stubBrowserFullscreen({ fullscreenElement: null })

    const cb = vi.fn()
    const unsubscribe = subscribeFullScreen(cb)
    expect(cb).toHaveBeenCalledWith(false)

    ;(document as { fullscreenElement: unknown }).fullscreenElement = {}
    const handler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][1]
    handler()
    expect(cb).toHaveBeenCalledWith(true)

    unsubscribe()
    expect(document.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('neither path available: returns a no-op unsubscribe and never calls cb', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', { documentElement: {} })

    const cb = vi.fn()
    const unsubscribe = subscribeFullScreen(cb)

    expect(cb).not.toHaveBeenCalled()
    expect(() => unsubscribe()).not.toThrow()
  })
})
