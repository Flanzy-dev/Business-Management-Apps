// Pure state machine for the auto-updater (electron-updater, wired in
// electron/main.ts). Kept free of any Electron/zustand import — same
// rationale as electron/main.ts's buildRecoveryPrompt: a decision this
// consequential (when does the "restart to install" banner show, and when
// does a failure stay silent) needs to be a unit-tested property, not a
// hope buried in JSX or scattered across event handlers.
//
// Lives in src/lib/ rather than electron/ for two reasons: vitest.config.ts
// only covers src/**/*.test.ts and server/**/*.test.ts (not electron/**),
// and tsconfig.electron.json's rootDir is "electron", so main.ts cannot
// import from src/ directly. This file is instead added to
// tsconfig.server.json's `include` (alongside src/lib/storageKeys.ts,
// which solves the identical problem) so it compiles to
// dist-server/src/lib/update/updateState.js and main.ts requires the
// compiled output — see electron/main.ts's own header comment on this.
// The renderer imports this file directly, so there is exactly one type
// definition, not two.

export type UpdateTrigger = 'auto' | 'manual'

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking'; trigger: UpdateTrigger }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; trigger: UpdateTrigger; version: string }
  | { status: 'downloading'; trigger: UpdateTrigger; version: string; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string }

export type UpdateEvent =
  | { type: 'check-started'; trigger: UpdateTrigger }
  | { type: 'update-available'; version: string }
  | { type: 'update-not-available'; currentVersion: string }
  | { type: 'download-progress'; percent: number }
  | { type: 'update-downloaded'; version: string }
  | { type: 'error'; message: string }

export const INITIAL_UPDATE_STATE: UpdateState = { status: 'idle' }

/** The trigger that started the in-flight check, or 'auto' as the safe
 *  default for an event this reducer never expects to see without one
 *  (e.g. update-downloaded delivered after electron-updater resumed a
 *  download across an app restart, with no check-started in this session
 *  at all). Defaulting to 'auto' means an event of unknown provenance is
 *  treated as the quieter case, never the louder one. */
function triggerOf(state: UpdateState): UpdateTrigger {
  return 'trigger' in state ? state.trigger : 'auto'
}

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)))
}

/**
 * The transition table. Three rules carry the actual product requirements
 * (see the file header and each case below for why):
 *
 * 1. `ready` is absorbing — once a download is complete, every subsequent
 *    event (including the next scheduled check, or an offline error from
 *    it) leaves the state exactly as `ready`. Without this, the 6-hourly
 *    background check that keeps running after a successful download would
 *    silently erase the "restart to install" banner the user was told to
 *    act on.
 * 2. A failure or a "nothing new" result triggered by the automatic
 *    background check is invisible — it collapses to `idle`. The same
 *    events triggered by the user pressing "Check for updates" are shown.
 *    This is what makes "an offline shop never sees an error" a tested
 *    property of the reducer, not a hope about how the UI happens to be
 *    wired.
 * 3. Download percent is clamped to [0, 100] and never allowed to decrease
 *    while a download is in progress — differential (blockmap) downloads
 *    report jittery, non-monotonic percentages from electron-updater, and a
 *    progress bar that visibly goes backwards reads as broken software.
 */
export function reduceUpdate(state: UpdateState, event: UpdateEvent): UpdateState {
  if (state.status === 'ready') return state

  switch (event.type) {
    case 'check-started':
      return { status: 'checking', trigger: event.trigger }

    case 'update-available':
      return { status: 'available', trigger: triggerOf(state), version: event.version }

    case 'update-not-available':
      return triggerOf(state) === 'manual'
        ? { status: 'up-to-date', currentVersion: event.currentVersion }
        : { status: 'idle' }

    case 'download-progress': {
      if (state.status !== 'available' && state.status !== 'downloading') return state
      const percent =
        state.status === 'downloading'
          ? Math.max(state.percent, clampPercent(event.percent))
          : clampPercent(event.percent)
      return { status: 'downloading', trigger: state.trigger, version: state.version, percent }
    }

    case 'update-downloaded':
      // Wins from any state, including 'idle' — electron-updater can
      // deliver this after a download that resumed across an app restart,
      // with no matching check-started in the current session.
      return { status: 'ready', version: event.version }

    case 'error': {
      const trigger = triggerOf(state)
      return trigger === 'manual' ? { status: 'error', message: event.message } : { status: 'idle' }
    }

    default:
      return state
  }
}

/** True only once a downloaded update is waiting for a restart to install —
 *  the one state that should keep the "restart to install" banner on screen
 *  and the Settings card's "Restart & install" button enabled. */
export function isRestartRequired(state: UpdateState): state is { status: 'ready'; version: string } {
  return state.status === 'ready'
}

/** The download's current percent, or null when no download is in flight
 *  (or one hasn't started downloading a body yet). Kept as a selector so
 *  no UI component branches on the union's shape directly. */
export function downloadPercent(state: UpdateState): number | null {
  return state.status === 'downloading' ? state.percent : null
}
