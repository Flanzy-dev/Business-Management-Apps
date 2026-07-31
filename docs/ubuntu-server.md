# Running the sync server on Ubuntu

This lets a Ubuntu box on the shop's own network hold the shop's data and
serve the app to every device, instead of relying on whichever shop PC
happens to be turned on. It's the same server the Electron app already runs
for itself (`server/db.ts` + `server/syncServer.ts`) — just run standalone
under plain Node, via `server/index.ts`. See `CLAUDE.md` and the plan at
`C:\Users\Bluek\.claude\plans\partitioned-puzzling-blossom.md` for how this
fits into the app's multi-device sync design.

**Scope, deliberately:** shop-network only. No TLS, no port forwarding, no
internet exposure. If that ever changes, HTTPS becomes mandatory — a browser
on an `https` page cannot open the SSE connection this server uses for
realtime updates to a plain `http` server.

## 1. Prerequisites

- Node.js 18+ on the Ubuntu box (`node -v` to check; `sudo apt install
  nodejs npm` or use `nvm` if it's missing or too old).
- A **static LAN IP** for this machine — a DHCP reservation on the router is
  the usual way. Every device's saved address (Settings → Multi-device sync)
  breaks if this box's IP changes later.
- This repo, checked out or copied onto the box.

## 2. Build

```bash
npm ci
npm run build:server   # compiles server/*.ts -> dist-server/*.js
npx vite build          # builds the app itself -> dist/
```

(`npm run build` also does this, plus the Electron desktop packaging this
box doesn't need — the two commands above are enough on their own.)

## 3. Choose a shop password

Anyone who can reach this box on the network can reach whatever `/api/*`
serves, so set one:

```bash
export SHOP_TOKEN="pick something only your shop staff know"
```

Every device that follows this server enters the same password in Settings
→ Multi-device sync → "Use another device or server". Leave `SHOP_TOKEN`
unset only if you're comfortable with an open server on the network.

## 4. Run it

```bash
SURYA_DB=/var/lib/surya-baru/surya-baru.db \
SHOP_TOKEN="$SHOP_TOKEN" \
PORT=5174 \
node dist-server/index.js
```

Env vars (`server/index.ts`), all optional:

| Var | Default | Meaning |
|---|---|---|
| `SURYA_DB` | `./surya-baru.db` next to `dist-server/` | Path to the SQLite file — set this to somewhere durable |
| `SURYA_DIST` | `../dist` next to `dist-server/` | The built app to serve — leave alone if `dist/` sits next to `dist-server/` |
| `SHOP_TOKEN` | unset (open) | The shared shop password, if any |
| `PORT` | `5174` | Must match the port devices are told to connect to |

A device (tablet, PC, phone) reaches the app itself at
`http://<this-box's-IP>:5174/` — no install needed there, it's just a
browser tab.

## 5. Keep it running — systemd

Create `/etc/systemd/system/surya-baru-sync.service`:

```ini
[Unit]
Description=Surya Baru sync server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/surya-baru
Environment=SURYA_DB=/var/lib/surya-baru/surya-baru.db
Environment=SHOP_TOKEN=pick-something-only-your-shop-staff-know
Environment=PORT=5174
ExecStart=/usr/bin/node dist-server/index.js
Restart=on-failure
User=surya-baru

[Install]
WantedBy=multi-user.target
```

(Adjust `WorkingDirectory` to wherever you copied the repo, and consider a
dedicated `surya-baru` system user rather than running as root.)

```bash
sudo mkdir -p /var/lib/surya-baru
sudo systemctl daemon-reload
sudo systemctl enable --now surya-baru-sync
sudo systemctl status surya-baru-sync
```

## 6. Point devices at it

On every device (the shop PC included, if you want it to also follow this
server rather than host its own copy): Settings → Multi-device sync → "Use
another device or server" → enter this box's IP and the shop password →
**Test connection** (confirms it reached the right server and shows the shop
name) → **Save and switch**. That device's local data is then replaced by
whatever this server holds — see the in-app warning before confirming.

**Recommended end state:** every device, including the shop PC, follows this
server. The shop PC's own embedded LAN server (port 5174 there too) stays
running regardless — it's the fallback if this box is ever down, and what
lets that PC be pointed back to "This device holds the data" without losing
anything.

## 7. Backups

The whole database is one file (`SURYA_DB`). A nightly copy is enough at
shop scale:

```bash
0 3 * * * cp /var/lib/surya-baru/surya-baru.db /var/backups/surya-baru/surya-baru-$(date +\%F).db
```

Restoring means stopping the service, replacing the file, and starting it
again — every device picks the change up on its next sync.

## 8. Sanity-check without any device

```bash
curl http://localhost:5174/api/info -H "x-shop-token: $SHOP_TOKEN"
# {"ok":true,"shopName":"...","seq":0}
```

A `401` here means the token is wrong or the device isn't sending one — the
same response every follower device gets and shows as "Password needed" in
the sidebar.
