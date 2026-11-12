import { useTranslation } from '../../lib/i18n'
import { Button } from './Button'

/**
 * The line under a capped list (see useIncrementalList): "Showing 100 of 960"
 * with a Show more button. Renders nothing once everything is visible, so a
 * short list looks exactly as it did before the cap existed.
 */
export function ShowMoreFooter({ shown, total, onShowMore }: { shown: number; total: number; onShowMore: () => void }) {
  const { t } = useTranslation()
  if (shown >= total) return null
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <span className="text-xs text-fg-3 tabular-nums" aria-live="polite">
        {t('common.showingOfTotal', { shown, total })}
      </span>
      <Button variant="secondary" size="sm" onClick={onShowMore}>
        {t('common.showMore')}
      </Button>
    </div>
  )
}
