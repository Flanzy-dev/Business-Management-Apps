// Small related modules kept in one file, one section each with its original notes: downloadFile,
// pickJsonFile, pickTextFile, openExternal.

// ---- downloadFile ----

// Hand a generated file to the browser's downloader — backup JSON, product
// CSV. Extracted out of src/pages/Settings.tsx (its original, still only,
// caller before this) so src/components/layout/ErrorBoundary.tsx's "Download
// backup" recovery action can use the exact same download mechanism instead
// of a second copy.
export function downloadFile(contents: string, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---- pickJsonFile ----

// The mirror-image operation of files.ts: hand the browser's native
// file picker a JSON file and get the parsed object back. Was hand-duplicated
// between Settings.tsx's restore flow and LoginScreen.tsx's recovery flow —
// neither copy handled reader.onerror, so a read failure (permissions, a
// removed drive) silently did nothing; this closes that gap in both places
// at once.
export function pickJsonFile(onLoaded: (data: Record<string, unknown>) => void, onInvalid: () => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onerror = onInvalid
    reader.onload = (event) => {
      try {
        onLoaded(JSON.parse(event.target?.result as string))
      } catch {
        onInvalid()
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

// ---- pickTextFile ----

// Ask the user for one text file and hand back its contents — the DOM half
// every CSV import shares (products, services, the Excel history). The parse
// and plan halves stay with each importer; this only owns the file dialog.
//
// `onText` gets null when the file couldn't be read. It is not called at all
// when the user cancels the dialog — there's nothing to report.
export function pickTextFile(accept: string, onText: (text: string | null) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onerror = () => onText(null)
    reader.onload = (event) => {
      const text = event.target?.result
      onText(typeof text === 'string' ? text : null)
    }
    reader.readAsText(file)
  }
  input.click()
}

/** The accept filter every CSV import uses. */
export const CSV_ACCEPT = '.csv,text/csv'

// ---- openExternal ----

// tel:/wa.me links need the OS's own handler, not the renderer's own
// navigation (Electron denies non-http(s) and cross-origin navigation by
// default) — see electron/main.ts's 'open-external' handler.
export function openExternalLink(url: string): void {
  if (typeof window === 'undefined') return
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url)
  else window.open(url, '_blank') // browser dev mode — tel:/wa.me work natively
}
