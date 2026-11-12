// The renderer's side of "Search this WiFi": whether it can search at all, and
// that a search which finds nothing — or fails — is an ordinary empty answer,
// never an exception the pairing screen has to handle. (The UDP probe itself is
// tested in server/__tests__/discovery.test.ts.)
import { afterEach, describe, expect, it } from 'vitest'
import { canDiscoverHosts, findHosts, hostAddressFor, type DiscoveredHost } from '../sync/discovery'

type Bridge = { discoverHosts?: () => Promise<DiscoveredHost[]> }

/** Vitest runs in Node, which has no `window`; install the one property the module reads. */
function withBridge(bridge: Bridge | undefined) {
  ;(globalThis as { window?: unknown }).window = bridge === undefined ? {} : { electronAPI: bridge }
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

const host = (over: Partial<DiscoveredHost> = {}): DiscoveredHost => ({ address: '192.168.1.20', shopName: 'Bengkel Jaya', port: 5174, ...over })

describe('canDiscoverHosts', () => {
  it('is false outside a window altogether', () => {
    expect(canDiscoverHosts()).toBe(false)
  })

  it('is false in a browser tab, which has no bridge to the desktop shell', () => {
    withBridge(undefined)
    expect(canDiscoverHosts()).toBe(false)
  })

  it('is false in a desktop build too old to have the discovery bridge', () => {
    withBridge({})
    expect(canDiscoverHosts()).toBe(false)
  })

  it('is true when the bridge exists', () => {
    withBridge({ discoverHosts: async () => [] })
    expect(canDiscoverHosts()).toBe(true)
  })
})

describe('findHosts', () => {
  it('returns whichever hosts answered', async () => {
    withBridge({ discoverHosts: async () => [host(), host({ address: '192.168.1.31', shopName: null })] })
    expect(await findHosts()).toHaveLength(2)
  })

  it('answers "nothing found" — not an error — when nobody replied', async () => {
    withBridge({ discoverHosts: async () => [] })
    expect(await findHosts()).toEqual([])
  })

  it('answers "nothing found" when it cannot search at all', async () => {
    expect(await findHosts()).toEqual([])
    withBridge(undefined)
    expect(await findHosts()).toEqual([])
  })

  it('swallows a failing search and leaves the manual address field as the way forward', async () => {
    withBridge({
      discoverHosts: async () => {
        throw new Error('EACCES: broadcast not permitted')
      },
    })
    await expect(findHosts()).resolves.toEqual([])
  })

  it('ignores a reply that is not a list', async () => {
    withBridge({ discoverHosts: (async () => ({ hosts: [host()] })) as unknown as () => Promise<DiscoveredHost[]> })
    expect(await findHosts()).toEqual([])
  })
})

describe('hostAddressFor', () => {
  it('is a bare IP on the default port — what someone would have typed by hand', () => {
    expect(hostAddressFor(host())).toBe('192.168.1.20')
  })

  it('carries a non-default port', () => {
    expect(hostAddressFor(host({ port: 8080 }))).toBe('192.168.1.20:8080')
  })
})
