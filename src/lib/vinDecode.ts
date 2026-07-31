// Offline VIN decode — manufacturer (WMI), country, and approximate model
// year. No network access, deliberately: the app makes zero outbound
// requests anywhere (see CLAUDE.md), and a free online decoder (NHTSA vPIC)
// is US-market data that would mostly come back empty for Indonesia-market
// vehicles this shop actually services. Pure — no store/i18n access, same as
// inventoryCosting.ts/scheduleEngine.ts.
export interface VinDecodeResult {
  /** First 3 characters, uppercase. '' when the input isn't 17 characters. */
  wmi: string
  manufacturer: string | null
  country: string | null
  modelYear: number | null
}

interface WmiInfo {
  manufacturer: string
  country: string
}

/**
 * World Manufacturer Identifier (WMI, ISO 3780) lookup — a SMALL, CONSERVATIVE
 * starter set of well-documented codes, NOT an authoritative or complete
 * registry. Keyed by a 2- or 3-character prefix; the longest match wins.
 *
 * Deliberately excludes Indonesia-assembly-plant codes (Astra Daihatsu Motor,
 * Astra Toyota, Honda Prospect Motor, Suzuki Indomobil, etc.) — those aren't
 * codes we're confident enough in to assert; a wrong manufacturer guess here
 * actively misleads a shop that trusts the field. Extend this object as real
 * examples turn up (e.g. from this shop's own vehicles) rather than guessing.
 */
const WMI_TABLE: Record<string, WmiInfo> = {
  '1HG': { manufacturer: 'Honda', country: 'United States' },
  JHM: { manufacturer: 'Honda', country: 'Japan' },
  JT: { manufacturer: 'Toyota', country: 'Japan' },
  JN: { manufacturer: 'Nissan', country: 'Japan' },
  JM: { manufacturer: 'Mazda', country: 'Japan' },
  KMH: { manufacturer: 'Hyundai', country: 'South Korea' },
  KNA: { manufacturer: 'Kia', country: 'South Korea' },
  WBA: { manufacturer: 'BMW', country: 'Germany' },
  WBS: { manufacturer: 'BMW', country: 'Germany' },
  WDB: { manufacturer: 'Mercedes-Benz', country: 'Germany' },
  WDD: { manufacturer: 'Mercedes-Benz', country: 'Germany' },
  WVW: { manufacturer: 'Volkswagen', country: 'Germany' },
  '1G1': { manufacturer: 'Chevrolet', country: 'United States' },
  '1FA': { manufacturer: 'Ford', country: 'United States' },
  '1FT': { manufacturer: 'Ford', country: 'United States' },
}

/**
 * Country-only fallback when WMI_TABLE has no match — the first character
 * alone maps to a broad region under ISO 3780. Only the handful we're
 * confident about; anything else stays fully unknown rather than guessed.
 */
const REGION_TABLE: Record<string, string> = {
  '1': 'United States',
  '4': 'United States',
  '5': 'United States',
  '2': 'Canada',
  '3': 'Mexico',
  '6': 'Australia',
  '9': 'Brazil',
  J: 'Japan',
  K: 'South Korea',
  W: 'Germany',
  S: 'United Kingdom',
  Z: 'Italy',
}

function lookupWmi(vin: string): { manufacturer: string | null; country: string | null } {
  const wmi3 = vin.slice(0, 3)
  const wmi2 = vin.slice(0, 2)
  const exact = WMI_TABLE[wmi3] ?? WMI_TABLE[wmi2]
  if (exact) return { manufacturer: exact.manufacturer, country: exact.country }
  return { manufacturer: null, country: REGION_TABLE[vin[0]] ?? null }
}

// Position 10 (index 9) — model year code, ISO 3779. I/O/Q/U/Z and 0 are
// never used as year codes.
const YEAR_CODES: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009,
}
const CYCLE_YEARS = 30

/**
 * The year code cycles every 30 years (e.g. 'A' = 1980 or 2010), so the
 * standard disambiguation is position 7 (index 6): a letter there means the
 * newer cycle, a digit means the older one.
 */
export function decodeModelYear(vin: string): number | null {
  if (vin.length !== 17) return null
  const base = YEAR_CODES[vin[9]]
  if (base === undefined) return null
  const newerCycle = /[A-Z]/.test(vin[6])
  return newerCycle ? base + CYCLE_YEARS : base
}

/**
 * Decodes what an offline lookup can honestly know: manufacturer/country
 * from the WMI (when the prefix is in WMI_TABLE, else country-only from
 * REGION_TABLE, else both null) and an approximate model year. Anything not
 * exactly 17 characters decodes to nothing — mirrors validateVIN's stance
 * that an incomplete VIN just isn't decodable, not an error to throw on.
 */
export function decodeVin(vin: string): VinDecodeResult {
  const cleaned = vin.toUpperCase()
  if (cleaned.length !== 17) return { wmi: '', manufacturer: null, country: null, modelYear: null }
  const { manufacturer, country } = lookupWmi(cleaned)
  return { wmi: cleaned.slice(0, 3), manufacturer, country, modelYear: decodeModelYear(cleaned) }
}
