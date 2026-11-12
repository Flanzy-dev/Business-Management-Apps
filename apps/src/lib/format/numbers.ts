// Small related modules kept in one file, one section each with its original notes: currency,
// units.

// ---- currency ----

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Compact IDR for chart axis ticks: "Rp 2,4 M" (miliar), "Rp 1,2 jt" (juta),
 * "Rp 850 rb" (ribu). Tooltips should keep the full formatCurrency value.
 */
export function formatCompactIDR(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  if (abs >= 1e9) return `${sign}Rp ${fmt(abs / 1e9)} M`
  if (abs >= 1e6) return `${sign}Rp ${fmt(abs / 1e6)} jt`
  if (abs >= 1e3) return `${sign}Rp ${fmt(abs / 1e3)} rb`
  return `${sign}Rp ${fmt(abs)}`
}

// ---- units ----

// Distance/volume formatting — metric throughout (DESIGN_SYSTEM.md §6).

/**
 * Pinned-locale grouping for a bare km number, no unit suffix — for call
 * sites that interpolate the number into a translation string that already
 * spells out "km" itself (e.g. i18n's `scheduleLineKm: 'every {{interval}} km
 * from {{base}}'`). Bare `n.toLocaleString()` with no locale argument uses
 * the runtime's default locale, which is why km grouping used to render
 * differently depending on which of these interpolation call sites you
 * looked at; this and formatDistance below now share the same locale.
 *
 * Always 'id-ID', whatever the UI language, to match formatCurrency: "45.000 km"
 * beside "Rp 45.000". 'en-US' printed "45,000 km", which an Indonesian reads as
 * 45 km (the comma is their decimal mark) — on receipts and WhatsApp reminders.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('id-ID')
}

export function formatDistance(km: number): string {
  return `${formatNumber(km)} km`
}
