import { describe, it, expect } from 'vitest'
import { updateById, removeById, touchById, findById, withExclusiveFlag } from '../entityHelpers'

describe('findById', () => {
  it('returns the matching item', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(findById(items, 'b')).toBe(items[1])
  })

  it('returns undefined when nothing matches', () => {
    expect(findById([{ id: 'a' }], 'missing')).toBeUndefined()
  })
})

describe('touchById', () => {
  it('merges the given data and stamps a fresh updatedAt, like updateById plus a timestamp', () => {
    const items = [{ id: 'a', name: 'old', updatedAt: '2020-01-01T00:00:00.000Z' }]
    const result = touchById(items, 'a', { name: 'new' })
    expect(result[0].name).toBe('new')
    expect(result[0].updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })

  it('leaves other items untouched', () => {
    const items = [
      { id: 'a', name: 'a', updatedAt: '2020-01-01T00:00:00.000Z' },
      { id: 'b', name: 'b', updatedAt: '2020-01-01T00:00:00.000Z' },
    ]
    const result = touchById(items, 'a', { name: 'changed' })
    expect(result[1]).toEqual(items[1])
  })
})

describe('withExclusiveFlag', () => {
  interface Flagged {
    id: string
    group: string | null
    isDefault: boolean
  }

  it('sets the flag on the target and clears it on every other member of the same group', () => {
    const items: Flagged[] = [
      { id: 'a', group: 'g1', isDefault: true },
      { id: 'b', group: 'g1', isDefault: false },
      { id: 'c', group: 'g1', isDefault: false },
    ]
    const result = withExclusiveFlag(items, 'b', (i) => i.group, 'isDefault')
    expect(result.map((i) => [i.id, i.isDefault])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ])
  })

  it('leaves items in a different group untouched', () => {
    const items: Flagged[] = [
      { id: 'a', group: 'g1', isDefault: true },
      { id: 'b', group: 'g2', isDefault: true },
    ]
    const result = withExclusiveFlag(items, 'a', (i) => i.group, 'isDefault')
    expect(result.find((i) => i.id === 'b')).toEqual(items[1])
  })

  it('returns the list unchanged when the target id does not exist', () => {
    const items: Flagged[] = [{ id: 'a', group: 'g1', isDefault: true }]
    expect(withExclusiveFlag(items, 'missing', (i) => i.group, 'isDefault')).toBe(items)
  })

  it('treats a target with no group as its own group of one', () => {
    const items: Flagged[] = [
      { id: 'a', group: null, isDefault: false },
      { id: 'b', group: null, isDefault: true },
      { id: 'c', group: 'g1', isDefault: true },
    ]
    const result = withExclusiveFlag(items, 'a', (i) => i.group, 'isDefault')
    // 'a' and 'b' share the null group, so 'b' loses the flag; 'c' is untouched.
    expect(result.map((i) => [i.id, i.isDefault])).toEqual([
      ['a', true],
      ['b', false],
      ['c', true],
    ])
  })
})

describe('updateById / removeById (existing behavior, unchanged)', () => {
  it('updateById merges a partial into the matching item only', () => {
    const items = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]
    expect(updateById(items, 'a', { n: 9 })).toEqual([{ id: 'a', n: 9 }, { id: 'b', n: 2 }])
  })

  it('removeById drops the matching item only', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(removeById(items, 'a')).toEqual([{ id: 'b' }])
  })
})
