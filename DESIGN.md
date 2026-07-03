# Surya Baru Service Console — Design Spec

Source: Claude Design handoff bundle (`project/Surya Baru Console.dc.html` +
`project/_ds/surya-baru-design-system-.../*`), read in full, plus the two
chat transcripts in `chats/`. This document is the implementation-ready spec
distilled from those sources — everything a build needs, independent of the
`.dc.html` prototype's own runtime (`x-dc`/`sc-for`/`sc-if`, a Claude-Design-only
templating layer that should **not** be carried into production code).

## 0. What this is

**Surya Baru** — a service platform for oil-vehicle service (booking,
tracking, fleet oil-change management). Two products exist in the design
system; **only the Service Console** (operator-facing internal app) is
built out in this handoff. A marketing site is referenced in the design
system but not part of this bundle.

Origin note (from `chats/chat1.md`): this design was produced by reskinning
an existing app called "OilDesk" (mint accent, Inter, USD/imperial units)
into Surya Baru's visual language (amber accent, Space Grotesk/IBM Plex,
Rp/metric). That source app is **not present in this repo** — this spec
describes the Surya Baru Console as its own target, to be implemented fresh.

User decisions captured in `chats/chat1.md`:
- Full rebrand (not a toggle/theme option — Surya Baru only)
- Interactive fidelity: real nav, real (computed) charts, not static mockups
- Currency/units: Indonesian Rupiah (`Rp`) + metric (km, L) throughout
- Scope: one flagship screen set — Dashboard, Service orders, Vehicles, Bays,
  all reachable from a persistent shell — chosen by the design agent ("decide
  for me"); all other nav items exist as routable placeholders

---

## 1. Design tokens

All values below are the actual token definitions (`project/_ds/.../tokens/*.css`).
Implement these as CSS custom properties (or a theme object with equivalent
names) — the console is **dark-mode only**, there is no light theme.

### Color

```
Backgrounds (cool graphite ramp, blue-tinted near-blacks)
--bg-0: #0a0c10   app canvas / sidebar background
--bg-1: #10141a   page surface (main content background)
--bg-2: #151b23   card surface
--bg-3: #1c2430   elevated / hover
--bg-4: #242e3c   pressed / active fill

Foreground
--fg-1: #e9eef5   primary text
--fg-2: #9aa8ba   secondary text
--fg-3: #5f6d80   muted / placeholder text
--fg-inverse: #0a0c10   text on accent-filled surfaces

Borders
--border-1: #1f2833   hairline (inside cards, row dividers)
--border-2: #2b3644   standard (card/input outlines)
--border-3: #3b4859   strong / hover / focus-adjacent

Accent — "surya" amber (the sun; sole warm color, used sparingly)
--accent: #ffb224
--accent-hover: #ffc14d
--accent-active: #f0a010
--accent-muted: rgba(255, 178, 36, 0.12)
--accent-border: rgba(255, 178, 36, 0.35)

Status (12%-alpha muted fill + solid foreground, for badges/bars/dots)
--success: #3ecf8e        --success-muted: rgba(62, 207, 142, 0.12)
--warning: #ffb224         --warning-muted: rgba(255, 178, 36, 0.12)   (= accent)
--danger:  #f2555a         --danger-muted:  rgba(242, 85, 90, 0.12)
--info:    #4d9fff         --info-muted:    rgba(77, 159, 255, 0.12)

Semantic aliases
--surface-page: var(--bg-1)
--surface-card: var(--bg-2)
--surface-raised: var(--bg-3)
--surface-input: var(--bg-0)
--text-heading: var(--fg-1)
--text-body: var(--fg-2)
--text-muted: var(--fg-3)
--text-link: var(--accent)
--focus-ring: 0 0 0 2px var(--bg-1), 0 0 0 4px var(--accent)

Overlay
--overlay-scrim: rgba(6, 8, 11, 0.65)
--blur-overlay: 8px
```

### Typography

```
--font-display: "Space Grotesk", "Segoe UI", sans-serif   (headings, tight tracking)
--font-body:    "IBM Plex Sans", "Segoe UI", sans-serif    (UI/body, 14px default)
--font-mono:    "IBM Plex Mono", "SF Mono", monospace      (ALL numerals/data/IDs)

Scale: --text-2xs 11 / --text-xs 12 / --text-sm 13 / --text-md 14 / --text-lg 16
       / --text-xl 20 / --text-2xl 26 / --text-3xl 34 / --text-4xl 46 / --text-5xl 64
Weight: --weight-regular 400 / --weight-medium 500 / --weight-semibold 600 / --weight-bold 700
Leading: --leading-tight 1.1 / --leading-snug 1.3 / --leading-normal 1.55
Tracking: --tracking-tight -0.02em / --tracking-normal 0 / --tracking-wide 0.08em (uppercase micro-labels)
```

Google Fonts substitutes (no proprietary fonts were provided — flagged in
the design system readme as replaceable if real brand fonts exist):
`Space Grotesk:wght@400;500;600;700`, `IBM Plex Sans:wght@400;500;600`,
`IBM Plex Mono:wght@400;500`.

### Spacing, radii, control sizes

```
4px base scale: --space-1 4 / -2 8 / -3 12 / -4 16 / -5 20 / -6 24 / -8 32 / -10 40 / -12 48 / -16 64 / -20 80 / -24 96
Radii: --radius-xs 4 (misc) / --radius-sm 6 (controls) / --radius-md 8 (cards)
       / --radius-lg 12 (modals) / --radius-full 999 (badges/pills/dots)
Control heights: --control-sm 28 / --control-md 34 / --control-lg 40
```

### Effects / motion

```
--shadow-sm: 0 1px 2px rgba(0,0,0,.4)
--shadow-md: 0 4px 12px rgba(0,0,0,.45)
--shadow-lg: 0 12px 32px rgba(0,0,0,.55)          (modals/overlays)
--shadow-glow-accent: 0 0 0 1px var(--accent-border), 0 4px 20px rgba(255,178,36,.15)
                                                    (reserve for the single most important CTA — not used in console)
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)
--duration-fast: 120ms   (default transition duration for hover/press)
--duration-med: 200ms
--duration-slow: 320ms
```

Interaction rules: **hover** steps background up one level and/or strengthens
the border; **press** steps background to `--bg-4` (accent buttons darken to
`--accent-active`) — **no scale/shrink transforms, ever**. Motion is fast and
precise (120–200ms, ease-out, opacity + small translate) — no bounce, no
looping animation. Depth comes from background steps + 1px borders, not
heavy shadows; no gradients, no textures, no illustrations.

### Iconography

**Lucide** icons only (stroke width 1.75, 16–20px, `currentColor`, no fill) —
explicitly a substitute since no brand icon set exists. Never use emoji as
icons. The exact path data for every icon used in the console is in
§6 (nav icons) and inline in the screens below.

---

## 2. Component library

These are the design system's actual primitives (from `_ds_bundle.js`,
namespace `SuryaBaruDesignSystem_143126`), given here as prop contracts +
visual spec so they can be re-implemented natively rather than copied
verbatim. All are function components with no external state management —
implement as plain presentational components in whatever framework is used.

