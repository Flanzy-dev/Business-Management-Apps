import { describe, it, expect } from 'vitest'
import { resolveDeltaTone, deltaPrefix } from '../statCard'

describe('resolveDeltaTone', () => {
  it('is undefined with no baseline and no override', () => {
    expect(resolveDeltaTone(null)).toBeUndefined()
    expect(resolveDeltaTone(undefined)).toBeUndefined()
  })

  it('is "up" for a non-negative delta with no override', () => {
    expect(resolveDeltaTone(0)).toBe('up')
    expect(resolveDeltaTone(15)).toBe('up')
  })

  it('is "down" for a negative delta with no override', () => {
    expect(resolveDeltaTone(-5)).toBe('down')
  })

  it('a caller override always wins, even over a baseline', () => {
    expect(resolveDeltaTone(15, 'down')).toBe('down')
    expect(resolveDeltaTone(null, 'neutral')).toBe('neutral')
  })
})

describe('deltaPrefix', () => {
  it('is "+" only for a strictly positive delta', () => {
    expect(deltaPrefix(5)).toBe('+')
  })

  it('is blank for zero, negative, or absent', () => {
    expect(deltaPrefix(0)).toBe('')
    expect(deltaPrefix(-5)).toBe('')
    expect(deltaPrefix(null)).toBe('')
    expect(deltaPrefix(undefined)).toBe('')
  })
})
