import type { AdjustType } from '../../lib/inventory/restockForm'
import { useTranslation } from '../../lib/i18n'

/** Add/Subtract — only shown to a mode that can see cost (Worker mode may
 *  only ever receive stock, never remove it, so this toggle doesn't exist
 *  for them; see AdjustStockDialog's canSeeCost comment). */
export function AdjustTypeToggle({ value, onChange }: { value: AdjustType; onChange: (type: AdjustType) => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={value === 'add'}
        onClick={() => onChange('add')}
        className={`flex-1 py-2 coarse:min-h-[44px] rounded-radius-sm border focus-ring ${value === 'add' ? 'bg-accent-muted border-accent text-accent' : 'border-border-subtle text-text-secondary'}`}
      >
        {t('inventory.addOption')}
      </button>
      <button
        type="button"
        aria-pressed={value === 'subtract'}
        onClick={() => onChange('subtract')}
        className={`flex-1 py-2 coarse:min-h-[44px] rounded-radius-sm border focus-ring ${value === 'subtract' ? 'bg-danger-muted border-danger text-danger' : 'border-border-subtle text-text-secondary'}`}
      >
        {t('inventory.subtractOption')}
      </button>
    </div>
  )
}