### Button
`{ variant = "primary" | "secondary" | "ghost" | "danger", size = "sm" | "md" | "lg", icon, disabled, children, style }`
- Sizes: sm → height `--control-sm`, padding `0 10px`, font `--text-xs`; md → `--control-md`/`0 14px`/`--text-sm`; lg → `--control-lg`/`0 18px`/`--text-md`
- `primary`: bg `--accent`, text `--fg-inverse`; hover `--accent-hover`; active `--accent-active`
- `secondary`: bg `--bg-3`, text `--fg-1`, border `--border-2`; hover bg `--bg-4` + border `--border-3`; active bg `--bg-4`
- `ghost`: transparent, text `--fg-2`; hover bg `--bg-3` + text `--fg-1`; active bg `--bg-4`
- `danger`: bg `--danger`, text `#fff`; hover/active via `filter: brightness()`
- Base: inline-flex, gap 6, font-weight medium, radius `--radius-sm`, `disabled` → opacity .45 + not-allowed cursor
- Transition: `background-color 120ms ease-out, border-color 120ms ease-out`

### IconButton
`{ size = "sm"|"md"|"lg", active, disabled, label (used as aria-label + title), children (icon svg), style }`
- Square, side = control height for the given size
- Default: transparent / `--fg-2`; hover: bg `--bg-3` / text `--fg-1`; `active=true`: bg `--accent-muted` / text `--accent`
- radius `--radius-sm`

