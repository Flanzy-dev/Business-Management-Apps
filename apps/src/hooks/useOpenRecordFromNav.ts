import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { openIdFromState } from '../lib/app/navigation'

/** Calls `onOpen` with the record id this page was navigated to open
 *  (src/lib/app/navigation.ts), on mount and on every later navigation to the page
 *  while it's already showing (global search from the same page). The state
 *  is then wiped, keeping the URL and query, so Back/Forward to this history
 *  entry doesn't reopen the record. A layout effect, so the record opens
 *  before the first paint instead of flashing the list. */
export function useOpenRecordFromNav(onOpen: (id: string) => void) {
  const location = useLocation()
  const navigate = useNavigate()
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  useLayoutEffect(() => {
    const id = openIdFromState(location.state)
    if (!id) return
    onOpenRef.current(id)
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])
}
