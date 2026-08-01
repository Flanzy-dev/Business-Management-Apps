import { useEffect, useState } from 'react'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { ServiceTagFields, ServiceTagState, emptyServiceTag } from './ServiceTagFields'

/** What the dialog hands back — the editable slice of a line item. */
export interface LineItemDraft {
  description: string
  quantity: number
  unitPrice: number
  serviceItemTypeId: string | null
  quantityLiters: number | null
  serviceAction: 'changed' | 'topped_up' | null
  containerType: WorkOrderItem['containerType']
}

interface LineItemDialogProps {
  open: boolean
  /** 'custom' adds a new manual line; 'edit' edits `item`. */
  mode: 'custom' | 'edit'
  item?: WorkOrderItem
  onSave: (draft: LineItemDraft) => void
  onRemove?: () => void
  onClose: () => void
}

function tagFromItem(item?: WorkOrderItem): ServiceTagState {
  if (!item?.serviceItemTypeId) return emptyServiceTag
  return {
    enabled: true,
    itemTypeId: item.serviceItemTypeId,
    quantityLiters: item.quantityLiters != null ? String(item.quantityLiters) : '',
    action: item.serviceAction ?? 'changed',
    containerType: item.containerType ?? '',
  }
}

/**
 * One dialog for both "edit a ticket line" and "add a custom item" — including
 * the optional service-schedule tagging, which used to be a panel that applied
 * to whichever line was added next. Tagging per line means a tap-to-add catalog
 * can stay a single tap.
 */
export function LineItemDialog({ open, mode, item, onSave, onRemove, onClose }: LineItemDialogProps) {
  const { t } = useTranslation()
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)

  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [tag, setTag] = useState<ServiceTagState>(emptyServiceTag)

  // Reseed from the line being edited each time the dialog opens (and never
  // while it's open, so typing isn't clobbered by the parent re-rendering).
  useEffect(() => {
    if (!open) return
    setDescription(item?.description ?? '')
    setQuantity(String(item?.quantity ?? 1))
    setUnitPrice(item ? String(item.unitPrice) : '')
    setTag(tagFromItem(item))
  }, [open, item?.id])

  // Product lines take their name from inventory — renaming one here would
  // silently detach the receipt text from the product it deducts stock from.
  const descriptionLocked = mode === 'edit' && !!item?.productId
  const canSave = description.trim().length > 0 && parseFloat(quantity) > 0

  const handleSave = () => {
    if (!canSave) return
    const tagged = tag.enabled && tag.itemTypeId
    onSave({
      description: description.trim(),
      quantity: parseFloat(quantity) || 1,
      unitPrice: Math.round(parseFloat(unitPrice) || 0),
      serviceItemTypeId: tagged ? tag.itemTypeId : null,
      quantityLiters: tagged && tag.quantityLiters ? parseFloat(tag.quantityLiters) : null,
      serviceAction: tagged ? tag.action : null,
      containerType: tagged ? tag.containerType || null : null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'custom' ? t('workOrders.customItemTitle') : t('workOrders.editLineTitle')}
      size="md"
    >
      <div className="space-y-4">
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
            onChange={e => setDescription(e.target.value)}
            placeholder={t('workOrders.descriptionPlaceholder')}
          />
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
              onChange={e => setQuantity(e.target.value)}
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
              onChange={e => setUnitPrice(e.target.value)}
            />
          </div>
        </div>

        <ServiceTagFields tag={tag} onChange={setTag} serviceItemTypes={serviceItemTypes} />
      </div>

      <DialogFooter>
        {mode === 'edit' && onRemove && (
          <Button variant="danger" type="button" onClick={onRemove} className="mr-auto">
            {t('workOrders.removeAction')}
          </Button>
        )}
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          {mode === 'custom' ? t('common.add') : t('common.save')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
