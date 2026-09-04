import { useEffect, useState } from 'react'
import { useServiceCatalogStore, type ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useToastStore } from '../../store/toastStore'
import { serviceItemTypeLabel, type IntervalAxis } from '../../lib/entities'
import {
  initialCatalogDraft,
  catalogDraftToData,
  axisOnTagChange,
  NO_SCHEDULE_TAG,
  type ServiceCatalogDraft,
} from '../../lib/serviceCatalog'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogActions } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'

const INTERVAL_AXIS_I18N_KEYS: Record<IntervalAxis, string> = {
  none: 'common.intervalAxisNone',
  km: 'common.intervalAxisKm',
  months: 'common.intervalAxisMonths',
  both: 'common.intervalAxisBoth',
}

/**
 * Add/Edit Service dialog — the shop's labor price list entry form. Draft
 * state and its conversions live in src/lib/serviceCatalog.ts, same shape as
 * ProductFormDialog + productForm.ts in the same directory.
 */
export function ServiceFormDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  /** The service being edited, or null for a brand-new one. */
  editing: ServiceCatalogItem | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const addService = useServiceCatalogStore((s) => s.addService)
  const updateService = useServiceCatalogStore((s) => s.updateService)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const showToast = useToastStore((s) => s.show)

  const [draft, setDraft] = useState<ServiceCatalogDraft>(() => initialCatalogDraft(editing))

  // Seed the form when the dialog opens — from the row being edited, or blank
  // for a new service.
  useEffect(() => {
    if (!open) return
    setDraft(initialCatalogDraft(editing))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editing?.id identifies which row to reseed from
  }, [open, editing?.id])

  const set = <K extends keyof ServiceCatalogDraft>(key: K, value: ServiceCatalogDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const handleSave = () => {
    if (!draft.name.trim()) return showToast({ tone: 'danger', title: t('inventory.nameRequired') })

    const data = catalogDraftToData(draft)
    if (editing) updateService(editing.id, data)
    else addService(data)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? t('inventory.editServiceTitle') : t('inventory.addServiceTitle')} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input
            label={t('inventory.serviceNameLabel')}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('inventory.serviceNamePlaceholder')}
          />
        </div>
        <Input
          label={t('inventory.servicePriceLabel')}
          type="number"
          min="0"
          mono
          value={draft.price}
          onChange={(e) => set('price', e.target.value)}
          placeholder="0"
        />
        <div>
          <Select
            label={t('inventory.serviceScheduleTagLabel')}
            value={draft.serviceItemTypeId}
            onChange={(e) => {
              const serviceItemTypeId = e.target.value
              setDraft((d) => ({ ...d, serviceItemTypeId, intervalAxis: axisOnTagChange(serviceItemTypeId, d.intervalAxis) }))
            }}
          >
            <option value={NO_SCHEDULE_TAG}>{t('inventory.serviceScheduleTagNone')}</option>
            {serviceItemTypes.map((it) => (
              <option key={it.id} value={it.id}>
                {serviceItemTypeLabel(it.name)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-2xs text-fg-3">{t('inventory.serviceScheduleTagHint')}</p>
        </div>
        <div className="col-span-2">
          <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {t('inventory.serviceIntervalAxisLabel')}
          </label>
          <div className="flex flex-wrap gap-4 mb-3">
            {(['none', 'km', 'months', 'both'] as const).map((axis) => (
              <label key={axis} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="radio" checked={draft.intervalAxis === axis} onChange={() => set('intervalAxis', axis)} className="accent-accent" />
                {t(INTERVAL_AXIS_I18N_KEYS[axis])}
              </label>
            ))}
          </div>
          {draft.intervalAxis !== 'none' && (
            <div className="grid grid-cols-2 gap-4">
              {(draft.intervalAxis === 'km' || draft.intervalAxis === 'both') && (
                <Input
                  label={t('inventory.serviceIntervalKmLabel')}
                  type="number"
                  min="0"
                  mono
                  value={draft.intervalKm}
                  onChange={(e) => set('intervalKm', e.target.value)}
                  placeholder="0"
                />
              )}
              {(draft.intervalAxis === 'months' || draft.intervalAxis === 'both') && (
                <Input
                  label={t('inventory.serviceIntervalMonthsLabel')}
                  type="number"
                  min="0"
                  mono
                  value={draft.intervalMonths}
                  onChange={(e) => set('intervalMonths', e.target.value)}
                  placeholder="0"
                />
              )}
            </div>
          )}
          <p className="mt-1 text-2xs text-fg-3">
            {draft.intervalAxis === 'both' ? t('inventory.serviceIntervalBothHint') : t('inventory.serviceIntervalHint')}
          </p>
        </div>
        <div className="col-span-2">
          <Textarea label={t('inventory.notesLabel')} value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
        </div>
      </div>
      <DialogActions onCancel={onClose} onConfirm={handleSave} confirmLabel={editing ? t('inventory.saveChanges') : t('inventory.addService')} />
    </Dialog>
  )
}
