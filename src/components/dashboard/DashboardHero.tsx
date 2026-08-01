import { formatDateLong } from '../../lib/dates'

interface HeroStat {
  label: string
  value: string
}

interface DashboardHeroProps {
  title: string
  titleLine2?: string
  description: string
  stats?: HeroStat[]
}

/**
 * Hero-style Dashboard header band: eyebrow date, two-line display headline,
 * subline, and a compact live-stat strip. Staggered entrance via the CSS-only
 * `animate-hero-reveal` keyframe (index.css); honors prefers-reduced-motion.
 */
export function DashboardHero({ title, titleLine2, description, stats }: DashboardHeroProps) {
  const reveal = (delayMs: number) => ({
    className: 'animate-hero-reveal',
    style: { animationDelay: `${delayMs}ms` },
  })

  return (
    <section className="relative overflow-hidden mb-6 bg-bg-2 border border-border-1 rounded-radius-md">
      {/* Flat amber wash tile — the sole warm note, no gradient per DESIGN.md */}
      <div className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-3 max-w-2xl">
          <p {...reveal(0)}>
            <span className="text-2xs uppercase font-semibold tracking-wide text-fg-3">
              {formatDateLong(new Date())}
            </span>
          </p>
          <h1
            className="animate-hero-reveal font-display text-3xl md:text-4xl font-[540] tracking-tight text-fg-1 leading-tight text-balance"
            style={{ animationDelay: '100ms' }}
          >
            {title}
            {titleLine2 && (
              <>
                <br />
                {titleLine2}
              </>
            )}
          </h1>
          <p {...reveal(200)}>
            <span className="block text-sm text-fg-2 max-w-md">{description}</span>
          </p>
        </div>

        {stats && stats.length > 0 && (
          <div {...reveal(300)}>
            <div className="flex items-stretch divide-x divide-border-1 bg-bg-0 border border-border-1 rounded-radius-sm">
              {stats.map(stat => (
                <div key={stat.label} className="px-5 py-3 flex flex-col gap-1 min-w-[8rem]">
                  <span className="text-2xs uppercase font-semibold tracking-wide text-fg-3">
                    {stat.label}
                  </span>
                  <span className="font-mono text-xl text-fg-1 leading-none tabular-nums">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
