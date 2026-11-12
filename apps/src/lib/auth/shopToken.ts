// Generates the shared secret for the LAN sync server's optional token gate
// (see server/syncServer.ts's isAuthorized and src/lib/sync/hostConfig.ts).
// Formatted as short dash-separated groups via src/lib/auth/groupedCode.ts —
// see that module for why (has to be read off one screen and typed into
// another by hand).
import { generateGroupedCode } from './groupedCode'

const GROUP_LENGTH = 4
const GROUP_COUNT = 3

export function generateShopToken(): string {
  return generateGroupedCode(GROUP_LENGTH, GROUP_COUNT)
}
