// Escape on a confirm opened from inside another dialog must close only the
// confirm. These are the rules Dialog.tsx relies on to decide who answers keys.
import { afterEach, describe, expect, it } from 'vitest'
import { hasOpenDialog, isTopDialog, pushDialog, removeDialog } from '../app/dialogStack'

const form = {}
const confirm = {}

afterEach(() => {
  removeDialog(form)
  removeDialog(confirm)
})

describe('dialogStack', () => {
  it('lets a lone dialog handle keys', () => {
    pushDialog(form)
    expect(isTopDialog(form)).toBe(true)
  })

  it('gives the keys to the newest dialog only', () => {
    pushDialog(form)
    pushDialog(confirm)
    expect(isTopDialog(confirm)).toBe(true)
    expect(isTopDialog(form)).toBe(false)
  })

  it('hands the keys back once the top dialog closes', () => {
    pushDialog(form)
    pushDialog(confirm)
    removeDialog(confirm)
    expect(isTopDialog(form)).toBe(true)
  })

  it('copes with the lower dialog closing first', () => {
    pushDialog(form)
    pushDialog(confirm)
    removeDialog(form)
    expect(isTopDialog(confirm)).toBe(true)
    expect(hasOpenDialog()).toBe(true)
  })

  it('reports nothing open once every dialog is gone, and ignores a double remove', () => {
    pushDialog(form)
    removeDialog(form)
    removeDialog(form)
    expect(hasOpenDialog()).toBe(false)
    expect(isTopDialog(form)).toBe(false)
  })
})
