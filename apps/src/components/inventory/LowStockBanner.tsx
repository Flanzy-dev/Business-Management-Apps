import { useTranslation } from '../../lib/i18n'

/** The low-stock alert strip above the product table — toggles the same
 *  stockStatus filter the Filter dialog exposes, so the banner and the
 *  dialog can never claim different things. */
export function LowStockBanner({ count, showingOnlyLow, onToggle }: { count: number; showingOnlyLow: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  if (count === 0) return null
  return (
    <div className="bg-danger-muted border-l-4 border-danger p-4 mb-4 rounded-radius-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-danger">{t('inventory.lowStockAlertLabel')}</span>
          <span className="ml-2 text-text-secondary">{t('inventory.lowStockItemsNeed', { count })}</span>
        </div>
        <button type="button" onClick={onToggle} aria-pressed={showingOnlyLow} className="shrink-0 px-2 py-1 text-danger hover:opacity-80 text-sm rounded-radius-xs focus-ring coarse:min-h-[44px]">
          {showingOnlyLow ? t('inventory.showAll') : t('inventory.showLowStockOnly')}
        </button>
      </div>
    </div>
  )
}
