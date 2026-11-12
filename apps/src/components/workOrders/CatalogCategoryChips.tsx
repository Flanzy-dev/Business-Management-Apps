/** The catalog's category filter as a scrolling row of chips (All · Services ·
 *  each product category) — every category is one tap away, where a dropdown
 *  hid them all behind a click. A single row that scrolls sideways rather than
 *  wrapping, so the catalog below doesn't move when the shop adds a category.
 *  The scroll bar is hidden app-wide (src/index.css): swipe on a tablet, or turn
 *  the mouse wheel over the chips. */
export function CatalogCategoryChips({
  chips,
  value,
  onChange,
  label,
}: {
  chips: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  /** Names the group for screen readers. */
  label: string
}) {
  // With no bar to drag, a mouse can't reach chips past the edge — so a vertical
  // wheel turn over the row scrolls it sideways. (A touch swipe already does.)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const row = e.currentTarget
    if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    row.scrollLeft += e.deltaY
  }

  return (
    <div role="group" aria-label={label} onWheel={handleWheel} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {chips.map(chip => {
        const selected = chip.value === value
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(chip.value)}
            className={`shrink-0 whitespace-nowrap h-8 coarse:h-11 px-3 rounded-radius-full border text-sm transition-colors duration-fast ease-out focus-ring ${
              selected
                ? 'bg-accent-muted border-accent text-accent font-medium'
                : 'bg-surface-sunken border-border-2 text-fg-2 hover:text-fg-1 hover:border-border-3'
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
