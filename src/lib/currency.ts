export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Abbreviated form for large sums, e.g. "Rp 11.2M" (DESIGN.md §7). Falls back to
// the full formatted amount below the abbreviation threshold.
export function formatCurrencyCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`
  return formatCurrency(amount)
}
