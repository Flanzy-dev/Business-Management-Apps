#!/usr/bin/env node
// One-time conversion of the shop's paper-era service logs into one CSV.
//
// Before Surya Baru the shop kept one Excel file per customer — the FILENAME
// is the customer ("ANTO 081200001111.xlsx", "PT. MAJU JAYA.xlsx") and the sheet
// is their service log:
//
//   No. | Tanggal | Jenis mobil | No. Polisi | KM | Mesin | Gardan | Transmisi |
//   Filter Oli | Filter Solar | Filter Udara | Inveten | Lain-lain
//
// A visit is a row with a number in column A; the one or two rows under it
// carry quantities and prices ("9 Lt @ 50.000" = 9 litres at Rp 50.000 each).
// This flattens all of it into one row per line item, so the shop can check it
// in Excel — every row keeps the original cell text in `raw`, and anything the
// parser wasn't sure about is marked `needs_review` rather than guessed at
// silently. Customers → Import (src/lib/customers/customerHistoryImport.ts) reads the
// result.
//
// Plain Node, no dependency: an .xlsx is a zip of XML, and these files use
// only the handful of features read below.
//
// Usage: node scripts/convert-pelanggan-xlsx.mjs <xlsx-folder> <out-folder>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'

// --- xlsx -------------------------------------------------------------------

/** Entry name → lazy reader, from the zip's central directory. */
function unzip(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const entries = new Map()
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip directory')
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    entries.set(name, () => (method === 0 ? raw : inflateRawSync(raw)).toString('utf8'))
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/** Text of a rich-text run list, without the phonetic guides Excel can attach. */
function runText(xml) {
  let out = ''
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1])
  return out
}

/** First sheet as rows of { columnLetter: trimmed text }, keyed by row number. */
function readFirstSheet(path) {
  const zip = unzip(readFileSync(path))
  const shared = []
  const sst = zip.get('xl/sharedStrings.xml')
  if (sst) for (const m of sst().matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(runText(m[1]))

  const sheetName = [...zip.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0]
  if (!sheetName) throw new Error('no worksheet')

  const rows = []
  for (const rm of zip.get(sheetName)().matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNum = Number(/\br="(\d+)"/.exec(rm[1])?.[1] ?? rows.length + 1)
    const cells = {}
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = /\br="([A-Z]+)\d+"/.exec(cm[1])?.[1]
      if (!col) continue
      const type = /\bt="([^"]+)"/.exec(cm[1])?.[1]
      const body = cm[2] ?? ''
      let value
      if (type === 'inlineStr') value = runText(body)
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)
        if (!v) continue
        value = type === 's' ? shared[Number(v[1])] ?? '' : decodeXml(v[1])
      }
      value = value.replace(/\s+/g, ' ').trim()
      if (value) cells[col] = value
    }
    rows.push({ rowNum, cells })
  }
  return rows
}

// --- owner (from the filename) ----------------------------------------------

function parseOwner(fileName) {
  let name = fileName.replace(/\.xlsx$/i, '').trim()
  // "1. Kosong", "1. blank - Copy": the empty template the shop copied from.
  if (/^1\.\s/.test(name)) return null
  const phone = name.match(/(?:^|\s)(0\d{9,12})(?=\s|$)/)?.[1] ?? ''
  if (phone) name = name.replace(phone, '')
  name = name.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+/g, ' ').trim()
  const ownerType = /^(PT|CV|UD)\.?\s/i.test(name) ? 'company' : 'customer'
  return { name, phone, ownerType }
}

// --- visit-level fields -----------------------------------------------------

const pad = (n) => String(n).padStart(2, '0')

/** ISO date, or null. Excel serials and the d/m/yyyy the shop typed both occur. */
function parseDate(raw) {
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(raw)) * 86400000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const m = raw.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  // Two digits is a short year; three is a dropped digit — "203" and "024"
  // are both 2023/2024 (the caller still flags the row, with the original).
  const y = m[3]
  const year = y.length === 2 ? 2000 + Number(y)
    : /^20\d$/.test(y) ? 2020 + Number(y[2])
    : /^0\d\d$/.test(y) ? 2000 + Number(y)
    : Number(y)
  if (month < 1 || month > 12 || day < 1 || year < 2000 || year > 2100) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** { plate, note, review }: a plate as the app stores it, or why there isn't one. */
