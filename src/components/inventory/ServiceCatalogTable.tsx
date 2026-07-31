import { useEffect, useState } from 'react'
import { Pencil, Plus, Sparkles, Star, Trash2, Wrench } from 'lucide-react'
import { useServiceCatalogStore, ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { serviceItemTypeLabel, serviceIntervalLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { DropdownMenu } from '../ui/DropdownMenu'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'
import { SuggestedServicesDialog } from './SuggestedServicesDialog'

const NO_SCHEDULE_TAG = ''

/**
 * The shop's labor price list — the Services half of the Inventory page. These
 * feed the checkout catalog's Services pill; unlike products they hold no
 * stock, so there's nothing to adjust or reorder here.
 */
export function ServiceCatalogTable({
  creating,
  onCreatingChange,
}: {
  creating: boolean
  onCreatingChange: (creating: boolean) => void
}) {
  const { t } = useTranslation()
  const services = useServiceCatalogStore(s => s.services)
  const addService = useServiceCatalogStore(s => s.addService)
  const updateService = useServiceCatalogStore(s => s.updateService)
  const deleteService = useServiceCatalogStore(s => s.deleteService)
  const setDefaultForItemType = useServiceCatalogStore(s => s.setDefaultForItemType)
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const showToast = useToastStore(s => s.show)
  const requestConfirm = useConfirmStore(s => s.request)

  const [editing, setEditing] = useState<ServiceCatalogItem | null>(null)
  const [showSuggested, setShowSuggested] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [serviceItemTypeId, setServiceItemTypeId] = useState(NO_SCHEDULE_TAG)
  const [intervalKm, setIntervalKm] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('')
  const [setAsDefaultForTag, setSetAsDefaultForTag] = useState(false)
  const [notes, setNotes] = useState('')

  const open = creating || !!editing

  // Other catalog entries sharing the currently-selected schedule tag
  // (excluding the row being edited) — this is what makes "default for this
  // tag" a real decision (e.g. manual vs matic transmission oil) rather than
  // a no-op.
  const tagSiblings = serviceItemTypeId
    ? services.filter(s => s.serviceItemTypeId === serviceItemTypeId && s.id !== editing?.id)
    : []

  // Seed the form when the dialog opens — from the row being edited, or blank
  // for a new service.
  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setPrice(editing ? String(editing.price) : '')
    setServiceItemTypeId(editing?.serviceItemTypeId ?? NO_SCHEDULE_TAG)
    setIntervalKm(editing?.intervalKm ? String(editing.intervalKm) : '')
    setIntervalMonths(editing?.intervalMonths ? String(editing.intervalMonths) : '')
    setSetAsDefaultForTag(!!editing?.isDefaultForItemType)
    setNotes(editing?.notes ?? '')
  }, [open, editing?.id])

  const closeDialog = () => {
    setEditing(null)
    onCreatingChange(false)
  }

  const handleSave = () => {
    if (!name.trim()) return showToast({ tone: 'danger', title: t('inventory.nameRequired') })

    const data = {
      name: name.trim(),
      price: Math.round(parseFloat(price) || 0),
      serviceItemTypeId: serviceItemTypeId || null,
      // Parse-or-null, not parse-or-zero (unlike price above): 0 isn't a
      // meaningful interval, and blank should mean "no default set" — stays
      // "-" in the table rather than reading as "due immediately".
      intervalKm: intervalKm ? Math.round(parseFloat(intervalKm)) : null,
      intervalMonths: intervalMonths ? Math.round(parseFloat(intervalMonths)) : null,
      notes,
    }
    const id = editing ? editing.id : addService(data).id
    if (editing) updateService(editing.id, data)
    // Only one default per tag: set it when explicitly checked, or when this
    // service is (now) the sole one carrying its tag — nothing to disambiguate.
    if (data.serviceItemTypeId && (setAsDefaultForTag || tagSiblings.length === 0)) {
      setDefaultForItemType(id)
    }
    closeDialog()
  }

  const handleDelete = (service: ServiceCatalogItem) => {
    requestConfirm(
      {
        title: t('inventory.serviceDeleteConfirmTitle'),
        message: t('inventory.serviceDeleteConfirmMessage', { service: service.name }),
      },
      () => deleteService(service.id)
    )
  }

  const tagLabel = (id: string | null) => {
    if (!id) return '-'
    const itemType = serviceItemTypes.find(it => it.id === id)
    return itemType ? serviceItemTypeLabel(itemType.name) : '-'
  }

  // A tag is only worth flagging a default for once more than one service
  // carries it — otherwise there's nothing to disambiguate.
  const sharesTagWithAnother = (service: ServiceCatalogItem) =>
    !!service.serviceItemTypeId && services.some(s => s.id !== service.id && s.serviceItemTypeId === service.serviceItemTypeId)

  return (
    <>
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t('inventory.servicesEmptyTitle')}
          message={t('inventory.servicesEmptyMessage')}
          action={
            <div className="flex items-center justify-center gap-2">
              <Button variant="primary" icon={Sparkles} onClick={() => setShowSuggested(true)}>
                {t('inventory.addSuggestedServices')}
              </Button>
              <Button variant="secondary" icon={Plus} onClick={() => onCreatingChange(true)}>
                {t('inventory.addService')}
              </Button>
            </div>
          }
        />
      ) : (
        <>
        <div className="flex justify-end mb-2">
          <Button variant="ghost" size="sm" icon={Sparkles} onClick={() => setShowSuggested(true)}>
            {t('inventory.addSuggestedServices')}
          </Button>
        </div>
        <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colName')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colInterval')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colScheduleTag')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.notesLabel')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr
                  key={service.id}
                  {...rowEditOnDoubleClick(() => setEditing(service))}
                  className="border-t border-border-subtle hover:bg-surface-sunken"
                >
                  <td className="p-3 font-medium text-text-primary">{service.name}</td>
                  <td className="p-3 text-right text-text-secondary tabular-nums">
                    {serviceIntervalLabel(service.intervalKm, service.intervalMonths) ?? '-'}
                  </td>
                  <td className="p-3 text-text-secondary">
                    <span className="flex items-center gap-2">
                      {tagLabel(service.serviceItemTypeId)}
                      {sharesTagWithAnother(service) && service.isDefaultForItemType && (
                        <Badge tone="accent">{t('inventory.defaultForTagBadge')}</Badge>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-text-secondary">{service.notes || '-'}</td>
                  <td className="p-3 text-right">
                    <DropdownMenu
                      items={[
                        ...(sharesTagWithAnother(service) && !service.isDefaultForItemType
                          ? [{ label: t('inventory.setAsDefaultForTagAction'), icon: Star, onClick: () => setDefaultForItemType(service.id) }]
                          : []),
                        { label: t('common.edit'), icon: Pencil, onClick: () => setEditing(service) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => handleDelete(service), variant: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <SuggestedServicesDialog open={showSuggested} onClose={() => setShowSuggested(false)} />

      <Dialog
        open={open}
        onClose={closeDialog}
        title={editing ? t('inventory.editServiceTitle') : t('inventory.addServiceTitle')}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label={t('inventory.serviceNameLabel')}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('inventory.serviceNamePlaceholder')}
            />
          </div>
          <Input
            label={t('inventory.servicePriceLabel')}
            type="number"
            min="0"
            mono
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0"
          />
          <div>
            <Select
              label={t('inventory.serviceScheduleTagLabel')}
              value={serviceItemTypeId}
              onChange={e => setServiceItemTypeId(e.target.value)}
            >
              <option value={NO_SCHEDULE_TAG}>{t('inventory.serviceScheduleTagNone')}</option>
              {serviceItemTypes.map(it => (
                <option key={it.id} value={it.id}>{serviceItemTypeLabel(it.name)}</option>
              ))}
            </Select>
            <p className="mt-1 text-2xs text-fg-3">{t('inventory.serviceScheduleTagHint')}</p>
            {serviceItemTypeId && (
              tagSiblings.length > 0 ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsDefaultForTag}
                    onChange={e => setSetAsDefaultForTag(e.target.checked)}
                    className="accent-accent"
                  />
                  {t('inventory.setAsDefaultForTagLabel')}
                </label>
              ) : (
                <p className="mt-2 text-xs text-fg-3">
                  {t('inventory.firstForTagDefaultHint', { tag: tagLabel(serviceItemTypeId) })}
                </p>
              )
            )}
          </div>
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('inventory.serviceIntervalKmLabel')}
                type="number"
                min="0"
                mono
                value={intervalKm}
                onChange={e => setIntervalKm(e.target.value)}
                placeholder="0"
              />
              <Input
                label={t('inventory.serviceIntervalMonthsLabel')}
                type="number"
                min="0"
                mono
                value={intervalMonths}
                onChange={e => setIntervalMonths(e.target.value)}
                placeholder="0"
              />
            </div>
            <p className="mt-1 text-2xs text-fg-3">{t('inventory.serviceIntervalHint')}</p>
          </div>
          <div className="col-span-2">
            <Textarea label={t('inventory.notesLabel')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={closeDialog}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {editing ? t('inventory.saveChanges') : t('inventory.addService')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
