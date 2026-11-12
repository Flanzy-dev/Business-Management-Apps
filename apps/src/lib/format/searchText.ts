// How a typed search is compared with a row's text. Shared by every box that
// looks a product, a service or a car up, so they agree about what "matches".
//
// Three things a counter hand relies on that a plain `text.includes(query)`
// cannot do:
//   1. Words in any order, not one contiguous string: "castrol 10/40" finds
//      "Castrol GTX 10/40 1 L" even though "GTX" sits between the words.
//   2. The same oil grade or volume however it is written: 10/40, 10W-40,
//      10w40 and "10 - 40" are one grade; "1 L", "1l", "1 liter" are one volume;
//      "3,5 L" is 3.5 l.
//   3. Near-misses: "kastrol" finds Castrol, "santosa" finds Santoso. Fuzzy hits
//      are reported as such so callers can rank them below exact ones and never
//      auto-act on one (a typo must not add the wrong product to a ticket).
//
// Pure — no stores, no hooks.

export type MatchKind = 'exact' | 'fuzzy'

/** Oil grade "10w40": digits, a separator (w, w-, /, -), digits. A grade still
 *  being typed ("10/", "10w", "10/4") normalizes the same way, so a result does
 *  not vanish in the middle of typing it. */
const GRADE = /\b(\d{1,2})\s*(?:w\s*-?\s*|\/\s*|-\s*)(\d{0,3})(?!\d)/g
/** Volume "1 L", "3,5 lt", "4 liter" → "1l", "3.5l". */
const VOLUME = /\b(\d+(?:[.,]\d+)?)\s*(?:liter|litre|ltr|lt|l)\b/g

/** Lowercase, with grades and volumes written one canonical way. Applied to
 *  the query and to the row's text alike, so both sides always agree. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(GRADE, (_m, a: string, b: string) => `${a}w${b}`)
    .replace(VOLUME, (_m, n: string) => `${n.replace(',', '.')}l`)
    .replace(/\s+/g, ' ')
    .trim()
}

// The query is re-tokenized for every row on every keystroke; remembering the
// last one makes that a single comparison per row.
let lastQuery: string | null = null
let lastTokens: string[] = []

/** The normalized query, split into words. A blank query has none. */
export function searchTokens(query: string): string[] {
  if (query === lastQuery) return lastTokens
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean)
  lastQuery = query
  lastTokens = tokens
  return tokens
}

/** Old Indonesian spellings and ph/f, folded so "Soetomo" ≈ "Sutomo". Only
 *  used for the fuzzy comparison — never to decide an exact hit. */
function foldSpelling(word: string): string {
  return word.replace(/oe/g, 'u').replace(/dj/g, 'j').replace(/tj/g, 'c').replace(/ph/g, 'f')
}

/** Typos allowed for a token of this length. Short words and anything with a
 *  digit (a grade, a volume, a plate, a phone number) are exact-only: 10w40 must
 *  never find 10w30, nor one plate a neighbouring one. */
function typoBudget(token: string): number {
  if (/\d/.test(token)) return 0
  if (token.length >= 7) return 2
  if (token.length >= 4) return 1
  return 0
}

/** Optimal-string-alignment distance (a swap of neighbours counts as 1), giving
 *  up as soon as it must exceed `limit`. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev2: number[] = []
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1)
      row.push(d)
      if (d < rowMin) rowMin = d
    }
    if (rowMin > limit) return limit + 1
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

/** Does `token` sound like one of the words — or the start of one, so a
 *  half-typed word with a typo ("magnat" for "magnatec") still hits? */
function fuzzyHit(token: string, words: string[]): boolean {
  const budget = typoBudget(token)
  if (budget === 0) return false
  const folded = foldSpelling(token)
  for (const word of words) {
    const w = foldSpelling(word)
    if (editDistance(folded, w, budget) <= budget) return true
    if (w.length > folded.length) {
      for (let len = folded.length - 1; len <= folded.length + 1; len++) {
        if (len > 0 && editDistance(folded, w.slice(0, len), budget) <= budget) return true
      }
    }
  }
  return false
}

/**
 * How `tokens` (from searchTokens) match `text`: every token must be found, in
 * any order. 'exact' when each is a plain substring (or satisfied by `extra`),
 * 'fuzzy' when at least one only matched as a near-miss, null when one is
 * missing. No tokens matches everything exactly.
 *
 * `extra` lets a caller accept a token its own way — a car's plate matches
 * "h4321" although the stored text is "H 4321 AB".
 */
export function searchMatch(text: string, tokens: string[], extra?: (token: string) => boolean): MatchKind | null {
  if (tokens.length === 0) return 'exact'
  const haystack = normalizeSearchText(text)
  let words: string[] | null = null
  let compact: string | null = null
  let kind: MatchKind = 'exact'
  for (const token of tokens) {
    if (haystack.includes(token) || extra?.(token)) continue
    // A phone number typed without its dashes or spaces ("08125551000") is
    // still the number stored as "0812-555-1000". Digits only ever match
    // exactly — never as a near miss.
    if (NUMBER_LIKE.test(token)) {
      compact ??= haystack.replace(DIGIT_GAPS, '')
      if (compact.includes(token.replace(NON_DIGITS, ''))) continue
      return null
    }
    words ??= haystack.split(/[^a-z0-9]+/).filter(Boolean)
    if (!fuzzyHit(token, words)) return null
    kind = 'fuzzy'
  }
  return kind
}

/** A token made of digits and the separators people put in numbers. */
const NUMBER_LIKE = /^(?=.*\d)[\d\s.\-/()+]+$/
/** Separators between two digits — removed so "0812-555" reads as "0812555". */
const DIGIT_GAPS = /(?<=\d)[\s.\-/()]+(?=\d)/g
const NON_DIGITS = /\D/g

/**
 * The items matching, by `kindOf` (null = no match). For a list in its own
 * order (a catalog, a dropdown): exact hits first, near-misses after them.
 * For a table the user sorts by column, where "after" means nothing:
 * `nearMisses: 'onlyWhenNoExact'` shows the near-misses only when nothing
 * matched exactly, so a typo still finds something but never clutters a
 * search that already worked.
 */
export function filterMatches<T>(
  items: T[],
  kindOf: (item: T) => MatchKind | null,
  nearMisses: 'after' | 'onlyWhenNoExact' = 'after'
): T[] {
  const exact: T[] = []
  const fuzzy: T[] = []
  for (const item of items) {
    const kind = kindOf(item)
    if (kind === 'exact') exact.push(item)
    else if (kind === 'fuzzy') fuzzy.push(item)
  }
  if (nearMisses === 'onlyWhenNoExact') return exact.length > 0 ? exact : fuzzy
  return fuzzy.length === 0 ? exact : [...exact, ...fuzzy]
}
