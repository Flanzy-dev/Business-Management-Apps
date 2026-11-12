import { describe, it, expect } from 'vitest'
import { parseDiscoveryReply } from '../discovery'

// parseDiscoveryReply is the validation logic behind discoverHosts's
// socket.on('message', ...) handler (server/discovery.ts) — extracted so it
// can be tested directly, without a real UDP socket. Before this it had no
// test coverage at all; fallow's health check flagged it as both complex
// (cyclomatic 10 in 15 lines) and genuinely untested (coverage_tier: none),
// unlike most of this project's other complexity findings, which are a
// zero-React-coverage measurement artifact — this one was a real gap.

function reply(body: Record<string, unknown>): Buffer {
  return Buffer.from(JSON.stringify(body), 'utf8')
}

describe('parseDiscoveryReply', () => {
  it('rejects a datagram larger than MAX_DATAGRAM_BYTES', () => {
    const oversized = Buffer.alloc(513, 'a')
    expect(parseDiscoveryReply(oversized)).toBeNull()
  })

  it('rejects a non-JSON datagram', () => {
    expect(parseDiscoveryReply(Buffer.from('not json', 'utf8'))).toBeNull()
  })

  it('rejects a datagram with the wrong magic', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SOMETHING-ELSE', shopName: 'Shop', port: 5174 }))).toBeNull()
  })

  it('rejects a datagram with no magic at all', () => {
    expect(parseDiscoveryReply(reply({ shopName: 'Shop', port: 5174 }))).toBeNull()
  })

  it('parses a valid reply with a shop name and port', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: 'Surya Baru', port: 5174 }))).toEqual({
      shopName: 'Surya Baru',
      port: 5174,
    })
  })

  it('normalizes a missing shopName to null', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', port: 5174 }))).toEqual({
      shopName: null,
      port: 5174,
    })
  })

  it('normalizes a whitespace-only shopName to null', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: '   ', port: 5174 }))).toEqual({
      shopName: null,
      port: 5174,
    })
  })

  it('falls back to port 5174 for a non-integer port', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: null, port: 5174.5 }))).toEqual({
      shopName: null,
      port: 5174,
    })
  })

  it('falls back to port 5174 for an out-of-range port', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: null, port: 70000 }))).toEqual({
      shopName: null,
      port: 5174,
    })
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: null, port: 0 }))).toEqual({
      shopName: null,
      port: 5174,
    })
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: null, port: -1 }))).toEqual({
      shopName: null,
      port: 5174,
    })
  })

  it('falls back to port 5174 when port is missing entirely', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: null }))).toEqual({
      shopName: null,
      port: 5174,
    })
  })

  it('coerces a numeric-string port', () => {
    expect(parseDiscoveryReply(reply({ magic: 'SURYA-HOST-1', shopName: null, port: '8080' }))).toEqual({
      shopName: null,
      port: 8080,
    })
  })
})
