import { describe, it, expect, afterEach, vi } from 'vitest'
import { newId, seededId } from '../id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const realCrypto = globalThis.crypto

/**
 * Replace globalThis.crypto for one test. It is a non-writable accessor in
 * Node, so plain assignment silently fails — defineProperty is required.
 */
function stubCrypto(value: unknown) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  stubCrypto(realCrypto)
})

describe('newId', () => {
  it('returns a well-formed v4 uuid', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('returns distinct ids', () => {
    const ids = new Set(Array.from({ length: 500 }, newId))
    expect(ids.size).toBe(500)
  })

  it('uses crypto.randomUUID when the context allows it', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    stubCrypto({ randomUUID, getRandomValues: realCrypto.getRandomValues.bind(realCrypto) })

    expect(newId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  // The reason this module exists: over plain http on a LAN address the page is
  // not a secure context and randomUUID is absent, so it must never be called.
  it('falls back to getRandomValues when randomUUID is missing', () => {
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      arr.fill(0xab)
      return arr
    })
    stubCrypto({ getRandomValues })

    const id = newId()
    expect(getRandomValues).toHaveBeenCalledOnce()
    expect(id).toMatch(UUID_V4)
    // Version and variant nibbles are forced even though every byte was 0xab.
    expect(id[14]).toBe('4')
    expect(id[19]).toBe('a')
  })

  it('still produces a valid uuid with no WebCrypto at all', () => {
    stubCrypto(undefined)
    expect(newId()).toMatch(UUID_V4)
  })
})

// The reason this exists: DEFAULT_SERVICE_ITEM_TYPES/DEFAULT_PRODUCT_CATEGORIES
// (serviceItemTypeStore.ts, productCategoryStore.ts) reseed from scratch on
// every launch that finds nothing persisted yet — every launch, until a shop
// happens to rename/add/delete one — so their ids MUST be the same across
// repeated calls, unlike newId's.
describe('seededId', () => {
  it('is deterministic — the same namespace+name always produces the same id', () => {
    expect(seededId('service-item-type', 'Oli Mesin')).toBe(seededId('service-item-type', 'Oli Mesin'))
  })

  it('differs by name within the same namespace', () => {
    expect(seededId('service-item-type', 'Oli Mesin')).not.toBe(seededId('service-item-type', 'Filter Oli'))
  })

  it('differs by namespace for the same name, so two stores never collide', () => {
    expect(seededId('service-item-type', 'Gemuk')).not.toBe(seededId('product-category', 'Gemuk'))
  })

  it('is not a valid v4 uuid — distinguishable at a glance from a real newId()', () => {
    expect(seededId('service-item-type', 'Oli Mesin')).not.toMatch(UUID_V4)
  })
})
