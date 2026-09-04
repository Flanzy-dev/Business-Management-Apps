// Auto-drops an open Admin session back to Worker mode after inactivity —
// mounted once in Layout, so it's live everywhere inside the shell. Only
// arms while mode is 'admin': Worker mode has nothing to time out of, and
// the lock screen (mode === null) isn't mounted here at all.
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/toastStore'
import { translate } from '../i18n'

/** Not user-configurable in v1 — one constant, per the plan's session
 *  decision (worker sticks, admin expires after 15 min idle). */
const ADMIN_IDLE_TIMEOUT_MS = 15 * 60_000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const

export function useIdleLock(): void {
  const mode = useAuthStore((s) => s.mode)
  const dropToWorker = useAuthStore((s) => s.dropToWorker)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== 'admin') return

    const expire = () => {
      dropToWorker()
      useToastStore.getState().show({ tone: 'neutral', title: translate('auth.session.idleLockedToast') })
    }

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(expire, ADMIN_IDLE_TIMEOUT_MS)
    }

    reset()
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset)
    }
  }, [mode, dropToWorker])
}
