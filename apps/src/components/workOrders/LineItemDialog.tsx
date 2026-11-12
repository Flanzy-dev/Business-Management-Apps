import { useEffect, useState } from 'react'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { tagFromItem, canSaveLineItem, lineItemDraftFromForm, lineCalcPreview, liveIntervalForTag, type LineItemDraft } from '../../lib/orders/lineItemForm'
import { useTranslation } from '../../lib/i18n'
import { Dialog } from '../ui/Dialog'
import { ServiceTagFields, ServiceTagState, emptyServiceTag } from './ServiceTagFields'
import { LineItemBasicFields } from './LineItemBasicFields'
import { LineItemDialogFooter } from './LineItemDialogFooter'
import { useRequiredFields } from '../../hooks/useRequiredFields'

export type { LineItemDraft }

interface LineItemDialogProps {
  open: boolean
  /** 'custom' adds a new manual line; 'edit' edits `item`. */
  mode: 'custom' | 'edit'
  item?: WorkOrderItem
  onSave: (draft: LineItemDraft) => void
  onRemove?: () => void
  onClose: () => void
  /** This vehicle's live interval for whichever item type is tagged right now
   *  — shown as the requested-interval placeholder. Looked up by the caller
   *  (WorkOrderEditor knows the vehicle) rather than passed as a static prop,
   *  since it must track the tag's itemTypeId as staff change it. */
  getLiveIntervalKm?: (itemTypeId: string) => number | null
}

/**
 * One dialog for both "edit a ticket line" and "add a custom item" — including
 * the optional service-schedule tagging, which used to be a panel that applied
 * to whichever line was added next. Tagging per line means a tap-to-add catalog
 * can stay a single tap.
 */
export function LineItemDialog({ open, mode, item, onSave, onRemove, onClose, getLiveIntervalKm }: LineItemDialogProps) {
  const { t } = useTranslation()
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)

  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [kind, setKind] = useState<'product' | 'service'>('service')
  const [tag, setTag] = useState<ServiceTagState>(emptyServiceTag)

  // Reseed from the line being edited each time the dialog opens (and never
  // while it's open, so typing isn't clobbered by the parent re-rendering).
  useEffect(() => {
    if (!open) return
    setDescription(item?.description ?? '')
    setQuantity(String(item?.quantity ?? 1))
    setUnitPrice(item ? String(item.unitPrice) : '')
    // A fresh custom item defaults to Service (today's only option before this
    // field existed); editing an untyped legacy line falls back the same way
    // itemKind() does, so its badge doesn't silently flip the moment it's opened.
    setKind(item?.kind ?? 'service')
    setTag(tagFromItem(item))
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseeds only when the dialog opens or the record changes; depending on the record object or reset() would wipe what is being typed on every parent render
  }, [open, item?.id])

  // Product lines take their name from inventory — renaming one here would
  // silently detach the receipt text from the product it deducts stock from.
  // The same stock link is why its Product/Service classification isn't a
  // choice either: a productId line is always 'product' (src/lib/orders/orderItemGroups.ts).
  const stockLinked = !!item?.productId
  const descriptionLocked = mode === 'edit' && stockLinked
  const { errors, flag, clear, reset } = useRequiredFields<'description' | 'quantity'>()

  // Save stays enabled and says what's missing, rather than greying out.
  const handleSave = () => {
    if (!canSaveLineItem(description, quantity)) {
      flag({
        description: !description.trim() && t('common.requiredField'),
        quantity: !(parseFloat(quantity) > 0) && t('workOrders.quantityPositiveError'),
      })
      return
    }
    onSave(lineItemDraftFromForm(description, quantity, unitPrice, kind, stockLinked, tag))
  }

  return (
    <Dialog closeOnScrimClick={false}
      open={open}
      onClose={onClose}
      title={mode === 'custom' ? t('workOrders.customItemTitle') : t('workOrders.editLineTitle')}
      size="md"
    >
      <div className="space-y-4">
        <LineItemBasicFields
          description={description}
          onDescriptionChange={(value) => { setDescription(value); clear('description') }}
          descriptionError={errors.description}
          quantityError={errors.quantity}
          descriptionLocked={descriptionLocked}
          kind={kind}
          onKindChange={setKind}
          stockLinked={stockLinked}
          quantity={quantity}
          onQuantityChange={(value) => { setQuantity(value); clear('quantity') }}
          unitPrice={unitPrice}
          onUnitPriceChange={setUnitPrice}
          preview={lineCalcPreview(quantity, unitPrice)}
        />

        <ServiceTagFields
          tag={tag}
          onChange={setTag}
          serviceItemTypes={serviceItemTypes}
          currentIntervalKm={liveIntervalForTag(tag, getLiveIntervalKm)}
        />
      </div>

      <LineItemDialogFooter mode={mode} onRemove={onRemove} onClose={onClose} onSave={handleSave} />
    </Dialog>
  )
}
