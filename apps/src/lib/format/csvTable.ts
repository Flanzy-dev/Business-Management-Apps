// Reading a CSV the shop picked, generically — what every importer needs
// before its own rules start. Pure, no stores, no DOM.
//
// Three importers read CSVs (products: productImport.ts, services:
// serviceImport.ts, the Excel history: customerHistoryImport.ts). Each used
// to redo the same steps by hand — split the text, normalize the header row,
// index the columns, bail on an empty file or a missing required column, trim
// each field — and the generic splitter lived inside the product importer,
// so the other two reached into it. Those steps live here now; an importer
// declares its columns and gets rows it can ask by name.

import { translate } from '../i18n'

/** A problem with one line of the file (line 0 = the file as a whole). */
export interface ImportError {
  line: number
  message: string
}

/**
 * Split CSV text into rows of fields (RFC4180: quoted fields may contain the
 * delimiter, newlines and doubled quotes). Written out rather than pulled from
 * a dependency — the app ships offline and these are the only CSVs it reads.
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Strip a UTF-8 BOM: Excel writes one, and it would otherwise become part of
  // the first header name and stop "name" from matching.
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === delimiter) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  row.push(field)
  rows.push(row)

  // Trailing newline leaves one empty row; blank lines mid-file are skipped too.
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/**
 * ';' when the header line uses it and no ',' — what Excel writes on an
 * Indonesian-locale Windows, where ',' is the decimal separator. ',' otherwise.
 */
export function sniffDelimiter(text: string): ',' | ';' {
  const header = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? ''
  return header.includes(';') && !header.includes(',') ? ';' : ','
}

/**
 * Whole Rupiah from however a sheet wrote it: "6.500.000", "6,500,000" and
 * "6500000" are all 6500000. Separators are dropped rather than interpreted —
 * IDR has no minor unit in practice (see AGENTS.md's conventions), and guessing which of "."
 * and "," meant a decimal point would be the one way to be wrong by a factor
 * of a thousand.
 *
 * The one thing that is recognised is a trailing fraction of ONE OR TWO digits
 * ("65000.00", "65.000,00", "45000.0"), which Excel appends when a column is
 * re-saved as a Number with decimals. It is discarded — otherwise its digits
 * would be glued on and the amount inflated 10x or 100x. A thousands group is
 * always exactly three digits, so "6.500.000" and "72.500" can never be
 * mistaken for it.
 */
export function parseIdrAmount(raw: string): number {
  const digits = raw
    .replace(/[.,]\d{1,2}\s*$/, '')
    .replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

/** "Sell Price", "sell_price", "sellPrice" and "sell-price" all address one column. */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, '')
}

/** One data row, its fields reachable by declared column name (trimmed; '' when the column is absent). */
export interface CsvRow<C extends string> {
  /** 1-based line number in the file, for error messages. */
  line: number
  at: (column: C) => string
}

export type CsvTable<C extends string> =
  | { ok: true; rows: CsvRow<C>[]; has: (column: C) => boolean }
  | { ok: false; error: ImportError }

/**
 * Read `text` as a table with a header row. Columns are matched by
 * normalizeHeader on both sides, so the declared names can be written any of
 * the ways a sheet might; unknown columns are ignored. Fails — as a whole-file
 * error, never per row — on an empty file or when `required` has no column.
 */
export function readCsvTable<C extends string>(
  text: string,
  columns: readonly C[],
  opts: { required: C; delimiter?: ',' | ';' | 'auto'; missingRequired?: string }
): CsvTable<C> {
  const delimiter = opts.delimiter === 'auto' ? sniffDelimiter(text) : (opts.delimiter ?? ',')
  const table = parseCsv(text, delimiter)
  if (table.length === 0) return { ok: false, error: { line: 0, message: translate('importErrors.fileEmpty') } }

  const headers = table[0].map(normalizeHeader)
  const index = new Map<C, number>(columns.map((c) => [c, headers.indexOf(normalizeHeader(c))]))
  if ((index.get(opts.required) ?? -1) < 0) {
    return { ok: false, error: { line: 1, message: opts.missingRequired ?? translate('importErrors.missingColumn', { column: opts.required }) } }
  }

  const rows = table.slice(1).map((fields, i): CsvRow<C> => ({
    line: i + 2,
    at: (column) => {
      const at = index.get(column) ?? -1
      return at >= 0 ? (fields[at] ?? '').trim() : ''
    },
  }))
  return { ok: true, rows, has: (column) => (index.get(column) ?? -1) >= 0 }
}
