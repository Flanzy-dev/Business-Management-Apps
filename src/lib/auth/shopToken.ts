// Generates the shared secret for the LAN sync server's optional token gate
// (see server/syncServer.ts's isAuthorized and src/lib/sync/hostConfig.ts).
// Formatted as short dash-separated groups, deliberately not base64 — it
// has to be read off one device's screen and typed into another's on-screen
// keyboard by hand, so there's no +, /, =, or easily-confused character in
// it. Excludes 0/O and 1/I/l for the same reason.
const GROUP_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'
const GROUP_LENGTH = 4
const GROUP_COUNT = 3

export function generateShopToken(): string {
  const groups: string[] = []
  for (let g = 0; g < GROUP_COUNT; g++) {
    const bytes = crypto.getRandomValues(new Uint8Array(GROUP_LENGTH))
    let group = ''
    for (const byte of bytes) group += GROUP_CHARS[byte % GROUP_CHARS.length]
    groups.push(group)
  }
  return groups.join('-')
}
