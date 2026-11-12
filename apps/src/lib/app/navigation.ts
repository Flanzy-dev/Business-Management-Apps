// Small related modules kept in one file, one section each with its original notes: navState,
// pageTabs, shortcutKeys.

// ---- navState ----

// Navigate-with-state for "go to this page and open that record": global
// search, the Dashboard's order cards and bay tiles. Location state rather
// than a query param, so it never shows in the URL and a reload or Back to
// the same entry doesn't reopen the dialog once the page has cleared it.

export interface OpenRecordState {
  openId: string
}

export function openRecordState(id: string): OpenRecordState {
  return { openId: id }
}

/** The id to open from a location's state, or null. */
export function openIdFromState(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null
  const id = (state as Partial<OpenRecordState>).openId
  return typeof id === 'string' && id ? id : null
}

// ---- pageTabs ----

// URL-driven tabs for pages that hold several sections (Customers ·
// Companies, Appointments · Reminders, …). The active tab lives in `?tab=`
// rather than component state, so a link, a redirect from an old page path
// (see ROUTE_ALIASES in ./routes.ts) or the browser's back button lands on the
// right section. Zero imports, so a Node-only test can read it.

/**
 * The tab to show for `search`'s `?tab=`. `allowed` is only the tabs THIS
 * mode may see (the page filters them through src/lib/auth/permissions.ts
 * first), so a worker sent to `?tab=suppliers` gets `fallback`, not a tab it
 * has no right to.
 */
export function resolveTab<T extends string>(search: URLSearchParams, allowed: readonly T[], fallback: T): T {
  const requested = search.get('tab')
  return allowed.find((tab) => tab === requested) ?? fallback
}

/**
 * The params left after a page has acted on a one-shot request like `?new=1`.
 * Pages used to clear the whole query (`setSearchParams({})`), which inside a
 * tabbed page also dropped `?tab=` and bounced the user to the first tab.
 */
export function keepOnlyTab(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  const tab = search.get('tab')
  if (tab) next.set('tab', tab)
  return next
}

/** Params for switching to `tab`. Every other param is dropped: a tab switch
 *  also ends whatever one-shot request the previous tab was handling. */
export function withTab(tab: string): URLSearchParams {
  return new URLSearchParams({ tab })
}

// ---- shortcutKeys ----

export type ShortcutAction =
  | { type: 'newOrder' }
  | { type: 'search' }
  | { type: 'route'; path: string }
  | { type: 'help' }

export interface ShortcutKeyInput {
  key: string
  /** Ctrl, or Cmd on a Mac. */
  mod: boolean
  /** Focus is in a text field, select or textarea. */
  typing: boolean
  /** A modal dialog (`[aria-modal="true"]`) is open. */
  dialogOpen: boolean
}

/**
 * What a keydown means, given where focus is. Pure so the rules are testable.
 *
 * Ctrl+N works everywhere, open dialogs included: from an open order it is
 * the counter's "next customer" key, and order edits are already saved.
 * Everything else that leaves the page (Ctrl+K, Ctrl+<route>) is ignored
 * while a dialog is open, so a stray Ctrl+1 can't throw away a half-filled form.
 */
export function resolveShortcut(input: ShortcutKeyInput, routeKeys: ReadonlyMap<string, string>): ShortcutAction | null {
  const key = input.key.toLowerCase()
  if (input.mod) {
    if (key === 'n') return { type: 'newOrder' }
    if (input.dialogOpen) return null
    if (key === 'k') return { type: 'search' }
    const path = routeKeys.get(key)
    return path ? { type: 'route', path } : null
  }
  if (input.typing || input.dialogOpen) return null
  if (input.key === '?') return { type: 'help' }
  return null
}
