import { useTranslation } from '../../lib/i18n'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

/** Label key + key combo for one row — src/hooks/useKeyboardShortcuts.ts's
 *  own list, restated here as this page's only discoverability surface for
 *  it. Was 6 copy-pasted `<div>` blocks differing only in these two values. */
const SHORTCUTS: { labelKey: string; keys: string }[] = [
  { labelKey: 'settings.shortcutNewWorkOrder', keys: 'Ctrl + N' },
  { labelKey: 'settings.shortcutGoToDashboard', keys: 'Ctrl + D' },
  { labelKey: 'settings.shortcutSearchQuickFind', keys: 'Ctrl + K' },
  { labelKey: 'settings.shortcutGoToCustomers', keys: 'Ctrl + 1' },
  { labelKey: 'settings.shortcutGoToVehicles', keys: 'Ctrl + 2' },
  { labelKey: 'settings.shortcutGoToWorkOrders', keys: 'Ctrl + 3' },
]

export function KeyboardShortcutsCard() {
  const { t } = useTranslation()
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.keyboardShortcutsTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.labelKey} className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t(s.labelKey)}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
