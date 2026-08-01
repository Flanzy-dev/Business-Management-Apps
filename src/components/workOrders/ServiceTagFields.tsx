import type { ContainerType } from '../../store/serviceEventStore'
import type { ServiceItemType } from '../../store/serviceItemTypeStore'
import { serviceItemTypeLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'

export interface ServiceTagState {
  enabled: boolean
  itemTypeId: string
  quantityLiters: string
  action: 'changed' | 'topped_up'
  containerType: ContainerType | ''
}

export const emptyServiceTag: ServiceTagState = {
  enabled: false,
  itemTypeId: '',
  quantityLiters: '',
  action: 'changed',
  containerType: '',
}

/** Optional service-schedule tagging, applied to whichever add-mode adds the next line. */
export function ServiceTagFields({
  tag,
  onChange,
  serviceItemTypes,
}: {
  tag: ServiceTagState
  onChange: (tag: ServiceTagState) => void
  serviceItemTypes: ServiceItemType[]
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-3">
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={tag.enabled}
          onChange={e => onChange({ ...tag, enabled: e.target.checked })}
          className="accent-accent"
        />
        {t('workOrders.tagAsServiceItem')}
      </label>
      {tag.enabled && (
        <div className="flex flex-wrap gap-2 mt-2">
          <select
            value={tag.itemTypeId}
            onChange={e => onChange({ ...tag, itemTypeId: e.target.value })}
            className="h-[34px] px-[10px] bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
          >
            <option value="">{t('workOrders.itemTypePlaceholder')}</option>
            {serviceItemTypes.map(it => (
              <option key={it.id} value={it.id}>{serviceItemTypeLabel(it.name)}</option>
            ))}
          </select>
          <input
            type="number"
            value={tag.quantityLiters}
            onChange={e => onChange({ ...tag, quantityLiters: e.target.value })}
            placeholder={t('workOrders.litersPlaceholder')}
            className="w-24 h-[34px] px-[10px] bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm placeholder-fg-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
          />
          <select
            value={tag.action}
            onChange={e => onChange({ ...tag, action: e.target.value as 'changed' | 'topped_up' })}
            className="h-[34px] px-[10px] bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
          >
            <option value="changed">{t('workOrders.actionChanged')}</option>
            <option value="topped_up">{t('workOrders.actionToppedUp')}</option>
          </select>
          <select
            value={tag.containerType}
            onChange={e => onChange({ ...tag, containerType: e.target.value as ContainerType | '' })}
            className="h-[34px] px-[10px] bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
          >
            <option value="">{t('workOrders.containerPlaceholder')}</option>
            <option value="bottle">{t('workOrders.containerBottle')}</option>
            <option value="drum">{t('workOrders.containerDrum')}</option>
            <option value="gallon">{t('workOrders.containerGallon')}</option>
          </select>
        </div>
      )}
    </div>
  )
}