function parsePlate(raw) {
  const s = (raw ?? '').toUpperCase().replace(/[`']/g, '').replace(/\s+/g, ' ').trim()
  if (!s) return { plate: '', note: '', review: true }
  // A bare number in the plate column is a KM reading typed one cell left.
  if (/^\d{4,}$/.test(s)) return { plate: '', note: `No. Polisi tertulis: ${raw}`, review: true }
  // "H 8997 NA480235": the plate with the KM run straight into it.
  const glued = s.match(/^([A-Z]{1,2} ?\d{1,4} ?[A-Z]{1,3})(\d{4,})$/)
  if (glued) return { plate: glued[1], note: `No. Polisi tertulis: ${raw}`, review: true }
  return { plate: s, note: '', review: false }
}

const isUnknownKm = (s) => /^(mati|\?+|-+)$/i.test((s ?? '').trim())

/** { km, note, review } */
function parseKm(raw) {
  if (!raw) return { km: '', note: '', review: false }
  if (/^\d[\d.,]*$/.test(raw)) return { km: raw.replace(/\D/g, ''), note: '', review: false }
  // "Mati" (dead odometer), "?" — the shop's own way of saying "unknown".
  if (isUnknownKm(raw)) return { km: '', note: `KM: ${raw}`, review: false }
  // Anything else is text that landed in the wrong column.
  return { km: '', note: `KM tertulis: ${raw}`, review: true }
}

// --- line items -------------------------------------------------------------

const UNITS = new Map(Object.entries({
  lt: 'Lt', ltr: 'Lt', liter: 'Lt', l: 'Lt',
  gln: 'Gln', gl: 'Gln', galon: 'Gln', gal: 'Gln',
  bt: 'Bt', btl: 'Bt', botol: 'Bt',
  pc: 'Pc', pcs: 'Pc', bh: 'Pc', buah: 'Pc',
  bd: 'Bd', set: 'Set', kg: 'Kg', dus: 'Dus', psg: 'Psg', tube: 'Tube', kaleng: 'Kaleng',
}))

/** A unit as stored, tolerating the shop's typos ("Glkn", "GlN", "Btl"), or ''. */
function unitOf(word) {
  const w = word.toLowerCase()
  if (UNITS.has(w)) return UNITS.get(w)
  if (/^gl[a-z]{1,4}$/.test(w)) return 'Gln'
  if (/^bo?t[a-z]{0,3}$/.test(w)) return 'Bt'
  return ''
}

const tidy = (s) => s.replace(/^[@=\s]+|[@=\s]+$/g, '').replace(/\s+/g, ' ').trim()
const joinNote = (...parts) => parts.map((p) => (p ?? '').trim()).filter(Boolean).join('; ')
const parseQty = (s) => Number(s.replace(',', '.'))
/**
 * Whole Rupiah — separators dropped, never interpreted (same rule as
 * parseIdrAmount). A four-digit thousands group ("125.0000") is a typo for
 * three: the extra trailing digit is dropped and `fixed` set so the row gets
 * reviewed.
 */
function parsePriceChecked(s) {
  let fixed = false
  if (/[.,/]\d{4}$/.test(s)) { s = s.slice(0, -1); fixed = true }
  const digits = s.replace(/\D/g, '')
  return { price: digits ? Number(digits) : null, fixed }
}
const parsePrice = (s) => parsePriceChecked(s).price

/**
 * Split "<name> @ <price> <trailing note>". The shop also wrote "=" for "@",
 * left it out ("8 Lt  38.000"), and typed "2" for it ("1 Gln 2 425.000").
 */
function splitPrice(rest) {
  rest = rest.trim()
  let before
  let after
  // "@" is a unit price; "=" is what the whole line came to — "1,2 Lt =
  // 60.000" is 50.000/Lt, "4 Bt = 450.000" is ~112.500 a bottle.
  const isTotal = rest.lastIndexOf('=') > rest.lastIndexOf('@')
  const at = Math.max(rest.lastIndexOf('@'), rest.lastIndexOf('='))
  if (at >= 0) {
    before = rest.slice(0, at)
    after = rest.slice(at + 1)
  } else {
    const t = rest.match(/^(.*?)\s*(\d{1,3}(?:[.,/]\d{3,4})+|\d{4,})(\s.*)?$/)
    if (!t) return { name: tidy(rest), price: null, note: '', isTotal: false, fixed: false }
    before = /^\s*\d\s*$/.test(t[1]) ? '' : t[1]
    after = t[2] + (t[3] ?? '')
  }
  const pm = after.trim().match(/^(\d[\d.,/]*\d|\d)\s*(.*)$/)
  if (!pm) return { name: tidy(`${before} ${after}`), price: null, note: '', isTotal: false, fixed: false }
  const { price, fixed } = parsePriceChecked(pm[1])
  return { name: tidy(before), price, note: tidy(pm[2]), isTotal, fixed }
}

/**
 * One cell's text, classified:
 * - amount — a price on its own ("85000", "@ 75.000", "55.000 (Turbo)")
 * - qty    — quantity first ("9 Lt @ 50.000", "3 Lt", "2 Pc Bolam = 25.000")
 * - named  — a name with a price ("FSA @ 80.000 (FC-1003)", "Baut 1 Pc @ 15.000")
 * - text   — anything else (a product name, a part code, "Ganti")
 */
function parseCell(raw) {
  let s = raw.replace(/^[`'\\]+|[`\\]+$/g, '').replace(/\s+/g, ' ').trim()
  let note = ''
  const paren = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  if (paren && paren[1]) {
    s = paren[1].trim()
    note = paren[2].trim()
  }

  const amount = s.match(/^[@=]?\s*(\d{1,3}(?:[.,/]\d{3,4})+|\d{4,})$/)
  if (amount) {
    const { price, fixed } = parsePriceChecked(amount[1])
    // Small bare numbers are part codes or counts ("3307", "13"), not prices.
    if (price >= 5000) return { kind: 'amount', price, note, isTotal: false, fixed }
    return { kind: 'text', name: raw.trim(), note: '' }
  }

  // Not a quantity when it runs into a dash or slash — that's a part code
  // ("23390-YZZA1", "983-1") — or is too big to be one.
  const q = s.match(/^(\d+(?:[.,]\d{1,2})?)(?![\d.,/-])\s*([A-Za-z]+\.?)?\s*(.*)$/)
  if (q && parseQty(q[1]) <= 100) {
    const qty = parseQty(q[1])
    const word = (q[2] ?? '').replace(/\.$/, '')
    let rest = q[3]
    let unit = unitOf(word)
    if (word && !unit) rest = `${word} ${rest}`
    const split = splitPrice(rest)
    // "2 t @ 200.000": a one- or two-letter word right after the quantity is a
    // unit the table above doesn't know, not a product name.
    if (!unit && split.name && split.name.length <= 2 && /^[A-Za-z]+$/.test(split.name)) {
      unit = split.name
      split.name = ''
    }
    return {
      kind: split.name ? 'named' : 'qty',
      name: split.name, qty, unit, price: split.price, note: joinNote(split.note, note),
      isTotal: split.isTotal, fixed: split.fixed,
    }
  }

  const split = splitPrice(s)
  let name = split.name
  let qty = null
  let unit = ''
  // A quantity at the end of the name: "Baut 1 Pc", "Air Aki 2 Bt", "Napel 2".
  const tail = name.match(/^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)?$/)
  if (tail) {
    const tailUnit = tail[3] ? unitOf(tail[3]) : ''
    const n = parseQty(tail[2])
    if ((tail[3] && tailUnit) || (!tail[3] && split.price != null && n <= 20)) {
      name = tail[1]
      qty = n
      unit = tailUnit ?? ''
    }
  }
  const hasPriceMark = /[@=]/.test(s)
  return {
    kind: split.price != null || hasPriceMark ? 'named' : 'text',
    name, qty, unit, price: split.price, note: joinNote(split.note, note),
    isTotal: split.isTotal, fixed: split.fixed,
  }
}

function newItem(section, fields, raw) {
  return {
    section, name: '', qty: null, unit: '', price: null, isTotal: false, fixed: false, note: '',
    review: false, raw: [raw], ...fields,
  }
}

/** The price half of a parsed cell, as item fields. */
const priced = (p) => ({ price: p.price, isTotal: Boolean(p.isTotal), fixed: Boolean(p.fixed) })

/**
 * Mesin / Gardan / Transmisi / Lain-lain: the name is written first, the
 * "qty unit @ price" under it. A second quantity line under a finished item
 * is more of the same oil ("4,5 Lt @ 38.000" then "2 Lt @ 38.000", a gallon
 * then "2 Bt"), so it repeats the name.
 */
function nameFirst(section, texts) {
  const items = []
  const pending = () => {
    const last = items.at(-1)
    return last && last.price == null && last.qty == null ? last : null
  }
  for (const raw of texts) {
    const p = parseCell(raw)
    const open = pending()
    if (p.kind === 'text') {
      if (open || /sendiri/i.test(raw)) {
        const last = items.at(-1)
        if (last) { last.note = joinNote(last.note, raw); last.raw.push(raw); continue }
      }
      items.push(newItem(section, { name: p.name }, raw))
    } else if (p.kind === 'amount') {
      if (open) Object.assign(open, { qty: 1, ...priced(p), note: joinNote(open.note, p.note) }), open.raw.push(raw)
      else items.push(newItem(section, { name: items.at(-1)?.name ?? section, qty: 1, ...priced(p), note: p.note }, raw))
    } else if (p.kind === 'qty') {
      if (open) Object.assign(open, { qty: p.qty, unit: p.unit, ...priced(p), note: joinNote(open.note, p.note) }), open.raw.push(raw)
      else {
        const prev = items.at(-1)
        items.push(newItem(section, {
          name: prev?.name ?? section, qty: p.qty, unit: p.unit, ...priced(p), note: p.note,
          // Repeating the oil's name is safe; repeating a Lain-lain item's isn't.
          review: !prev || section === 'Lain-lain',
        }, raw))
      }
    } else {
      items.push(newItem(section, { name: p.name, qty: p.qty, unit: p.unit, ...priced(p), note: p.note }, raw))
    }
  }
  return items
}

/**
 * Filter Oli / Filter Solar / Filter Udara / Inveten: the price comes first,
 * and the line under it is the part code, brand or count ("983-1", "Denso",
 * "AC", "13"). Only a line with its own "@ price" — "FSB @ 65.000" under
 * "FSA @ 80.000" — or a second bare price is a second item.
 */
function priceFirst(section, texts) {
  const items = []
  for (const raw of texts) {
    const p = parseCell(raw)
    const last = items.at(-1)
    if (!last) {
      if (p.kind === 'text') {
        const ganti = /^ganti$/i.test(raw.trim())
        items.push(newItem(section, { name: ganti ? section : p.name, note: ganti ? raw : '' }, raw))
      } else {
        items.push(newItem(section, {
          name: p.name || section, qty: p.qty ?? 1, unit: p.unit ?? '', ...priced(p), note: p.note,
        }, raw))
      }
      continue
    }
    if (p.kind === 'amount' && last.price == null) {
      Object.assign(last, { qty: last.qty ?? 1, ...priced(p), note: joinNote(last.note, p.note) })
      last.raw.push(raw)
    } else if (p.price != null && (p.kind === 'amount' || /[@=]/.test(raw))) {
      items.push(newItem(section, {
        name: p.name || section, qty: p.qty ?? 1, unit: p.unit ?? '', ...priced(p), note: p.note,
      }, raw))
    } else {
      last.note = joinNote(last.note, raw)
      last.raw.push(raw)
    }
  }
  return items
}

const SECTIONS = [
  ['F', 'Mesin', nameFirst], ['G', 'Gardan', nameFirst], ['H', 'Transmisi', nameFirst],
  ['I', 'Filter Oli', priceFirst], ['J', 'Filter Solar', priceFirst], ['K', 'Filter Udara', priceFirst],
  ['L', 'Inveten', priceFirst], ['M', 'Lain-lain', nameFirst],
]

// Per-unit prices above these are almost certainly a slipped digit
// ("Med SX 9 Lt @ 545.000") — flagged, never corrected: only the shop knows
// whether it was 45.000 or 54.500.
const MAX_UNIT_PRICE = { Lt: 250_000, Bt: 400_000, Gln: 2_000_000 }

function finishItem(item) {
  if (item.price == null && /sendiri/i.test(`${item.name} ${item.note}`)) {
    // The customer brought their own oil — no charge, and nothing to review.
    item.price = 0
  }
  if (item.price != null && item.qty == null) item.qty = 1
  const usable = item.price != null && item.qty != null && Number.isFinite(item.qty) && item.qty > 0
  if (!usable || !item.name) item.review = true

  item.total = null
  item.unitPrice = item.price
  if (usable) {
    if (item.isTotal) {
      item.total = item.price
      item.unitPrice = Math.round(item.price / item.qty)
    } else {
      item.total = Math.round(item.qty * item.price)
    }
    const max = MAX_UNIT_PRICE[item.unit]
    if (max && item.unitPrice > max) { item.review = true; item.note = joinNote(item.note, 'harga per unit tidak wajar?') }
  }
  if (item.fixed) { item.review = true; item.note = joinNote(item.note, 'harga diperbaiki dari tulisan asli') }
  return item
}

// --- one file ---------------------------------------------------------------

function parseServiceLog(rows) {
  const headerIdx = rows.findIndex((r) => /^no\.?$/i.test(r.cells.A ?? '') || /^tanggal$/i.test(r.cells.B ?? ''))
  const visits = []
  let current = null
  for (const { rowNum, cells } of rows.slice(headerIdx + 1)) {
    const a = cells.A ?? ''
    if (/^\d+$/.test(a)) {
      // The template pre-numbers empty slots; a number with nothing beside it
      // ends the previous visit without starting one.
      const hasData = Object.keys(cells).some((c) => c !== 'A')
      current = hasData ? { no: Number(a), rowNum, lines: [cells] } : null
      if (current) visits.push(current)
    } else if (current && Object.keys(cells).length > 0) {
      current.lines.push(cells)
    }
  }
  return visits
}

const looksLikePlate = (s) => /^[A-Z]{1,2} ?\d{1,4} ?[A-Z]{1,3}$/i.test((s ?? '').trim())
const looksLikeKm = (s) => /^\d{4,}$/.test((s ?? '').trim())

/**
 * A handful of visits were typed one column off. Shifted back here so the
 * oil written under "KM" still becomes a priced Mesin line instead of a note:
 * - the whole row one column right (plate under KM, KM under Mesin);
 * - plate under "Jenis mobil" and KM under "No. Polisi" (the oil then
 *   sometimes under "KM" too);
 * - the KM glued to the oil name ("564265Med Sx").
 * Returns the visit's lines realigned, plus the Mesin text found under KM.
 */
function realign(lines) {
  let first = lines[0]
  if (!first.D && looksLikePlate(first.E) && looksLikeKm(first.F)) {
    const cols = 'DEFGHIJKLM'
    lines = lines.map((l) => {
      const o = { A: l.A, B: l.B, C: l.C }
      for (let i = 0; i < cols.length; i++) {
        const from = cols[i + 1] ?? 'N'
        if (l[from]) o[cols[i]] = l[from]
      }
      return o
    })
    first = lines[0]
  }

  let plateRaw = first.D
  let kmRaw = first.E
  let vehicle = first.C ?? ''
  let shifted = false
  const eIsText = Boolean(first.E) && !/^\d[\d.,]*$/.test(first.E) && !isUnknownKm(first.E)
  if (looksLikePlate(first.C) && (looksLikeKm(first.D) || (!first.D && eIsText))) {
    plateRaw = first.C
    kmRaw = first.D
    vehicle = ''
    shifted = true
  }

  // Text under "KM" — oil written one column early, possibly glued to the KM.
  let mesinUnderKm = []
  if (eIsText) {
    const glued = first.E.match(/^(\d{4,})\s*([A-Za-z].*)$/)
    if (glued && !shifted) kmRaw = glued[1]
    else if (!shifted) kmRaw = ''
    mesinUnderKm = lines.map((l, i) => (i === 0 && glued ? glued[2] : l.E)).filter(Boolean)
  }
  return { lines, plateRaw, kmRaw, vehicle, shifted: shifted || eIsText, mesinUnderKm }
}

function convertVisit(visit) {
  const { lines, plateRaw, kmRaw, vehicle, shifted, mesinUnderKm } = realign(visit.lines)
  const [first, ...more] = lines
  const notes = []
  let review = shifted

  const date = first.B ? parseDate(first.B) : null
  const yearRepaired = date != null && /[/.-]\s*\d{3}$/.test(first.B)
  // The logs start in 2021; an earlier year is a typo ("14/7/2012" among
  // 2023 visits). Kept as written, but flagged — only the shop knows the year.
  const implausible = date != null && date < '2020-01-01'
  if (!date || yearRepaired || implausible) { review = true; if (first.B) notes.push(`Tanggal tertulis: ${first.B}`) }

  const plate = parsePlate(plateRaw)
  if (plate.note) notes.push(plate.note)
  review ||= plate.review

  const km = parseKm(kmRaw)
  if (km.note) notes.push(km.note)
  review ||= km.review
  if (shifted) notes.push('kolom bergeser di Excel, sudah disesuaikan')

  // Anything written under the date / type / plate / KM ("Ex 2468 EF").
  for (const line of more) {
    for (const col of mesinUnderKm.length ? ['B', 'C', 'D'] : ['B', 'C', 'D', 'E']) if (line[col]) notes.push(line[col])
  }

  const items = mesinUnderKm.length ? nameFirst('Mesin', mesinUnderKm).map(finishItem) : []
  for (const [col, section, assemble] of SECTIONS) {
    const texts = lines.map((l) => l[col]).filter(Boolean)
    if (texts.length) items.push(...assemble(section, texts).map(finishItem))
  }

  return {
    visitNo: visit.no,
    date: date ?? first.B ?? '',
    vehicle,
    plate: plate.plate,
    km: km.km,
    visitNote: notes.join('; '),
    review,
    items,
  }
}

// --- csv --------------------------------------------------------------------

const COLUMNS = [
  'source_file', 'owner_type', 'owner_name', 'phone', 'plate', 'vehicle', 'visit_no', 'visit_date',
  'km', 'visit_note', 'section', 'item', 'qty', 'unit', 'unit_price', 'line_total', 'note', 'raw',
  'needs_review',
]

function csvField(v) {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// --- main -------------------------------------------------------------------

const [inDir, outDir] = process.argv.slice(2)
if (!inDir || !outDir) {
  console.error('Usage: node scripts/convert-pelanggan-xlsx.mjs <xlsx-folder> <out-folder>')
  process.exit(1)
}

const out = [COLUMNS.join(',')]
const stats = { files: 0, skipped: [], failed: [], owners: 0, companies: 0, visits: 0, items: 0, reviewRows: 0, total: 0 }
const plates = new Set()

for (const file of readdirSync(inDir).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$')).sort()) {
  stats.files++
  const owner = parseOwner(file)
  if (!owner) { stats.skipped.push(file); continue }

  let visits
  try {
    visits = parseServiceLog(readFirstSheet(join(inDir, file))).map(convertVisit)
  } catch (err) {
    stats.failed.push(`${file}: ${err.message}`)
    continue
  }

  stats.owners++
  if (owner.ownerType === 'company') stats.companies++
  const base = { source_file: file, owner_type: owner.ownerType, owner_name: owner.name, phone: owner.phone }
  const emit = (row) => {
    out.push(COLUMNS.map((c) => csvField(row[c])).join(','))
    if (row.needs_review === 'yes') stats.reviewRows++
  }

  if (visits.length === 0) { emit(base); continue }

  for (const v of visits) {
    stats.visits++
    plates.add(`${owner.name}|${v.plate.replace(/\s/g, '')}`)
    const visitCols = {
      ...base, plate: v.plate, vehicle: v.vehicle, visit_no: v.visitNo, visit_date: v.date,
      km: v.km, visit_note: v.visitNote,
    }
    if (v.items.length === 0) { emit({ ...visitCols, needs_review: v.review ? 'yes' : '' }); continue }
    for (const it of v.items) {
      stats.items++
      stats.total += it.total ?? 0
      emit({
        ...visitCols,
        section: it.section, item: it.name, qty: it.qty ?? '', unit: it.unit,
        unit_price: it.unitPrice ?? '', line_total: it.total ?? '', note: it.note,
        raw: it.raw.join(' / '), needs_review: v.review || it.review ? 'yes' : '',
      })
    }
  }
}

mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'pelanggan-import.csv')
// BOM so Excel reads it as UTF-8; CRLF because it's headed for Excel on Windows.
writeFileSync(outPath, '﻿' + out.join('\r\n') + '\r\n', 'utf8')

console.log(`Wrote ${outPath}`)
console.log(`  files read        ${stats.files}  (skipped templates: ${stats.skipped.join(', ') || 'none'})`)
console.log(`  owners            ${stats.owners}  (${stats.companies} companies, ${stats.owners - stats.companies} customers)`)
console.log(`  vehicles          ${plates.size}  (distinct owner + plate)`)
console.log(`  visits            ${stats.visits}`)
console.log(`  line items        ${stats.items}`)
console.log(`  total value       Rp ${stats.total.toLocaleString('id-ID')}`)
console.log(`  rows to review    ${stats.reviewRows}`)
if (stats.failed.length) console.log(`  FAILED:\n    ${stats.failed.join('\n    ')}`)
