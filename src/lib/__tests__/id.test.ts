import { describe, it, expect, afterEach, vi } from 'vitest'
import { newId } from '../id'

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
