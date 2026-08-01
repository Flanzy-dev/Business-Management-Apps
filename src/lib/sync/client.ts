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
