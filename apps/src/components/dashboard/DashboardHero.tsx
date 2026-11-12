import { formatDateLong } from '../../lib/format/dates'

interface HeroStat {
  label: string
  value: string
}

interface DashboardHeroProps {
  stats?: HeroStat[]
}

/**
 * Dashboard status strip: today's date on the left, the compact live-stat
 * strip on the right, on one row. The page title already sits in the topbar,
 * and this is the screen the shop reopens all day, so there is no headline or
 * greeting to re-read each time. Fades in once via `animate-hero-reveal`
 * (index.css); honors prefers-reduced-motion.
 */
export function DashboardHero({ stats }: DashboardHeroProps) {
  return (
    <section className="animate-hero-reveal relative overflow-hidden mb-6 bg-bg-2 border border-border-2 rounded-radius-md">
      {/* Flat amber edge — the sole warm note, no gradient per DESIGN_SYSTEM.md */}
      <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-6 pr-4 py-3">
        <span className="text-2xs uppercase font-semibold tracking-wide text-fg-3">
          {formatDateLong(new Date())}
        </span>

        {stats && stats.length > 0 && (
          <div className="flex items-stretch divide-x divide-border-1 bg-bg-0 border border-border-1 rounded-radius-sm">
            {stats.map(stat => (
              <div key={stat.label} className="px-5 py-2 flex flex-col gap-1 min-w-[8rem]">
                <span className="text-2xs uppercase font-semibold tracking-wide text-fg-3">
                  {stat.label}
                </span>
                <span className="font-mono text-xl text-fg-1 leading-none tabular-nums">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
