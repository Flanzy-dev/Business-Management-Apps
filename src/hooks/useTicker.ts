import { useEffect, useState } from 'react'

/**
 * A `Date` that re-renders its caller every `intervalMs` — for anything on
 * screen whose display depends on the wall clock without any state change of
 * its own (a countdown, an elapsed-time badge). Was two independent
 * `useState(() => new Date()) + useEffect(setInterval(...))` copies
 * (Dashboard's technician queue, Bays' countdown cards); a third caller is
 * what turned it from "small duplicated idiom" into a real seam worth naming.
 */
export function useTicker(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
