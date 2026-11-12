import { useState } from 'react'

/** How many rows a long list renders before asking for "Show more". */
export const LIST_BATCH_SIZE = 100

/**
 * Renders a long list a batch at a time instead of all at once.
 *
 * After the history import the shop has roughly a thousand vehicles and two
 * thousand orders; mounting every row (each with its own action menu) on every
 * keystroke of the search box is what made typing lag. Search still runs over
 * the *whole* list — only the rendered slice is capped — so a match past the
 * first batch is found, not hidden.
 *
 * `resetKey` is whatever defines "a different list" (the search text, the
 * active tab): when it changes the cap drops back to one batch, so a fresh
 * search never inherits "Show more" clicks from the previous one. Derived
 * during render rather than in an effect, so there is no frame that renders
 * the old, longer slice for the new list.
 */
export function useIncrementalList<T>(items: readonly T[], resetKey: string, batch: number = LIST_BATCH_SIZE) {
  const [state, setState] = useState({ key: resetKey, limit: batch })
  const limit = state.key === resetKey ? state.limit : batch

  const showMore = () => setState({ key: resetKey, limit: limit + batch })

  return {
    visible: items.length > limit ? items.slice(0, limit) : items,
    shown: Math.min(limit, items.length),
    total: items.length,
    showMore,
  }
}
