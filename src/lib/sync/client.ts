// Thin fetch wrapper for the sync server's /api routes (server/syncServer.ts,
// embedded in electron/main.ts or run standalone). No retry/backoff or
// offline handling here — src/lib/sync/engine.ts owns that, since it's the
// one that knows what "offline" should look like to the rest of the app.
import type { SyncOp, SyncOpWithSeq } from './types'

/** Thrown for a 401 specifically, so callers (engine.ts) can tell "wrong or
 *  missing shop password" apart from every other failure — see
 *  src/store/syncStatusStore.ts's 'unauthorized' phase. */
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized')
    this.name = 'UnauthorizedError'
  }
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { 'x-shop-token': token } : {}
}

async function checkAuth(res: Response): Promise<void> {
  if (res.status === 401) throw new UnauthorizedError()
}

export interface SnapshotResponse {
  data: Record<string, string>
  /** The highest seq reflected in this snapshot — the cursor to pull ops after. */
  seq: number
}

export interface InfoResponse {
  ok: true
  shopName: string | null
  seq: number
}

/** Thrown by login() when the host answered 429 — too many failed attempts
 *  from this device's address. Carries the wait so the UI can say how long
 *  rather than just "try again". */
export class RateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('rate limited')
    this.name = 'RateLimitedError'
  }
}

export interface LoginResponse {
  ok: true
  /** Which of the shop's two accounts the credentials matched. */
  role: 'admin' | 'worker'
  /** The account's name as the shop stored it — echoed back so the UI can
   *  greet with the shop's own capitalization rather than whatever was typed.
   *  null for a legacy admin account with no recorded username (see
   *  server/shopAccounts.ts's ShopAccount.username doc) — no caller reads
   *  this field today (only .token is used, by SyncFollowerSetup.tsx). */
  username: string | null
  /** The shop's LAN token, to save as this device's HostConfig.token. null
   *  when the shop has none; see server/shopAccounts.ts's
   *  readLanTokenForHandover for why it is handed over even when the server
   *  isn't currently demanding one. */
  token: string | null
  shopName: string | null
  seq: number
}

/**
 * Prove to `baseUrl` that we hold one of that shop's accounts, and come back
 * with its LAN token — the pairing handshake that replaces "read the token
 * off the host's screen and type it into this one".
 *
 * Throws UnauthorizedError for wrong credentials (the server answers the
 * same 401 for an unknown username and a wrong password, deliberately) and
 * RateLimitedError once that address has failed too often. Any other
 * failure — host unreachable, or a host too old to have this route, which
 * answers 404 — throws a plain Error, so the caller can tell "wrong
 * password" apart from "wrong address".
 */
export async function login(baseUrl: string, username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    throw new RateLimitedError(typeof (body as any)?.retryAfterMs === 'number' ? (body as any).retryAfterMs : 0)
  }
  await checkAuth(res)
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.json() as Promise<LoginResponse>
}

/** Confirms a host actually answers as a Surya Baru sync server before a
 *  device commits to following it — see src/pages/Settings.tsx's "Test
 *  connection", which shows the returned shopName back to whoever's typing
 *  in an address. */
export async function fetchInfo(baseUrl: string, token: string | null = null): Promise<InfoResponse> {
  const res = await fetch(`${baseUrl}/api/info`, { headers: authHeaders(token) })
  await checkAuth(res)
  if (!res.ok) throw new Error(`info fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchSnapshot(baseUrl: string, token: string | null = null): Promise<SnapshotResponse> {
  const res = await fetch(`${baseUrl}/api/snapshot`, { headers: authHeaders(token) })
  await checkAuth(res)
  if (!res.ok) throw new Error(`snapshot fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchOpsSince(baseUrl: string, since: number, token: string | null = null): Promise<SyncOpWithSeq[]> {
  const res = await fetch(`${baseUrl}/api/ops?since=${since}`, { headers: authHeaders(token) })
  await checkAuth(res)
  if (!res.ok) throw new Error(`ops fetch failed: ${res.status}`)
  return res.json()
}

export async function pushOps(baseUrl: string, ops: SyncOp[], token: string | null = null): Promise<{ seqs: (number | null)[] }> {
  const res = await fetch(`${baseUrl}/api/ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(ops),
  })
  await checkAuth(res)
  if (!res.ok) throw new Error(`ops push failed: ${res.status}`)
  return res.json()
}

/** Subscribes to the server's "new ops are available" ping. Returns an
 *  unsubscribe function. EventSource can't set headers, so a token (when
 *  the host requires one) rides along as a query param instead — see
 *  server/syncServer.ts's isAuthorized. */
export function openEventStream(baseUrl: string, onOps: () => void, token: string | null = null): () => void {
  const url = token ? `${baseUrl}/api/events?token=${encodeURIComponent(token)}` : `${baseUrl}/api/events`
  const source = new EventSource(url)
  source.addEventListener('ops', onOps)
  return () => source.close()
}
