import { Search, Plus, Maximize, Minimize } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { Button } from '../ui/Button'
import { useTranslation } from '../../lib/i18n'
import { useFullScreen } from '../../hooks/useFullScreen'
import { isTouchPrimary } from '../../lib/app/environment'

/** The page title bar: current page's title, search shortcut, and the
 *  ever-present "New Order" action (DESIGN_SYSTEM.md §3). */
export function Topbar({ pageTitle, onSearch, onNewOrder }: { pageTitle: string; onSearch: () => void; onNewOrder: () => void }) {
  const { t } = useTranslation()
  const { supported: fullScreenSupported, isFullScreen, toggle: toggleFullScreen } = useFullScreen()
  return (
    <header className="h-14 bg-surface-page border-b border-border-1 flex items-center px-4 lg:px-6 gap-3 lg:gap-4">
      {/* Not a heading: each page's PageHeader owns the one (visually hidden) <h1>. */}
      <p className="font-display text-lg lg:text-xl font-[540] tracking-tight text-fg-1 truncate" title={pageTitle}>{pageTitle}</p>

      <div className="ml-auto flex items-center gap-2 lg:gap-2.5">
        {/* Full search field at lg+; below that it collapses to its icon so
            the topbar still fits on one line. */}
        <button
          onClick={onSearch}
          className="hidden lg:flex w-[260px] h-[34px] coarse:h-[44px] items-center gap-2.5 px-3 bg-bg-0 border border-border-2 rounded-radius-sm text-fg-3 hover:border-border-3 transition-colors focus-ring"
        >
          <Search size={16} className="flex-shrink-0" />
          <span className="text-sm truncate">{t('layout.searchPlaceholder')}</span>
          {/* The shortcut, where there's a keyboard to press it on. */}
          {!isTouchPrimary() && (
            <kbd className="ml-auto shrink-0 rounded border border-border-2 bg-bg-2 px-1.5 py-0.5 text-2xs font-mono text-fg-3">Ctrl K</kbd>
          )}
        </button>
        <div className="lg:hidden">
          <IconButton label={t('layout.searchPlaceholder')} onClick={onSearch}>
            <Search size={18} />
          </IconButton>
        </div>

        {fullScreenSupported && (
          <IconButton
            label={isFullScreen ? t('layout.exitFullscreen') : t('layout.enterFullscreen')}
            active={isFullScreen}
            onClick={toggleFullScreen}
          >
            {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconButton>
        )}

        <Button variant="primary" size="sm" icon={Plus} aria-label={t('layout.newOrderButton')} onClick={onNewOrder}>
          <span className="hidden lg:inline">{t('layout.newOrderButton')}</span>
        </Button>
      </div>
    </header>
  )
}
