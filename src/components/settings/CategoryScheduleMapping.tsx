// Maps each product category to the vehicle-schedule item selling a product
// in it changes (src/lib/scheduleTagging.ts) — set once per category instead
// of tagging every product by hand; ProductFormDialog can still override a
// single product. Kept as its own small card rather than folded into
// TaxonomyList: that component is shared with Service Item Types, which has
// no such mapping of its own.
import { useProductCategoryStore, type ProductCategory } from '../../store/productCategoryStore'
import { useServiceItemTypeStore, type ServiceItemType } from '../../store/serviceItemTypeStore'
import { resolveProductScheduleTag } from '../../lib/scheduleTagging'
import { productCategoryLabel, serviceItemTypeLabel, itemTypeNameLookup } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'

// Sentinels for the select — real ids are ServiceItemType.id strings, so
// these just need to never collide with one.
const BUILTIN_DEFAULT = '__builtin_default__'
const NONE = '__none__'

export function CategoryScheduleMapping() {
  const { t } = useTranslation()
  const { categories, updateProductCategory } = useProductCategoryStore()
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  const valueFor = (category: ProductCategory) =>
    category.serviceItemTypeId === undefined ? BUILTIN_DEFAULT : category.serviceItemTypeId === null ? NONE : category.serviceItemTypeId

  const handleChange = (category: ProductCategory, value: string) => {
    updateProductCategory(category.id, {
      serviceItemTypeId: value === BUILTIN_DEFAULT ? undefined : value === NONE ? null : value,
    })
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => {
        const builtinResolved = resolveProductScheduleTag({ category: category.name, serviceItemTypeId: undefined }, [], serviceItemTypes)
        return (
          <div key={category.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-fg-1">{productCategoryLabel(category.name)}</span>
            <Select
              aria-label={t('settings.categoryScheduleItemLabel', { category: productCategoryLabel(category.name) })}
              value={valueFor(category)}
              onChange={(e) => handleChange(category, e.target.value)}
              className="w-64"
            >
              <option value={BUILTIN_DEFAULT}>
                {t('settings.categoryScheduleItemBuiltinOption', {
                  item: builtinResolved ? itemTypeName(builtinResolved) : t('settings.categoryScheduleItemNoneOption'),
                })}
              </option>
              <option value={NONE}>{t('settings.categoryScheduleItemNoneOption')}</option>
              {serviceItemTypes.map((it: ServiceItemType) => (
                <option key={it.id} value={it.id}>{serviceItemTypeLabel(it.name)}</option>
              ))}
            </Select>
          </div>
        )
      })}
    </div>
  )
}
