import type { ContainerType } from '../../store/serviceEventStore'
import type { ServiceItemType } from '../../store/serviceItemTypeStore'
import { serviceItemTypeLabel } from '../../lib/format/entities'
import { formatNumber } from '../../lib/format/numbers'
import { useTranslation } from '../../lib/i18n'
import { Checkbox } from '../ui/Checkbox'
import { Input, Select } from '../ui/Input'

export interface ServiceTagState {
  enabled: boolean
  itemTypeId: string
  quantityLiters: string
  action: 'changed' | 'topped_up'
  containerType: ContainerType | ''
  /** Blank unless the customer asked for their own interval — see the field below. */
  requestedIntervalKm: string
}

export const emptyServiceTag: ServiceTagState = {
  enabled: false,
  itemTypeId: '',
  quantityLiters: '',
  action: 'changed',
  containerType: '',
  requestedIntervalKm: '',
}

/**
 * Optional service-schedule tagging for one line. Every box carries a visible
 * label (a placeholder disappears the moment the box is filled, leaving a
 * bare "Changed" with no hint what it answers), in two even columns inside one
 * panel so the group reads as a single "this line is a service" section.
 */
export function ServiceTagFields({
  tag,
  onChange,
  serviceItemTypes,
  currentIntervalKm,
}: {
  tag: ServiceTagState
  onChange: (tag: ServiceTagState) => void
  serviceItemTypes: ServiceItemType[]
  /** This vehicle's live interval for the tagged item, shown in the hint so
   *  staff type only when the customer's number differs from it. */
  currentIntervalKm?: number | null
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-3">
      <Checkbox checked={tag.enabled} onChange={(checked) => onChange({ ...tag, enabled: checked })}>
        {t('workOrders.tagAsServiceItem')}
      </Checkbox>
      <p className="mt-1 ml-6 text-xs text-fg-3">{t('workOrders.tagIntro')}</p>
      {tag.enabled && (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-radius-sm bg-surface-sunken p-3">
          <Select
            label={t('workOrders.tagItemLabel')}
            value={tag.itemTypeId}
            onChange={e => onChange({ ...tag, itemTypeId: e.target.value })}
          >
            <option value="">{t('workOrders.tagItemPlaceholder')}</option>
            {serviceItemTypes.map(it => (
              <option key={it.id} value={it.id}>{serviceItemTypeLabel(it.name)}</option>
            ))}
          </Select>
          <Input
            type="number"
            min="0"
            step="any"
            mono
            label={t('workOrders.tagAmountLabel')}
            value={tag.quantityLiters}
            onChange={e => onChange({ ...tag, quantityLiters: e.target.value })}
            placeholder={t('workOrders.tagAmountPlaceholder')}
          />
          <Select
            label={t('workOrders.tagActionLabel')}
            hint={t('workOrders.tagActionHint')}
            value={tag.action}
            onChange={e => onChange({ ...tag, action: e.target.value as 'changed' | 'topped_up' })}
          >
            <option value="changed">{t('workOrders.actionChanged')}</option>
            <option value="topped_up">{t('workOrders.actionToppedUp')}</option>
          </Select>
          <Select
            label={t('workOrders.tagContainerLabel')}
            value={tag.containerType}
            onChange={e => onChange({ ...tag, containerType: e.target.value as ContainerType | '' })}
          >
            <option value="">{t('workOrders.containerPlaceholder')}</option>
            <option value="bottle">{t('workOrders.containerBottle')}</option>
            <option value="drum">{t('workOrders.containerDrum')}</option>
            <option value="gallon">{t('workOrders.containerGallon')}</option>
          </Select>
          {/* Only a 'changed' line may move the vehicle's schedule — a top-up
           *  never does, so asking for a new interval here would promise
           *  something the completion side never applies (see orderOps.ts). */}
          {tag.action === 'changed' && (
            <div className="col-span-2">
              <Input
                type="number"
                min="0"
                mono
                label={t('workOrders.tagIntervalLabel')}
                hint={
                  currentIntervalKm != null
                    ? t('workOrders.tagIntervalHintWithCurrent', { km: formatNumber(currentIntervalKm) })
                    : t('workOrders.tagIntervalHint')
                }
                value={tag.requestedIntervalKm}
                onChange={e => onChange({ ...tag, requestedIntervalKm: e.target.value })}
                placeholder={currentIntervalKm != null ? String(currentIntervalKm) : undefined}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
