import { Search, Bell, Plus } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { Button } from '../ui/Button'
import { useTranslation } from '../../lib/i18n'

/** The page title bar: current page's title, search shortcut, and the
 *  ever-present "New Order" action (DESIGN.md §3). */
export function Topbar({ pageTitle, onSearch, onNewOrder }: { pageTitle: string; onSearch: () => void; onNewOrder: () => void }) {
  const { t } = useTranslation()
  return (
    <header className="h-14 bg-surface-page border-b border-border-1 flex items-center px-4 lg:px-6 gap-3 lg:gap-4">
      <h2 className="font-display text-lg lg:text-xl font-[540] tracking-tight text-fg-1 truncate">{pageTitle}</h2>

      <div className="ml-auto flex items-center gap-2 lg:gap-2.5">
        {/* Full search field at lg+; below that it collapses to its icon so
            the topbar still fits on one line. */}
        <button
          onClick={onSearch}
          className="hidden lg:flex w-[260px] h-[34px] items-center gap-2.5 px-3 bg-bg-0 border border-border-2 rounded-radius-sm text-fg-3 hover:border-border-3 transition-colors"
        >
          <Search size={16} className="flex-shrink-0" />
          <span className="text-sm truncate">{t('layout.searchPlaceholder')}</span>
        </button>
        <div className="lg:hidden">
          <IconButton label={t('layout.searchPlaceholder')} onClick={onSearch}>
            <Search size={18} />
          </IconButton>
        </div>

        <IconButton label={t('layout.notificationsLabel')}>
          <Bell size={18} />
        </IconButton>
        <Button variant="primary" size="sm" icon={Plus} aria-label={t('layout.newOrderButton')} onClick={onNewOrder}>
          <span className="hidden lg:inline">{t('layout.newOrderButton')}</span>
        </Button>
      </div>
    </header>
  )
}
