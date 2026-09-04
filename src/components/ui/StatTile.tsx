import type { ReactNode } from 'react'

/** A label/value pair rendered as one stat — the "Total Visits" / "Total
 *  Spent" tiles ServiceHistory.tsx and VehicleServiceHistoryDialog each
 *  hand-duplicated. Not SunkenTile: that one is a container, this is the
 *  label+value content that goes inside a caller's own grid. */
export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-caption">{label}</p>
      <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
    </div>
  )
}