### Badge
`{ tone = "neutral"|"accent"|"success"|"warning"|"danger"|"info", dot?: boolean, children }`
- Pill: height 20, padding `0 8px`, radius `--radius-full`
- Text: `--text-2xs`, semibold, **uppercase**, `--tracking-wide`
- tone → `{bg: <tone>-muted, fg: <tone>}` (neutral → bg `--bg-4`, fg `--fg-2`)
- `dot`: leading 5×5 circular dot, `background: currentColor`

### StatCard
`{ label, value, unit?, delta?, deltaTone = "up"|"down"|"neutral", hint? }`
- Card: bg `--surface-card`, border `--border-2`, radius `--radius-md`, padding `14px 16px`, column, gap 6
- `label`: `--text-2xs` uppercase semibold `--fg-3`
- `value`: **mono**, `--text-2xl`, `--fg-1`, line-height 1 (baseline-aligned row with unit/delta)
- `unit`: mono `--text-sm` `--fg-3`
- `delta`: mono `--text-xs`, pushed right (`margin-left:auto`); color by tone — up → `--success`, down → `--danger`, neutral → `--fg-3`
- `hint`: `--text-xs` `--fg-3` on its own line below

### Tabs
`{ tabs: Array<string | {value, label, count?}>, value, onChange }`
- Row, gap 2, bottom border `--border-1` (the unselected baseline)
- Each tab: height 36, `2px solid` bottom border — `--accent` when active else transparent, `margin-bottom:-1px` so the active underline sits on the container's border
- Label color: active `--fg-1` semibold; hover (inactive) `--fg-2`; idle `--fg-3`
- Optional `count`: mono `--text-2xs` pill, bg `--accent-muted`/text `--accent` when active else bg `--bg-3`/text `--fg-3`

### Input
`{ label?, hint?, error?, prefix?, mono?: boolean, ...inputProps }`
- Wrapper: column, gap 6
- `label`: `--text-2xs` uppercase semibold `--fg-3`
- Field row: height `--control-md`, padding `0 10px`, bg `--surface-input`, radius `--radius-sm`
  - border: `--danger` if `error`, else `--accent` if focused, else `--border-2`
  - focus (no error): `box-shadow: 0 0 0 3px var(--accent-muted)`
- Text: `--text-sm`, mono font if `mono`, else body font
- `hint`/`error` line below: `--text-xs`, `--danger` if error else `--fg-3`

### Select
`{ label?, options: Array<string | {value,label}>, value, onChange, placeholder? }`
- Same field chrome as Input (native `<select>`, `appearance:none`), with a trailing chevron (`m6 9 6 6 6-6`) 14px, `--fg-3`, absolutely positioned, `pointer-events:none`
- Focus state identical to Input

### Checkbox
`{ checked, onChange(checked, event), label, disabled }`
- Native checkbox visually hidden; custom 16×16 box, radius `--radius-xs`
- Unchecked: border `--border-3`, bg `--surface-input`
- Checked: bg + border `--accent`, white checkmark icon (`M20 6 9 17l-5-5`, stroke 3.2, color `--fg-inverse`)
- Label: `--text-sm` `--fg-1`; disabled → opacity .45

### Dialog
`{ open, title, children, footer, onClose, width = 440 }`
- Full-viewport fixed scrim: `--overlay-scrim` + `backdrop-filter: blur(8px)`; click on scrim (not panel) calls `onClose`
- Panel: bg `--bg-2`, border `--border-2`, radius `--radius-lg`, shadow `--shadow-lg`, `max-height:85vh` scrollable
- Header row: title in `--font-display` `--text-lg` semibold `--fg-1`, close (X) IconButton-style top-right
- Body: padding `12px 20px 20px`, `--text-sm` `--fg-2`, line-height `--leading-normal`
- Footer (if present): right-aligned button row, top border `--border-1`, padding `12px 20px`

### Toast
`{ tone = "neutral"|"success"|"danger"|"warning", title, description?, action? }`
- Fixed width 340, bg `--bg-3`, border `--border-2`, radius `--radius-md`, shadow `--shadow-md`
- Leading 6×6 dot colored by tone (`--fg-2` for neutral, else the status color)
- `title`: `--text-sm` medium `--fg-1`; `description`: `--text-xs` `--fg-2`; `action`: `--text-xs` link-colored, right-aligned, medium weight

Components referenced in the design system but **not used** in this console
screen set (present for completeness, not required to build now): `Card`,
`Tag`, `Radio`, `Switch`, `Tooltip`.

