// Shared generator for the app's two dash-grouped, hand-typeable secrets —
// src/lib/auth/shopToken.ts's LAN sync token and src/lib/auth/recoveryCode.ts's
// admin recovery code. Both need to be read off one device's screen (or a
// piece of paper) and typed into another, so the alphabet deliberately
// excludes +, /, =, and the easily-confused 0/O and 1/I/l — a decision that
// belongs in exactly one place so the two secrets can't quietly drift onto
// different (and differently confusable) character sets.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function generateGroupedCode(groupLength: number, groupCount: number): string {
  const groups: string[] = []
  for (let g = 0; g < groupCount; g++) {
    const bytes = crypto.getRandomValues(new Uint8Array(groupLength))
    let group = ''
    for (const byte of bytes) group += ALPHABET[byte % ALPHABET.length]
    groups.push(group)
  }
  return groups.join('-')
}
