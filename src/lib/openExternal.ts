// tel:/wa.me links need the OS's own handler, not the renderer's own
// navigation (Electron denies non-http(s) and cross-origin navigation by
// default) — see electron/main.ts's 'open-external' handler.
export function openExternalLink(url: string): void {
  if (typeof window === 'undefined') return
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url)
  else window.open(url, '_blank') // browser dev mode — tel:/wa.me work natively
}
