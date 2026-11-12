import { describe, expect, it } from 'vitest'
import { filterMatches, normalizeSearchText, searchMatch, searchTokens } from '../format/searchText'

const match = (text: string, query: string) => searchMatch(text, searchTokens(query))

describe('normalizeSearchText', () => {
  it.each([
    ['10/40', '10w40'],
    ['10W-40', '10w40'],
    ['10w40', '10w40'],
    ['10-40', '10w40'],
    ['10 - 40', '10w40'],
    ['0/20', '0w20'],
    ['15 / 40', '15w40'],
  ])('writes the grade %s one way', (typed, expected) => {
    expect(normalizeSearchText(typed)).toBe(expected)
  })

  it('keeps a grade that is still being typed comparable to the full one', () => {
    expect(normalizeSearchText('10/')).toBe('10w')
    expect(normalizeSearchText('10/4')).toBe('10w4')
    expect('10w40').toContain(normalizeSearchText('10/4'))
  })

  it.each([
    ['1 L', '1l'],
    ['1l', '1l'],
    ['1 lt', '1l'],
    ['4 Liter', '4l'],
    ['3,5 L', '3.5l'],
    ['3.5 L', '3.5l'],
  ])('writes the volume %s one way', (typed, expected) => {
    expect(normalizeSearchText(typed)).toBe(expected)
  })

  it('does not invent a grade out of SP/CF or a model code', () => {
    expect(normalizeSearchText('SP/CF')).toBe('sp/cf')
    expect(normalizeSearchText('4WD')).toBe('4wd')
  })

  it('leaves a phone number alone', () => {
    expect(normalizeSearchText('0812-3456-789')).toBe('0812-3456-789')
  })
})

describe('searchMatch — words in any order', () => {
  const castrol = 'Castrol GTX 10/40 1 L'

  it('finds a product by name and grade although other words sit between', () => {
    expect(match(castrol, 'castrol 10/40')).toBe('exact')
    expect(match(castrol, '10/40 castrol')).toBe('exact')
  })

  it('finds it however the grade and volume are written', () => {
    expect(match(castrol, 'gtx 10w40')).toBe('exact')
    expect(match(castrol, 'gtx 10-40 1l')).toBe('exact')
    expect(match(castrol, 'castrol 10w-40 1 liter')).toBe('exact')
  })

  it('finds it while the grade is half typed', () => {
    expect(match(castrol, 'castrol 10/4')).toBe('exact')
    expect(match(castrol, 'castrol 10/')).toBe('exact')
  })

  it('does not mix up grades or sizes', () => {
    expect(match(castrol, 'castrol 15/40')).toBeNull()
    expect(match(castrol, 'castrol 10/30')).toBeNull()
    expect(match(castrol, 'castrol 4l')).toBeNull()
  })

  it('needs every word', () => {
    expect(match(castrol, 'castrol shell')).toBeNull()
  })

  it('matches everything for a blank query', () => {
    expect(match(castrol, '   ')).toBe('exact')
  })
})

describe('searchMatch — near-miss spellings', () => {
  it('finds a brand typed with the wrong letter', () => {
    expect(match('Castrol GTX 10/40 1 L', 'kastrol')).toBe('fuzzy')
    expect(match('Castrol Magnatec 5/30', 'magnatek')).toBe('fuzzy')
  })

  it('finds a half-typed word that has a typo', () => {
    expect(match('Castrol Magnatec 5/30', 'magnet')).toBe('fuzzy')
  })

  it('treats a swapped pair of letters as one typo', () => {
    expect(match('Castrol Edge', 'catsrol')).toBe('fuzzy')
  })

  it('finds a name spelled the old way', () => {
    expect(match('Pak Sutomo', 'soetomo')).toBe('fuzzy')
    expect(match('Pak Santoso', 'santosa')).toBe('fuzzy')
  })

  it('stays exact when nothing was misspelled', () => {
    expect(match('Castrol GTX', 'castrol gtx')).toBe('exact')
  })

  it('is fuzzy when any one word needed it', () => {
    expect(match('Castrol GTX 10/40', 'kastrol 10/40')).toBe('fuzzy')
  })

  it('never fuzzy-matches short words, so "oli" does not find "olx"', () => {
    expect(match('Olx filter', 'oli')).toBeNull()
  })

  it('never fuzzy-matches anything with a digit (grades, sizes, plates, phones)', () => {
    expect(match('Castrol 10/40', '10w30')).toBeNull()
    expect(match('H 4321 AB', '4322')).toBeNull()
    expect(match('0812 3456 789', '0812 3456 780')).toBeNull()
  })

  it('does not match an unrelated word', () => {
    expect(match('Castrol GTX', 'pertamina')).toBeNull()
  })
})

describe('searchMatch — extra predicate', () => {
  it('lets the caller accept a token its own way', () => {
    const tokens = searchTokens('h4321')
    expect(searchMatch('H 4321 AB', tokens)).toBeNull()
    expect(searchMatch('H 4321 AB', tokens, (t) => 'h4321ab'.includes(t))).toBe('exact')
  })
})

describe('searchMatch — phone numbers', () => {
  it('finds a number typed without the dashes or spaces it was stored with', () => {
    expect(match('Budi 0812-555-1000', '08125551000')).toBe('exact')
    expect(match('Budi 0812 555 1000', '0812555')).toBe('exact')
  })

  it('finds a stored plain number typed with dashes', () => {
    expect(match('Budi 08125551000', '0812-555-1000')).toBe('exact')
  })

  it('still needs the right digits', () => {
    expect(match('Budi 0812-555-1000', '08125551001')).toBeNull()
  })

  it('works alongside words', () => {
    expect(match('Budi 0812-555-1000', 'budi 0812555')).toBe('exact')
  })
})

describe('filterMatches', () => {
  const items = [
    { id: 'a', kind: 'fuzzy' as const },
    { id: 'b', kind: 'exact' as const },
    { id: 'n', kind: null },
    { id: 'c', kind: 'fuzzy' as const },
    { id: 'd', kind: 'exact' as const },
  ]
  const ids = (list: { id: string }[]) => list.map((i) => i.id)

  it('puts near-misses after exact hits, keeps each group in order, and drops non-matches', () => {
    expect(ids(filterMatches(items, (i) => i.kind))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('for a sorted table, shows near-misses only when nothing matched exactly', () => {
    expect(ids(filterMatches(items, (i) => i.kind, 'onlyWhenNoExact'))).toEqual(['b', 'd'])
    const onlyTypos = items.filter((i) => i.kind !== 'exact')
    expect(ids(filterMatches(onlyTypos, (i) => i.kind, 'onlyWhenNoExact'))).toEqual(['a', 'c'])
  })
})
