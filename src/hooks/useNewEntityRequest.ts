import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseNewEntityRequest } from '../lib/returnTrip'

/**
 * The "auto-open the add form on ?new=1, then clear the param" effect wrapped
 * around parseNewEntityRequest (src/lib/returnTrip.ts) — was hand-duplicated
 * identically at Customers.tsx and Suppliers.tsx (each: read one request, if
 * open call back with shouldReturn, then clear the param). Companies.tsx
 * deliberately keeps its own effect instead of two calls to this one: it
 * checks two distinct params with an else-if (one request must win), which
 * this single-request hook doesn't express — forcing it in would relocate
 * that branching, not remove it.
 */
export function useNewEntityRequest(onOpen: (shouldReturn: boolean) => void, options?: { param?: string; returnFlag?: string }): void {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const request = parseNewEntityRequest(searchParams, options)
    if (request.open) {
      onOpen(request.shouldReturn)
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onOpen/options get a new identity every render at both call sites; only searchParams should retrigger this
  }, [searchParams])
}
