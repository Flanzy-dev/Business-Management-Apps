import { describe, expect, it } from 'vitest'
import { resolveShortcut } from '../app/navigation'

const ROUTES = new Map([['1', '/customers'], ['d', '/']])
const base = { mod: true, typing: false, dialogOpen: false }

describe('resolveShortcut', () => {
  it('maps Ctrl+K to search and Ctrl+<key> to its route', () => {
    expect(resolveShortcut({ ...base, key: 'k' }, ROUTES)).toEqual({ type: 'search' })
    expect(resolveShortcut({ ...base, key: 'K' }, ROUTES)).toEqual({ type: 'search' })
    expect(resolveShortcut({ ...base, key: '1' }, ROUTES)).toEqual({ type: 'route', path: '/customers' })
    expect(resolveShortcut({ ...base, key: 'x' }, ROUTES)).toBeNull()
  })

  it('works while typing, since dialogs autofocus their first field', () => {
    expect(resolveShortcut({ ...base, typing: true, key: '1' }, ROUTES)).toEqual({ type: 'route', path: '/customers' })
  })

  it('ignores leaving shortcuts inside an open dialog, but keeps Ctrl+N', () => {
    const inDialog = { ...base, dialogOpen: true }
    expect(resolveShortcut({ ...inDialog, key: '1' }, ROUTES)).toBeNull()
    expect(resolveShortcut({ ...inDialog, key: 'k' }, ROUTES)).toBeNull()
    expect(resolveShortcut({ ...inDialog, key: 'n' }, ROUTES)).toEqual({ type: 'newOrder' })
  })

  it('opens help on "?" only outside fields and dialogs', () => {
    const plain = { mod: false, typing: false, dialogOpen: false, key: '?' }
    expect(resolveShortcut(plain, ROUTES)).toEqual({ type: 'help' })
    expect(resolveShortcut({ ...plain, typing: true }, ROUTES)).toBeNull()
    expect(resolveShortcut({ ...plain, dialogOpen: true }, ROUTES)).toBeNull()
    expect(resolveShortcut({ ...plain, key: '1' }, ROUTES)).toBeNull()
  })
})
