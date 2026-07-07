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
