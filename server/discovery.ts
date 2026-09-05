// LAN auto-discovery, so pairing a second device never requires anyone to
// read an IP address off one screen and type it into another.
//
// Deliberately plain UDP broadcast over Node's built-in `dgram` rather than
// mDNS/Bonjour: mDNS would mean a native or heavyweight dependency, and this
// is the same project that picked sql.js over a native SQLite driver
// specifically to avoid a node-gyp rebuild step (see CLAUDE.md). One
// broadcast probe and one unicast reply is the entire protocol.
//
//   follower  --(broadcast 255.255.255.255:5175)-->  "SURYA-DISCOVER-1"
//   host      --(unicast back to sender)--------->   {"magic":…,"port":…}
//
// Scope, matching server/syncServer.ts's: the shop's own network only. The
// reply carries the shop name and sync port and nothing else — no token, no
// account name, nothing that helps anyone who couldn't already reach the
// server. Discovery only tells a device WHERE the host is; proving it may
// have the data is still POST /api/login's job.
//
// Only useful between two Electron installs. A tablet running the app as a
// browser tab already loaded it from the host's address, so
// src/lib/sync/hostConfig.ts's resolveBaseUrl() infers the right host from
// window.location with nothing to discover — and a browser page cannot open
// a UDP socket anyway.
import * as dgram from 'dgram'

/** Separate from the sync server's TCP 5174 — a different protocol on the
 *  same number would still be a different socket, but keeping them distinct
 *  makes a firewall rule for either one unambiguous. */
const DISCOVERY_PORT = 5175

/** Bumped only if the reply shape below changes incompatibly; an older
 *  device ignores replies it doesn't recognize rather than misreading them. */
const PROBE_MAGIC = 'SURYA-DISCOVER-1'
const REPLY_MAGIC = 'SURYA-HOST-1'

/** A probe/reply is tiny; anything larger is not ours and is dropped
 *  unparsed, so a stray datagram can't push this into JSON.parse at all. */
const MAX_DATAGRAM_BYTES = 512

export interface DiscoveredHost {
  /** The IPv4 address the reply came from — the address to sync against.
   *  Taken from the UDP source, never from the reply body: a host cannot
   *  claim to be somewhere it isn't. */
  address: string
  /** Whatever the shop called itself in Settings, for the "is this the right
   *  shop?" confirmation before adopting its data. null when unset. */
  shopName: string | null
  /** The sync server's TCP port, so a non-default deployment is still
   *  reachable without asking anyone to remember it. */
  port: number
}

export interface DiscoveryResponder {
  close(): void
}

/**
 * Answer discovery probes on behalf of this host. Called by whichever
 * deployment is acting as the server — electron/main.ts alongside
 * startLanServer(), and server/index.ts alongside its listen().
 *
 * Every failure here is non-fatal and deliberately swallowed: discovery is
 * a convenience on top of a manual address field that still works. A shop
 * PC must never fail to start because a UDP port was busy or a hardened
 * network blocked the bind — it just means the other device types the
 * address, exactly as it did before this existed.
 */
export function startDiscoveryResponder(opts: {
  getShopName: () => string | null
  syncPort: number
  onError?: (err: Error) => void
}): DiscoveryResponder {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socket.on('message', (msg, rinfo) => {
    if (msg.length > MAX_DATAGRAM_BYTES) return
    if (msg.toString('utf8').trim() !== PROBE_MAGIC) return
    let reply: Buffer
    try {
      reply = Buffer.from(
        JSON.stringify({ magic: REPLY_MAGIC, shopName: opts.getShopName(), port: opts.syncPort }),
        'utf8'
      )
    } catch {
      return
    }
    // Unicast straight back to whoever probed, rather than broadcasting the
    // answer at everyone on the segment.
    socket.send(reply, rinfo.port, rinfo.address, () => {})
  })

  socket.on('error', (err: Error) => {
    opts.onError?.(err)
    try {
      socket.close()
    } catch {
      // Already closing.
    }
  })

  try {
    socket.bind(DISCOVERY_PORT)
  } catch (err) {
    opts.onError?.(err as Error)
  }

  return {
    close() {
      try {
        socket.close()
      } catch {
        // Never bound, or already closed.
      }
    },
  }
}

/**
 * Broadcast a probe and collect every host that answers within
 * `timeoutMs`. Always resolves — a network that drops broadcasts, a
 * firewall, or simply no host running just yields an empty list, which the
 * UI shows as "nothing found, type the address instead".
 *
 * Results are de-duplicated by address: a host with several active adapters
 * (WiFi and Ethernet both up) can answer the same probe more than once.
 */
// Used by electron/main.ts's `discover-hosts` IPC handler, which loads this
// module as require('../dist-server/server/discovery') — a compiled-output
// path fallow's static graph cannot follow, so it reports this as unused.
// Do NOT delete: removing it breaks Settings > Multi-device sync's "Search
// this WiFi". server/index.ts imports only startDiscoveryResponder, which is
// why this export alone looks orphaned.
// fallow-ignore-next-line unused-export
export function discoverHosts(timeoutMs = 1500): Promise<DiscoveredHost[]> {
  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredHost>()
    let socket: dgram.Socket
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    } catch {
      resolve([])
      return
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch {
        // Already closed.
      }
      resolve([...found.values()])
    }

    socket.on('message', (msg, rinfo) => {
      if (msg.length > MAX_DATAGRAM_BYTES) return
      try {
        const parsed = JSON.parse(msg.toString('utf8'))
        if (parsed?.magic !== REPLY_MAGIC) return
        const port = Number(parsed.port)
        found.set(rinfo.address, {
          address: rinfo.address,
          shopName: typeof parsed.shopName === 'string' && parsed.shopName.trim() ? parsed.shopName : null,
          port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 5174,
        })
      } catch {
        // Not one of ours.
      }
    })

    socket.on('error', finish)

    socket.bind(() => {
      try {
        socket.setBroadcast(true)
        const probe = Buffer.from(PROBE_MAGIC, 'utf8')
        socket.send(probe, DISCOVERY_PORT, '255.255.255.255', (err) => {
          // A send failure (no route, broadcast disallowed) is just "found
          // nothing" — the timer below still resolves normally.
          if (err) finish()
        })
      } catch {
        finish()
        return
      }
      setTimeout(finish, timeoutMs).unref?.()
    })
  })
}
