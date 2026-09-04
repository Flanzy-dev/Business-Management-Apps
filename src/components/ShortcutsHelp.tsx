import { useShortcutsHelpStore } from '../store/shortcutsHelpStore'
import { useMode } from '../store/authStore'
import { canAccessRoute } from '../lib/auth/permissions'
import { ROUTES } from '../lib/routes'
import { useTranslation } from '../lib/i18n'
import { Dialog } from './ui/Dialog'

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-fg-2">{label}</span>
      <span className="flex gap-1 shrink-0">
        {keys.map((k) => (
          <kbd key={k} className="rounded border border-border-2 bg-bg-0 px-1.5 py-0.5 text-2xs font-mono text-fg-1">{k}</kbd>
        ))}
      </span>
    </div>
  )
}

/**
 * The keyboard-shortcut cheatsheet — the app had no discoverability surface
 * at all, so Ctrl+N (its most-repeated action) was unlearnable. Built from
 * routes.ts's own shortcut table, the same source useKeyboardShortcuts.ts
 * derives its bindings from, so it can't drift; nav rows are filtered by the
 * current mode so Worker isn't shown admin-only shortcuts.
 */
export function ShortcutsHelp() {
  const { t } = useTranslation()
  const open = useShortcutsHelpStore((s) => s.open)
  const setOpen = useShortcutsHelpStore((s) => s.setOpen)
  const mode = useMode()

  const navRows = ROUTES.filter((r) => r.shortcut && r.labelKey && canAccessRoute(mode, r.path))

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('shortcuts.title')} size="sm">
      <p className="mb-3 text-xs text-fg-3">{t('shortcuts.hint')}</p>
      <div className="divide-y divide-border-1">
        <Row keys={['Ctrl', 'N']} label={t('shortcuts.newOrder')} />
        <Row keys={['Ctrl', 'K']} label={t('shortcuts.search')} />
        {navRows.map((r) => (
          <Row key={r.path} keys={['Ctrl', r.shortcut!.toUpperCase()]} label={t('shortcuts.goTo', { page: t(r.labelKey!) })} />
        ))}
        <Row keys={['Esc']} label={t('shortcuts.closeDialog')} />
        <Row keys={['?']} label={t('shortcuts.showHelp')} />
      </div>
    </Dialog>
  )
}
