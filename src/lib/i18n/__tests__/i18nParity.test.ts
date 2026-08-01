import { describe, it, expect } from 'vitest'
import { en } from '../en'
import { id } from '../id'

// id.ts declares `export const id: typeof en = {...}`, which already makes
// a key present in en.ts but missing from id.ts a compile error. That
// annotation does NOT, on its own, guarantee the reverse — a key added to
// id.ts's literal that en.ts doesn't have — is caught the same way in every
// TypeScript configuration, nor does it catch a leaf value changing shape
// (e.g. a string becoming an object). This is the runtime safety net for
// both, independent of tsc: it walks every leaf path in both dictionaries
// and asserts the sets and the leaf types match exactly. Relevant here
// because the sync i18n block (40 keys) has been added and removed from
// both files together across this repo's history — a test is what makes a
// future one-sided edit fail loudly instead of shipping a raw key to a
// shop's Indonesian-language screen.

function leafPaths(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  const paths: string[] = []
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    paths.push(...leafPaths(value, prefix ? `${prefix}.${key}` : key))
  }
  return paths
}

function leafType(node: unknown, path: string): string {
  const parts = path.split('.')
  let current: unknown = node
  for (const part of parts) {
    current = (current as Record<string, unknown>)?.[part]
  }
  return typeof current
}

describe('i18n en/id parity', () => {
  it('has exactly the same set of leaf key-paths in both dictionaries', () => {
    const enPaths = new Set(leafPaths(en))
    const idPaths = new Set(leafPaths(id))

    const missingFromId = [...enPaths].filter((p) => !idPaths.has(p))
    const extraInId = [...idPaths].filter((p) => !enPaths.has(p))

    expect(missingFromId).toEqual([])
    expect(extraInId).toEqual([])
  })

  it('has the same leaf value type at every shared path (no string-vs-object drift)', () => {
    for (const path of leafPaths(en)) {
      expect(leafType(id, path)).toBe(leafType(en, path))
    }
  })

  it('has no empty-string translation on either side', () => {
    // A blank string isn't a compile error but is always a mistake here —
    // every real key should have real copy in both languages.
    function leafValue(node: unknown, path: string): unknown {
      return path.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], node)
    }
    for (const path of leafPaths(en)) {
      expect(leafValue(en, path)).not.toBe('')
      expect(leafValue(id, path)).not.toBe('')
    }
  })
})
