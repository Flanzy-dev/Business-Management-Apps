import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

/**
 * A table header cell that sorts its column when clicked.
 *
 * Inactive columns still show a (muted) chevron pair — without it there's
 * nothing to say the header is clickable, and a sort nobody discovers is the
 * same as no sort. The arrow points the way the rows actually run: down for
 * descending, so "Price ▼" reads as biggest-first.
 *
 * `align` mirrors the cell it heads — money and quantity columns are
 * right-aligned in the body, so their headers have to be too, which means the
 * chevron sits on the left of the label there.
 */
export function SortableTh<K extends string>({
  sortKey,
  label,
  active,
  direction,
  onSort,
  align = 'left',
  ariaLabel,
}: {
  sortKey: K
  label: string
  /** True when this column is the one currently sorting. */
  active: boolean
  direction: 'asc' | 'desc'
  onSort: (key: K) => void
  align?: 'left' | 'right'
  /** Announced instead of the bare label — e.g. "Sort by Price, descending". */
  ariaLabel?: string
}) {
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown

  return (
    <th
      className={`p-0 font-medium text-text-secondary ${align === 'right' ? 'text-right' : 'text-left'}`}
      // Screen readers announce the current sort from the cell, not the button.
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={ariaLabel}
        className={`
          w-full h-full px-3 py-3 inline-flex items-center gap-1.5 focus-ring
          hover:text-text-primary transition-colors duration-fast cursor-pointer
          ${align === 'right' ? 'flex-row-reverse' : ''}
          ${active ? 'text-text-primary' : ''}
        `}
      >
        {label}
        <Icon size={13} className={active ? 'text-accent' : 'text-fg-3'} aria-hidden="true" />
      </button>
    </th>
  )
}