---

## 3. App shell

Full-viewport flex row, `height:100vh`, `overflow:hidden`, background `--bg-1`.

### Sidebar
- Fixed width **224px**, bg `--bg-0`, right border `--border-1`, padding `16px 10px`, column, scrollable if content overflows
- Wordmark at top: `SURYA` + `<span accent>BARU</span>`, `--font-display` 600, `--tracking-wide` (`0.08em`), `15px`, `--fg-1` (amber only on "BARU" per the no-logo brand rule — see §7)
- **Four nav groups**, each a vertical list of buttons, separated by 1px `--border-1` dividers (`margin: 8px 4px`):
  - Group A (primary/operations): Dashboard, Appointments, Service orders, Bays, Vehicles, Service history
  - Group B (people): Customers, Companies, Technicians
  - Group C (business): Inventory, Suppliers, Expenses, Reports
  - Group D (comms): Messages
- Nav item button: full width, height 34, gap 10, padding `0 10px`, radius `--radius-sm`, 17×17 Lucide icon + label (`--text-sm`)
  - Active: bg `--accent-muted`, text `--accent`, font-weight 500
  - Inactive: transparent, text `--fg-2`, font-weight 400
  - Transition: `background-color 120ms ease-out`
- Footer (pinned via `margin-top:auto`, top border `--border-1`): operator identity row — 28px circular initials avatar (bg `--bg-3`, border `--border-2`, text `--fg-2` 11px semibold), name (`--fg-1` 12px medium) + role (`--fg-3` 11px) stacked, trailing "switch account" icon (`--fg-3`) right-aligned
  - Sample: initials `DW`, name `Dwi Anggara`, role `Operator`

### Topbar
- Height 56, padding `0 24px`, bottom border `--border-1`, bg `--surface-page`, row
- Screen title: `--font-display` 20px semibold `--fg-1`, `--tracking-tight` — bound to current route (see §4 titles)
- Right-aligned cluster (`margin-left:auto`, gap 10):
  - Search field: 260×34, bg `--bg-0`, border `--border-2`, radius `--radius-sm`, leading search icon (`--fg-3`), placeholder **"Search plate, VIN, order…"**
  - Notifications IconButton (bell icon, `M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0`)
  - Primary Button, size sm: `+` icon + **"New order"** → opens the New Service Order dialog

---

## 4. Navigation & routing

Single-page shell; route state = which screen is active. Screen titles shown
in the topbar:

| id | Label (topbar title) | Nav group | Built? |
|---|---|---|---|
| `dashboard` | Dashboard | A | ✅ |
| `appointments` | Appointments | A | — placeholder |
| `work-orders` | Service orders | A | ✅ |
| `bays` | Bay status board | A | ✅ |
| `vehicles` | Vehicles | A | ✅ |
| `service-history` | Service history | A | — placeholder |
| `customers` | Customers | B | — placeholder |
| `companies` | Companies | B | — placeholder |
| `technicians` | Technicians | B | — placeholder |
| `inventory` | Inventory | C | — placeholder |
| `suppliers` | Suppliers | C | — placeholder |
| `expenses` | Expenses | C | — placeholder |
| `reports` | Reports | C | — placeholder |
| `messages` | Messages | D | — placeholder |

Default route: `dashboard`.

**Placeholder screen** (any unbuilt id): centered card, padding 56,
`text-align:center` — screen label (`--font-display` 16px `--fg-1`) +
one line of muted body text: *"This screen isn't part of the reskin
build yet — intentionally left blank."* (Swap the wording once real, since
this line is prototype-specific — a production placeholder should say
something like *"[Screen] is coming soon."*)

Icons for every nav item (Lucide path data, 24×24 viewBox, stroke 1.75):

```
Dashboard (gauge):        M15.6 2.7a10 10 0 1 0 5.7 5.7M12 12l4-4M12 2v2M2 12h2M20 12h2
Appointments (calendar):  M8 2v4M16 2v4M21 8.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5.5M3 10h18M16 14v2.2l1.6 1
Service orders (clipboard): M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 11h4M12 16h4M8 11h.01M8 16h.01
Bays (warehouse):         M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35ZM6 18h12M6 14h12M6 10h12
Vehicles (car):            M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 17h6
Service history (history): M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2
Customers (users):         M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75
Companies (building):      M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4
Technicians (hardhat):     M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2zM10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5M4 15v-3a6 6 0 0 1 6-6M14 6a6 6 0 0 1 6 6v3
Inventory (package):       M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.29 7 12 12l8.71-5M12 22V12
Suppliers (truck):         M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z
Expenses (receipt):        M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1ZM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11
Reports (bar-chart):       M3 3v18h18M18 17V9M13 17V5M8 17v-3
Messages (message):        M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z
```

