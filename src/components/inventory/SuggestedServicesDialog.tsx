import { useEffect, useState } from 'react'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { SERVICE_STARTER_SET } from '../../lib/serviceStarterSet'
import { serviceItemTypeLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * One-time starter picker for the service price list: tick the jobs this shop
 * does, type what it charges, and they land in the catalog (tagged for the
 * vehicle schedule where that makes sense).
 */
export function SuggestedServicesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const services = useServiceCatalogStore(s => s.services)
  const addService = useServiceCatalogStore(s => s.addService)
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setSelected({})
    setPrices({})
  }, [open])

  const entries = SERVICE_STARTER_SET.map(entry => {
    const name = t(`inventory.${entry.nameKey}`)
    return {
      ...entry,
      name,
      // Already in the catalog — shown ticked and locked so the picker can't
      // create a second entry with the same name.
      existing: services.some(s => s.name.toLowerCase() === name.toLowerCase()),
    }
  })

  const chosenCount = entries.filter(e => !e.existing && selected[e.nameKey]).length

  const handleAdd = () => {
    for (const entry of entries) {
      if (entry.existing || !selected[entry.nameKey]) continue
      const itemType = entry.itemTypeName
        ? serviceItemTypes.find(it => it.name === entry.itemTypeName)
        : undefined
      addService({
        name: entry.name,
        price: Math.round(parseFloat(prices[entry.nameKey] ?? '') || 0),
        serviceItemTypeId: itemType?.id ?? null,
        // Carried straight from the starter entry, not user-editable here —
        // unlike price, this is a sensible shop-wide default rather than
        // something that needs confirming per item. Adjustable afterward
        // from the catalog's normal edit dialog.
        intervalKm: entry.intervalKm ?? null,
        intervalMonths: entry.intervalMonths ?? null,
        notes: '',
      })
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('inventory.suggestedServicesTitle')} size="lg">
      <p className="text-caption text-fg-3 mb-4">{t('inventory.suggestedServicesHint')}</p>

      <div className="space-y-2">
        {entries.map(entry => {
          const itemType = entry.itemTypeName
            ? serviceItemTypes.find(it => it.name === entry.itemTypeName)
            : undefined
          return (
            <div key={entry.nameKey} className="flex items-center gap-3">
              <label className="flex items-center gap-2 flex-1 min-w-0 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={entry.existing || !!selected[entry.nameKey]}
                  disabled={entry.existing}
                  onChange={e => setSelected(prev => ({ ...prev, [entry.nameKey]: e.target.checked }))}
                />
                <span className={entry.existing ? 'text-fg-3' : 'text-text-primary'}>{entry.name}</span>
                {itemType && (
                  <span className="text-2xs text-accent">{serviceItemTypeLabel(itemType.name)}</span>
                )}
                {entry.existing && (
                  <span className="text-2xs text-fg-3">{t('inventory.alreadyInCatalog')}</span>
                )}
              </label>
              <div className="w-32 shrink-0">
                <Input
                  type="number"
                  min="0"
                  mono
                  className="text-right"
                  value={entry.existing ? '' : prices[entry.nameKey] ?? ''}
                  disabled={entry.existing}
                  placeholder={t('inventory.servicePriceLabel')}
                  onChange={e => setPrices(prev => ({ ...prev, [entry.nameKey]: e.target.value }))}
                />
              </div>
            </div>
          )
        })}
      </div>

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleAdd} disabled={chosenCount === 0}>
          {t('inventory.addSelected')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
