// Distance/volume formatting — metric throughout (DESIGN.md §7).

export function formatDistance(km: number): string {
  return `${km.toLocaleString('en-US')} km`
}

export function formatVolume(liters: number): string {
  return `${liters.toLocaleString('en-US', { maximumFractionDigits: 1 })} L`
}
