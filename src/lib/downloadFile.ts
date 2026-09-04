// Hand a generated file to the browser's downloader — backup JSON, product
// CSV. Extracted out of src/pages/Settings.tsx (its original, still only,
// caller before this) so src/components/ErrorBoundary.tsx's "Download
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
