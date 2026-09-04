import { useTranslation } from '../../lib/i18n'
import { Input, Select } from '../ui/Input'

/**
 * Description, Product/Service kind, and quantity/price — the non-tagging
 * half of the line item form. A stock-linked line's description is read-only
 * (renaming it here would detach the receipt text from the product it
 * deducts stock from) and its kind isn't a choice either — see
 * LineItemDialog's stockLinked comment.
 */
export function LineItemBasicFields({
  description,
  onDescriptionChange,
  descriptionLocked,
  kind,
  onKindChange,
  stockLinked,
  quantity,
  onQuantityChange,
  unitPrice,
  onUnitPriceChange,
}: {
  description: string
  onDescriptionChange: (value: string) => void
  descriptionLocked: boolean
  kind: 'product' | 'service'
  onKindChange: (kind: 'product' | 'service') => void
  stockLinked: boolean
  quantity: string
  onQuantityChange: (value: string) => void
  unitPrice: string
  onUnitPriceChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      {descriptionLocked ? (
        <div>
          <span className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
            {t('workOrders.colDescription')}
          </span>
          <p className="text-sm text-fg-1">{description}</p>
        </div>
      ) : (
        <Input
          label={t('workOrders.colDescription')}
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder={t('workOrders.descriptionPlaceholder')}
        />
      )}

      {!stockLinked && (
        <Select label={t('workOrders.itemKindLabel')} value={kind} onChange={e => onKindChange(e.target.value as 'product' | 'service')}>
          <option value="service">{t('workOrders.itemKindService')}</option>
          <option value="product">{t('workOrders.itemKindProduct')}</option>
        </Select>
      )}

      <div className="flex gap-3">
        <div className="w-24">
          <Input
            type="number"
            min="0"
            step="any"
            label={t('workOrders.colQty')}
            mono
            className="text-right"
            value={quantity}
            onChange={e => onQuantityChange(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            type="number"
            min="0"
            label={t('workOrders.colPrice')}
            mono
            className="text-right"
            value={unitPrice}
            onChange={e => onUnitPriceChange(e.target.value)}
          />
        </div>
      </div>
    </>
  )
}
