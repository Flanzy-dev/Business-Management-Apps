import { useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import { useServiceCatalogStore, ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useConfirmStore } from '../../store/confirmStore'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { serviceItemTypeLabel, serviceIntervalLabel, serviceCatalogLabel } from '../../lib/entities'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { RowActions } from '../ui/RowActions'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ServiceFormDialog } from './ServiceFormDialog'

/**
 * The shop's labor price list — the Services half of the Inventory page. These
 * feed the checkout catalog's Services pill; unlike products they hold no
 * stock, so there's nothing to adjust or reorder here. Add/Edit lives in
 * ServiceFormDialog.
 */
export function ServiceCatalogTable({
  creating,
  onCreatingChange,
  readOnly = false,
}: {
  creating: boolean
  onCreatingChange: (creating: boolean) => void
  /** Worker mode: view the labor price list, no add/edit/delete — same
   *  "Inventory is read-only" boundary as the Products tab. */
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const services = useServiceCatalogStore(s => s.services)
  const deleteService = useServiceCatalogStore(s => s.deleteService)
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const requestConfirm = useConfirmStore(s => s.request)

  const [editing, setEditing] = useState<ServiceCatalogItem | null>(null)

  const formOpen = creating || !!editing
  const closeForm = () => {
    setEditing(null)
    onCreatingChange(false)
  }

  const handleDelete = (service: ServiceCatalogItem) => {
    requestConfirm(
      {
        title: t('inventory.serviceDeleteConfirmTitle'),
        message: t('inventory.serviceDeleteConfirmMessage', { service: serviceCatalogLabel(service.name) }),
      },
      () => deleteService(service.id)
    )
  }

  const tagLabel = (id: string | null) => {
    if (!id) return '-'
    const itemType = serviceItemTypes.find(it => it.id === id)
    return itemType ? serviceItemTypeLabel(itemType.name) : '-'
  }

  return (
    <>
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t('inventory.servicesEmptyTitle')}
          message={t('inventory.servicesEmptyMessage')}
          action={
            readOnly ? undefined : (
              <Button variant="primary" icon={Plus} onClick={() => onCreatingChange(true)}>
                {t('inventory.addService')}
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colName')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colPrice')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colInterval')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.colScheduleTag')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('inventory.notesLabel')}</th>
                {!readOnly && <th className="text-right p-3 font-medium text-text-secondary">{t('inventory.colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr
                  key={service.id}
                  {...rowEditOnDoubleClick(readOnly ? () => {} : () => setEditing(service))}
                  className="border-t border-border-subtle hover:bg-surface-sunken"
                >
                  <td className="p-3 font-medium text-text-primary">{serviceCatalogLabel(service.name)}</td>
                  <td className="p-3 text-right font-mono text-sm text-text-secondary tabular-nums">
                    {service.price > 0 ? (
                      formatCurrency(service.price)
                    ) : (
                      <Badge tone="warning">{t('inventory.missingPriceBadge')}</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right text-text-secondary tabular-nums">
                    {serviceIntervalLabel(service.intervalKm, service.intervalMonths) ?? '-'}
                  </td>
                  <td className="p-3 text-text-secondary">{tagLabel(service.serviceItemTypeId)}</td>
                  <td className="p-3 text-sm text-text-secondary">{service.notes || '-'}</td>
                  {!readOnly && (
                    <td className="p-3 text-right">
                      <RowActions onEdit={() => setEditing(service)} onDelete={() => handleDelete(service)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ServiceFormDialog open={formOpen} editing={editing} onClose={closeForm} />
    </>
  )
}
