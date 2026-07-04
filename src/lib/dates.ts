// Shared date/time formatters — one place for the app's date presentation,
// replacing the several ad-hoc `formatDate` helpers previously copied across
// pages. Output stays en-US for now (locale change is a separate task).

/** "Jan 5, 2026, 2:30 PM" — short date + time (order rows, timestamps). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "Jan 5, 2026" — short date only. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Monday, January 5, 2026" — long, weekday-prefixed date. Accepts Date or ISO string. */
export function formatDateLong(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "2:30 PM" — time only. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
