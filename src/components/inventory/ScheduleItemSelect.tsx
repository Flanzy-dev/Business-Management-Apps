import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { resolveProductScheduleTag } from '../../lib/scheduleTagging'
import { serviceItemTypeLabel, itemTypeNameLookup } from '../../lib/entities'
import { INHERIT_SCHEDULE_ITEM, NO_SCHEDULE_ITEM } from '../../lib/productForm'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'

/**
 * The schedule-item override select — whichever ServiceItemType this product
 * changes on checkout (see scheduleTagging.ts), with the "inherit" option's
 * label showing what it would actually resolve to for the product's current
 * category. That resolution used to run inline inside the option's JSX on
 * every render; it's a real lookup (category -> its mapped item type, or a
 * built-in fallback), not markup, so it gets a name here instead.
 */
export function ScheduleItemSelect({ category, value, onChange }: { category: string; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  const categories = useProductCategoryStore((s) => s.categories)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)

  const inheritedId = resolveProductScheduleTag({ category, serviceItemTypeId: undefined }, categories, serviceItemTypes)
  const inheritedLabel = inheritedId ? itemTypeNameLookup(serviceItemTypes)(inheritedId) : t('inventory.scheduleItemNoneOption')

  return (
    <div className="col-span-2">
      <Select label={t('inventory.scheduleItemLabel')} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={INHERIT_SCHEDULE_ITEM}>{t('inventory.scheduleItemInheritOption', { item: inheritedLabel })}</option>
        <option value={NO_SCHEDULE_ITEM}>{t('inventory.scheduleItemNoneOption')}</option>
        {serviceItemTypes.map((it) => (
          <option key={it.id} value={it.id}>
            {serviceItemTypeLabel(it.name)}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-2xs text-fg-3">{t('inventory.scheduleItemHint')}</p>
    </div>
  )
}
