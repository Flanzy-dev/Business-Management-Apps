import { useCallback, useEffect, useState } from 'react'
import { canToggleFullScreen, subscribeFullScreen, toggleFullScreen } from '../lib/window/fullscreen'

/**
 * Fullscreen state for the topbar button — see src/lib/window/fullscreen.ts
 * for the Electron-IPC-vs-DOM-Fullscreen-API split this sits on top of.
 * `supported` is false on a browser exposing neither path, so the button can
 * hide instead of sitting there dead.
 */
export function useFullScreen(): { supported: boolean; isFullScreen: boolean; toggle: () => void } {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const supported = canToggleFullScreen()

  useEffect(() => {
    if (!supported) return
    return subscribeFullScreen(setIsFullScreen)
  }, [supported])

  const toggle = useCallback(() => {
    void toggleFullScreen()
  }, [])

  return { supported, isFullScreen, toggle }
}
