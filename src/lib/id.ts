// Entity id generation.
//
// `crypto.randomUUID()` is restricted to *secure contexts*. Electron and
// `http://localhost` qualify, but a plain-http non-localhost origin does not —
// there the method is simply absent, and calling it unguarded throws at
// module-import time and blanks the whole app.
//
// `crypto.getRandomValues()` carries no such restriction, so the fallback is
// still cryptographically random; only the last resort is not.

/** RFC 4122 version 4 UUID, safe in insecure contexts. */
export function newId(): string {
  const webCrypto = globalThis.crypto

  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes)
  } else {
    // No WebCrypto at all. Not collision-safe in the cryptographic sense, but
    // this app generates ids at human speed on a single shop's data set.
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  )
}