---

## 5. Screens (all padding `24px`, column, gap `16px`)

### 5.1 Dashboard (`max-width: 1400px`)

Vertical stack of sections, each a card (`--surface-card` bg, `--border-2`
border, `--radius-md`) unless noted:

**1. KPI row** — 4-column grid, gap 12, each cell a `StatCard`:
| label | value | unit | delta | deltaTone | hint |
|---|---|---|---|---|---|
| Orders today | 24 | — | +12% | up | vs yesterday |
| Oil dispensed | 182.4 | L | — | neutral | across 4 bays |
| Vehicles due 7d | 16 | — | +4 | down | 2 overdue |
| Revenue today | Rp 11.2M | — | +8% | up | vs last Friday |

(Note: "Vehicles due 7d" delta is intentionally tone `down` even though +4
is numerically an increase — an increase in vehicles due is a bad-direction
metric; preserve this semantic, not the literal sign.)

**2. Gauge + Bay status** — grid `1fr 2fr`, gap 16, items `align-items:start`

- *Bay capacity* card: header "Bay capacity". Centered circular gauge,
  168×168 SVG: base ring `r=66`, stroke 14, color `--bg-4`; progress ring
  same geometry, stroke `--accent`, `stroke-linecap:round`, rotated -90°
  (12 o'clock start), `stroke-dasharray = (circumference * pct/100, circumference)`
  where `circumference = 2π×66 ≈ 414.7`. Center label: mono 38px value + "%"
  in `--fg-3` 18px, sub-label "booked" (uppercase, tracked, `--fg-3` 11px).
  Below: caption text, e.g. *"4 of 6 bays occupied now"*. Sample: **78%**.

- *Bay status* card: header + "View all →" link button (accent, navigates to
  Bays screen). Body: 3-column grid, gap 10, one tile per bay (see bay data
  model in §6) — each tile: bg `--bg-1`, border `--border-1`, **left** accent
  border 3px colored by status tone, radius `--radius-sm`, padding 12.
  Header row: bay name (`--font-display` 13px semibold) + status `Badge`
  (dotted). If occupied: vehicle model (`--fg-2` 12px) then mono line
  `plate · technician` (`--fg-3` 11px). If free: *"Open — ready for next
  vehicle"* (`--fg-3` 12px).

**3. Technician queue + Service mix** — grid `1fr 1fr`, gap 16

- *Technician queue*: header + subtitle *"Who's on which bay, time remaining"*.
  Row per technician: 30px circular initials avatar, name (13px `--fg-1`
  medium) + mono sub-label (bay·vehicle, `--fg-3` 11px), a 4px progress bar
  (track `--bg-4`, fill `--accent` if busy else `--fg-3`, width = progress%),
  trailing mono time label (`--fg-2` if busy else `--fg-3`). Divider `--border-1`
  between rows.

- *Service mix*: header + subtitle *"Share of tickets by service type"*.
  One row per service type: name (13px `--fg-2`) + mono share % (`--fg-1`)
  above a 6px horizontal bar (track `--bg-4`, fill `--accent`, width = share%).
  14px gap between rows.

**4. Bay throughput + Repeat customer rate** — grid `1fr 1fr`, gap 16

- *Bay throughput*: header + subtitle *"Cars per day, trailing 7 days"* +
  legend (Scheduled = accent, Walk-in = info) top-right. Grouped bar chart,
  150px tall plot area (124px bar height ceiling + day labels): 7 day-groups,
  each two adjacent 11px-wide bars (scheduled = `--accent`, walk-in = `--info`,
  radius `3px 3px 0 0`, gap 3 between the pair, gap 10 between groups), mono
  11px day label below each group (`--fg-3`).
  Scale: bar px-height = `round(value / 14 * 124)` (14 = fixed max on the
  implicit y-axis).

- *Repeat customer rate*: header + subtitle *"This month vs last, weekly"* +
  legend (This month = accent line, Last month = `--fg-3` line). SVG
  `viewBox="0 0 300 118"`, `preserveAspectRatio="none"`, rendered at
  `width:100%, height:150`. Three paths: filled area under "this month"
  (`fill: --accent-muted`, no stroke), "last month" line (`stroke: --fg-3`,
  width 2), "this month" line (`stroke: --accent`, width 2.5) — both lines
  `stroke-linejoin/linecap: round`. Data mapped 50–78 (min–max) over 6 weekly
  points, x evenly spaced.

**5. Appointment volume** (full width card) — header + subtitle
  *"Scheduled + walk-in, Jan–Dec · seasonal view"*. SVG `viewBox="0 0 620 150"`,
  rendered `width:100%, height:180`: filled area (`--accent-muted`) + accent
  line (2.5px) over 12 monthly points, data range 70–175. A dashed vertical
  marker (`--border-3`, `3 3` dash) + 4px accent dot mark the **current
  calendar month** on the line. Below the chart: a row of 12 mono 10px month
  labels (`--fg-3`), space-between.

**6. Open work orders** (full width card) — header + "View all →" (navigates
  to Service orders). Row per **open** order only: mono RO number (accent,
  13px) + owner name (`--fg-1` 13px) + vehicle (`--fg-3` 12px) on the left;
  status `Badge` + mono total (`--fg-1` 13px) on the right. `--border-1`
  row dividers.

### 5.2 Service orders (`max-width: 1200px`)

- Intro line: *"Track every oil service order across bays and technicians."*
  (`--fg-3` 13px)
- Card containing: `Tabs` (All / Open / Completed, each with a live count
  pill) driving a client-side filter, directly above a full-width table.
- Table columns: **Order** (mono, accent) · **Owner** · **Vehicle** ·
  **Plate** (mono) · **Tech** · **Total** (mono, right-aligned) · **Status**
  (Badge, dotted). Header row: uppercase 11px tracked `--fg-3` semibold,
  bottom border `--border-1`. Body rows: `--border-1` divider, 12px vertical
  padding, 16px horizontal.
- Tab counts derive from the full order set (`all` = total, `open`/`completed`
  = filtered counts); switching tabs filters the table rows client-side —
  no navigation.

### 5.3 Vehicles (`max-width: 1200px`)

- Intro line: *"Plate-indexed vehicle records with mileage and next service due."*
- Single card, table (no tabs): **Plate** (mono) · **Vehicle** · **Owner** ·
  **Mileage** (mono, right-aligned, "km") · **Oil grade** · **Next due**
  (mono date) · **Status** (Badge: tones `warning`="Due soon",
  `danger`="Overdue", `info`="Scheduled", `neutral`="On track").

### 5.4 Bays (`max-width: 1200px`)

- Legend row (flex-wrap, gap 18): 10px dot + label for each status —
  Available (`--success`), In service (`--accent`), Inspection (`--info`),
  Awaiting parts (`--danger`).
- 3-column grid, gap 14, one card per bay: `--surface-card`, **top** accent
  border 3px by status, radius `--radius-md`, padding 16, `min-height:150px`.
  Header row: bay name (16px `--font-display` semibold) + status Badge.
  If occupied: vehicle model (14px `--fg-1`) + mono plate (`--fg-3` 12px),
  then a top-bordered footer row with technician name (left) and mono
  time/status label in accent (right). If free: centered *"Ready for next
  vehicle"* (`--fg-3` 13px) filling an 88px-tall placeholder area.

### 5.5 New service order dialog

Triggered by the topbar "New order" button. `Dialog`-style modal, width 480:
- Title: **"New service order"**
- Fields (2-col grid for the first row, gap 12/14):
  - Plate number — `Input`, mono, placeholder `"B 1247 KZT"`
  - Bay — `Select`, options = open/available bays (sample: Bay 1–4)
  - Oil grade — `Select`, full width, options: `5W-30 synthetic`,
    `0W-20 synthetic`, `10W-40`, `15W-40 diesel`
  - Two checkboxes, 20px gap: **"Replace oil filter"**, **"Flush coolant"**
- Footer: Cancel (ghost) / Create order (primary)
- On create: close dialog, show a success **Toast** (tone `success`, title
  **"Order created"**, description **"Added to today's schedule."**, action
  **"View"**) for ~3.5s, then auto-dismiss.

---

## 6. Data model & sample content

All values below are the prototype's seed data — representative, not real
customer data. Reuse the shape; the numbers are placeholders for a real
backend.

```ts
type Tone = "accent" | "success" | "info" | "danger" | "warning" | "neutral";

interface Kpi { label: string; value: string; unit?: string; delta?: string; deltaTone: "up"|"down"|"neutral"; hint?: string }

interface Bay {
  name: string;                 // "Bay 1".."Bay 6"
  tone: Tone;                   // status color
  label: string;                // "In service" | "Inspection" | "Available" | "Awaiting parts"
  vehicle?: string; plate?: string; tech?: string; time?: string;  // present unless free
}

interface Technician { name: string; initials: string; sub: string; progress: number /*0-100*/; time: string; busy: boolean }

interface ServiceMixEntry { name: string; share: number /* percent, 0-100 */ }

interface ThroughputDay { day: string; scheduled: number; walkIn: number }  // day, scheduled cars, walk-in cars

interface Order {
  ro: string;         // "SB-2043" — mono, sequential, prefixed "SB-"
  owner: string; vehicle: string; plate: string; tech: string;
  total: string;       // "Rp 480,000" — formatted Rupiah, thousands-separated
  status: "Open" | "Completed";
  tone: Tone;          // "warning" for Open, "success" for Completed
}

interface Vehicle {
  plate: string; vehicle: string /* "Toyota Avanza 2019" */; owner: string;
  mileage: string;   // "84,200 km"
  grade: string;     // "5W-30 synthetic"
  due: string;       // "Jul 14" — mono short date
  dueLabel: "Due soon" | "Overdue" | "Scheduled" | "On track";
  tone: Tone;         // warning / danger / info / neutral respectively
}
```

Seed data (verbatim from the prototype):

**KPIs** — see §5.1 table 1.

**Bays**
| name | tone | label | vehicle | plate | tech | time |
|---|---|---|---|---|---|---|
| Bay 1 | accent | In service | Toyota Avanza | B 1247 KZT | Budi | 18m left |
| Bay 2 | accent | In service | Isuzu Elf | B 5590 TKM | Andi | 42m left |
| Bay 3 | info | Inspection | Honda Brio | D 3321 AFE | Sari | Multi-point |
| Bay 4 | success | Available | — | — | — | — |
| Bay 5 | danger | Awaiting parts | Mitsubishi L300 | B 8804 QRA | Dedi | Oil filter |
| Bay 6 | success | Available | — | — | — | — |

**Technicians**
| name | initials | sub | progress | time | busy |
|---|---|---|---|---|---|
| Budi Santoso | BU | Bay 1 · Avanza | 65 | 18m | true |
| Andi Wijaya | AN | Bay 2 · Elf | 30 | 42m | true |
| Sari Lestari | SA | Bay 3 · Brio | 50 | Inspect | true |
| Dedi Kurnia | DE | Bay 5 · L300 | 20 | Parts | true |
| Rina Amelia | RI | Unassigned | 0 | Idle | false |

**Service mix** — Full synthetic oil change 38% · Conventional oil change 24%
· Diesel oil service 16% · Tire rotation + balance 14% · Brake inspection 8%

**Bay throughput (trailing 7 days, scheduled/walk-in)**
Mon 6/3 · Tue 8/2 · Wed 5/4 · Thu 9/3 · Fri 11/5 · Sat 7/6 · Sun 4/2 (max axis value = 14)

**Repeat customer rate (weekly, this month vs last)** — range 50–78%
This month: 64, 66, 63, 70, 68, 72 — Last month: 60, 62, 58, 64, 61, 63

**Appointment volume (Jan–Dec)** — range 70–175
88, 92, 101, 110, 124, 158, 166, 142, 120, 108, 96, 90
(current-month marker computed from `new Date().getMonth()`, clamped to index 0 if out of range)

**Service orders** (newest first; RO numbers descend)
| RO | Owner | Vehicle | Plate | Tech | Total | Status |
|---|---|---|---|---|---|---|
| SB-2043 | Budi Santoso | Toyota Avanza | B 1247 KZT | Budi | Rp 480,000 | Open |
| SB-2042 | CV Maju Jaya | Isuzu Elf | B 5590 TKM | Andi | Rp 1,240,000 | Open |
| SB-2041 | Sari Dewi | Honda Brio | D 3321 AFE | Sari | Rp 360,000 | Completed |
| SB-2040 | Ahmad Rizki | Mitsubishi L300 | B 8804 QRA | Dedi | Rp 890,000 | Completed |
| SB-2039 | PT Sinar Abadi | Isuzu Elf | B 2210 FGH | Andi | Rp 1,120,000 | Completed |
| SB-2038 | Rina Putri | Daihatsu Xenia | D 9087 LMN | Rina | Rp 420,000 | Completed |

**Vehicles**
| Plate | Vehicle | Owner | Mileage | Grade | Due | Status |
|---|---|---|---|---|---|---|
| B 1247 KZT | Toyota Avanza 2019 | Budi Santoso | 84,200 km | 5W-30 synthetic | Jul 14 | Due soon |
| B 8804 QRA | Mitsubishi L300 2020 | Ahmad Rizki | 142,850 km | 15W-40 diesel | Jul 09 | Overdue |
| D 3321 AFE | Honda Brio 2021 | Sari Dewi | 38,410 km | 0W-20 synthetic | Jul 18 | Scheduled |
| B 5590 TKM | Isuzu Elf 2018 | CV Maju Jaya | 210,600 km | 15W-40 diesel | Jul 21 | Scheduled |
| B 2210 FGH | Isuzu Elf 2019 | PT Sinar Abadi | 176,300 km | 15W-40 diesel | Jul 25 | Scheduled |
| D 9087 LMN | Daihatsu Xenia 2020 | Rina Putri | 66,900 km | 5W-30 synthetic | Aug 02 | On track |

Tone-to-CSS-var lookup used throughout: `accent→--accent, success→--success,
info→--info, danger→--danger, warning→--warning, neutral→--fg-3`.

---

## 7. Content & voice rules

(From the design system readme — apply everywhere, not just seed data.)

- **Sentence case** everywhere — headings, buttons, table headers (except
  intentional uppercase micro-labels like table header row text and Badge
  text, which are a *visual* uppercase transform on sentence-case source
  strings, not literally upper-cased content).
- **Verb-first button labels**: "Book service", "Add vehicle", "Export
  report" — never "Click here" or "Submit".
- **Numbers are data** → always `--font-mono`: mileage, liters, prices,
  dates, plate numbers, RO/order IDs.
- **Currency**: Indonesian Rupiah, formatted `Rp 480,000` (thousands
  comma-separated, no decimals for whole amounts); large sums abbreviate as
  `Rp 11.2M`.
- **Units**: metric — km for distance/mileage, L for liters.
- **No emoji, ever. No exclamation marks** in console UI copy.
- **No logo** — the wordmark is plain type only: `SURYA BARU` in
  Space Grotesk 600, letterspaced, with "BARU" (or a leading glyph) optionally
  in accent amber. Never draw or generate a logo mark.
- Address the operator as "you"; the brand voice ("we") is marketing-only,
  never used inside the console.

---

## 8. Interaction / state summary

Minimal state needed to reproduce the prototype's interactivity:

- `screen: string` — current route id (§4), default `"dashboard"`
- `newOrderOpen: boolean` — dialog visibility
- `toastVisible: boolean` — success toast visibility, auto-clears after 3.5s (debounce/replace timer on repeat creates)
- `orderFilter: "all" | "open" | "completed"` — Service orders tab state, filters the table client-side (no refetch)

Navigation is pure client-side state (no full page loads) — every sidebar
item, every "View all →" link (Dashboard → Bays / Dashboard → Service
orders), and the New order dialog are live/clickable, not static images.

---

## 9. Explicitly out of scope (this handoff)

- Every nav item other than Dashboard, Service orders, Bays, Vehicles is an
  intentional placeholder (§4) — not a bug, not missing work to silently add.
- No backend/data-persistence design is implied — all data above is sample
  content for the UI layer.
- No light theme — this design system is dark-only by decision, not an
  unfinished light mode.
- Marketing site (`ui_kits/website/`) referenced in the design system is a
  separate product, not part of this console build.

---

## 10. Open questions for whoever implements this

1. **Target codebase**: this repo currently contains only the design
   handoff bundle — no existing app to reskin. Confirm the stack (React/Vue/
   other) and whether this becomes a new repo or is dropped into an existing
   one before writing implementation code.
2. Real brand fonts/icon set, if Surya Baru has any beyond the Google
   Fonts/Lucide substitutes noted above.
3. Real photography/imagery policy — none exists yet; the design system
   says to use neutral `--bg-3` placeholder blocks and ask the user rather
   than generate images.
