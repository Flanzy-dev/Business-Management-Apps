// Distance/volume formatting — metric throughout (DESIGN.md §7).

/**
 * Pinned-locale grouping for a bare km number, no unit suffix — for call
 * sites that interpolate the number into a translation string that already
 * spells out "km" itself (e.g. i18n's `scheduleLineKm: 'every {{interval}} km
 * from {{base}}'`). Bare `n.toLocaleString()` with no locale argument uses
 * the runtime's default locale, which is why km grouping used to render
 * differently depending on which of these interpolation call sites you
 * looked at; this and formatDistance below now share the same locale.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatDistance(km: number): string {
  return `${formatNumber(km)} km`
}
