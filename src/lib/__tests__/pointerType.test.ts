// isTouchClick decides whether rowInteraction.ts's double-click deferral can
// skip its 250ms wait. Get the desktop-preservation half wrong and every
// mouse click on an expandable row would either lose its double-click
// cancellation window or (worse) silently start acting immediately, changing
// behavior nobody asked to change. See src/lib/pointerType.ts's header.
import { describe, it, expect } from 'vitest'
import { readPointerKind, isTouchClick, type PointerKind } from '../pointerType'

describe('readPointerKind', () => {
  it('reads touch and mouse straight through', () => {
    expect(readPointerKind({ pointerType: 'touch' })).toBe('touch')
    expect(readPointerKind({ pointerType: 'mouse' })).toBe('mouse')
  })

  it('null for a pen — deliberately not treated as touch', () => {
    expect(readPointerKind({ pointerType: 'pen' })).toBeNull()
  })

  it("null for Safari's empty-string pointerType", () => {
    expect(readPointerKind({ pointerType: '' })).toBeNull()
  })

  it('null for a plain MouseEvent-shaped click (no pointerType at all)', () => {
    expect(readPointerKind({})).toBeNull()
    expect(readPointerKind(undefined)).toBeNull()
    expect(readPointerKind(null)).toBeNull()
  })
})

describe('isTouchClick', () => {
  it("true when the click's own pointerType says touch, regardless of the pointerdown fallback", () => {
    expect(isTouchClick({ pointerType: 'touch' }, null)).toBe(true)
    expect(isTouchClick({ pointerType: 'touch' }, 'mouse')).toBe(true)
  })

  it("false when the click's own pointerType says mouse, even if the pointerdown fallback says touch", () => {
    expect(isTouchClick({ pointerType: 'mouse' }, 'touch')).toBe(false)
  })

  it('falls back to the pointerdown-tracked kind when the click itself is unreadable (Safari)', () => {
    expect(isTouchClick({ pointerType: '' }, 'touch')).toBe(true)
    expect(isTouchClick({ pointerType: '' }, 'mouse')).toBe(false)
    expect(isTouchClick({}, 'touch')).toBe(true)
    expect(isTouchClick(undefined, 'touch')).toBe(true)
  })

  it('false with no signal anywhere (no click info, no prior pointerdown)', () => {
    expect(isTouchClick(undefined, null)).toBe(false)
    expect(isTouchClick({}, null)).toBe(false)
  })

  it('a keyboard/programmatic click (detail === 0) never counts as touch, even with a stale touch pointerdown', () => {
    expect(isTouchClick({ detail: 0 }, 'touch')).toBe(false)
    expect(isTouchClick({ pointerType: '', detail: 0 }, 'touch')).toBe(false)
  })

  it('a pen click falls through to the pointerdown fallback like any unreadable click', () => {
    expect(isTouchClick({ pointerType: 'pen' }, 'touch')).toBe(true)
    expect(isTouchClick({ pointerType: 'pen' }, 'mouse')).toBe(false)
  })

  describe('desktop preservation: every non-touch combination stays false', () => {
    const clicks: ({ pointerType?: string; detail?: number } | null | undefined)[] = [
      { pointerType: 'mouse' },
      { pointerType: 'pen' },
      { pointerType: '' },
      {},
      undefined,
      null,
      { detail: 1 },
    ]
    const lastKinds: (PointerKind | null)[] = ['mouse', null]

    for (const click of clicks) {
      for (const lastKind of lastKinds) {
        it(`click=${JSON.stringify(click)} lastKind=${lastKind} -> false`, () => {
          expect(isTouchClick(click, lastKind)).toBe(false)
        })
      }
    }
  })
})
