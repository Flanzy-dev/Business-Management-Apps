// The mirror-image operation of downloadFile.ts: hand the browser's native
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
