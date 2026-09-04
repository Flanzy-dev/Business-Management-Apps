import { resolveDeltaTone, deltaPrefix, type DeltaTone } from '../../lib/statCard'

const deltaToneClass: Record<DeltaTone, string> = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-fg-3',
}

/** The small badge beside a StatCard's icon: an em-dash with no baseline at
 *  all (delta === null, distinct from an actual 0%), the percent otherwise —
 *  or nothing when there's no delta prop at all (delta === undefined). */
export function StatCardDelta({ delta, tone: override }: { delta?: number | null; tone?: DeltaTone }) {
  if (delta === null) return <span className="font-mono text-xs text-fg-3">—</span>
  if (delta === undefined) return null
  const tone = resolveDeltaTone(delta, override)
  if (!tone) return null
  return (
    <span className={`font-mono text-xs ${deltaToneClass[tone]}`}>
      {deltaPrefix(delta)}{delta}%
    </span>
  )
}
