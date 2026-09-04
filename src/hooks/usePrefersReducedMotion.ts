import { useEffect, useState } from 'react'

/**
 * Recharts' default entrance animation (isAnimationActive, on by default on
 * every series/bar/pie element) ignores prefers-reduced-motion entirely —
 * unlike the CSS transitions elsewhere in the app, which respect it via the
 * .animate-hero-reveal media query in index.css. Charts need the same
 * per-element opt-out since Recharts animates via its own SVG/JS engine,
 * not CSS, so a global stylesheet rule can't reach it.
 *
 * For the same reason every gated series also pins `animationDuration={300}`:
 * Recharts defaults to 1500ms, five times the app's UI budget, and these
 * charts sit on the Dashboard and Reports — pages a shop reopens all day, each
 * visit replaying the full draw.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduced
}
