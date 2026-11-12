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

/**
 * Deterministic id for one of a store's fixed, hardcoded seed rows (see
 * DEFAULT_SERVICE_ITEM_TYPES in src/store/serviceItemTypeStore.ts and
 * DEFAULT_PRODUCT_CATEGORIES in src/store/productCategoryStore.ts) — every
 * fresh seed (a brand-new device, a cleared store, a dev reload that
 * re-evaluates the module) must produce the exact same id for the exact same
 * seed name, every time, or every reference to it (ScheduleRule.itemTypeId,
 * ProductCategory.serviceItemTypeId, …) silently orphans the moment the seed
 * is ever regenerated. That regeneration is not a rare edge case: zustand's
 * `persist` only writes to storage on a real mutation (an add/rename/delete),
 * never on the initial default state, so a store nobody has ever edited
 * re-seeds from scratch — with `newId()`'s fresh random ids — on every single
 * launch.
 *
 * Not a hash: these seed lists are small, fixed, and known ahead of time, so
 * a readable slug is exactly as stable and reads better in a stored blob or
 * a debugger. `namespace` keeps two different stores' seeds (item types vs.
 * product categories) from ever colliding on a shared name.
 */
export function seededId(namespace: string, name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `seed:${namespace}:${slug}`
}
