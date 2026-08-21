import { useEffect, useState } from 'react'
import { Minus, Plus, Printer, Trash2 } from 'lucide-react'
import { useWorkOrderStore, WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useTranslation } from '../../lib/i18n'
import { groupOrderItemsByType } from '../../lib/orderItemGroups'
import { formatCurrency } from '../../lib/currency'
import { formatDateTime } from '../../lib/dates'
import { serviceItemTypeLabel } from '../../lib/entities'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

const PAYMENT_METHOD_LABEL_KEYS: Record<Exclude<WorkOrder['paymentMethod'], 'pending'>, string> = {
  cash: 'paymentCash',
  qris: 'paymentQris',
  card: 'paymentCard',
  check: 'paymentCheck',
}

// How long a pause in typing has to be before the discount/tax fields commit
// to the store — each committed write round-trips through Electron IPC to a
// full SQLite flush (see server/db.ts), so committing on every keystroke
// froze the renderer badly enough to drop keystrokes entirely.
const COMMIT_DEBOUNCE_MS = 250

interface CheckoutTicketProps {
  order: WorkOrder
  /** Completed/cancelled orders show the same ticket without any editing affordance. */
  readOnly: boolean
  onEditLine: (item: WorkOrderItem) => void
  onQtyChange: (item: WorkOrderItem, delta: number) => void
  onRemove: (itemId: string) => void
  onCharge: () => void
  onPrint: () => void
}

/** The register's running ticket: order meta, line items, totals, charge button. */
export function CheckoutTicket({
  order,
  readOnly,
  onEditLine,
  onQtyChange,
  onRemove,
  onCharge,
  onPrint,
}: CheckoutTicketProps) {
  const { t, tc } = useTranslation()
  const updateWorkOrder = useWorkOrderStore(s => s.updateWorkOrder)
  const setDiscount = useWorkOrderStore(s => s.setDiscount)
  const setTaxPercent = useWorkOrderStore(s => s.setTaxPercent)

  // Mirrors order.discountAmount as free-typed text rather than binding the
  // input straight to that number — a controlled number input bound directly
  // to 0 re-renders as "0" the instant the box is cleared, trapping the
  // cashier into deleting a lingering zero before they can type. Re-seeded
  // only when the order identity changes (switching tickets), same as
  // LineItemDialog's reseed-on-open — never on every keystroke, or the
  // store's clamped write-back would fight what's still being typed.
  // Guards against `undefined` too — a pre-existing order loaded before
  // discountAmount existed on the shape would otherwise display "undefined".
  const discountDisplay = (amount: number | undefined) => (!amount ? '' : String(amount))
  const [discountText, setDiscountText] = useState(discountDisplay(order.discountAmount))
  useEffect(() => {
    setDiscountText(discountDisplay(order.discountAmount))
  }, [order.id])

  // Commits to the store only once typing pauses — see COMMIT_DEBOUNCE_MS.
  // The store clamps discountAmount to the order's subtotal itself
  // (workOrderStore.ts's calculateTotals), so nothing is duplicated here.
  const discountCommit = useDebouncedCallback(
    (amount: number) => setDiscount(order.id, amount),
    COMMIT_DEBOUNCE_MS
  )

  const groups = groupOrderItemsByType(order.items)

  const renderLine = (item: WorkOrderItem) => (
    <TicketLine
      key={item.id}
      item={item}
      readOnly={readOnly}
      onEdit={() => onEditLine(item)}
      onQtyChange={delta => onQtyChange(item, delta)}
      onRemove={() => onRemove(item.id)}
    />
  )

  const renderGroup = (label: string, items: WorkOrderItem[], subtotal: number) => (
    <div>
      <div className="flex items-baseline justify-between px-1 pb-1 border-b border-border-1">
        <span className="text-2xs uppercase font-semibold tracking-wide text-fg-3">{label}</span>
        <span className="font-mono text-2xs text-fg-3 tabular-nums">{formatCurrency(subtotal)}</span>
      </div>
      <div>{items.map(renderLine)}</div>
    </div>
  )

  return (
    <div className="bg-surface-card rounded-radius-md p-4 flex flex-col min-h-0">
      {/* Ticket head */}
      <div className="shrink-0 pb-3 border-b border-border-1">
        <div className="flex items-baseline justify-between">
          <h2 className="text-card-title text-fg-1">{t('workOrders.servicesProductsHeading')}</h2>
          <span className="text-2xs text-fg-3">{tc('workOrders.itemCountLabel', order.items.length)}</span>
        </div>
        <p className="mt-1 font-mono text-2xs text-fg-3 tabular-nums">{formatDateTime(order.createdAt)}</p>

        {readOnly ? (
          <p className="mt-2 text-xs text-fg-3">
            {t('workOrders.odometerAtServiceField')}{' '}
            <span className="text-fg-1 tabular-nums">{order.odometerAtService?.toLocaleString() || '-'}</span>
          </p>
        ) : (
          <div className="mt-3">
            <Input
              type="number"
              label={t('workOrders.odometerAtServiceLabel')}
              value={order.odometerAtService ?? ''}
              onChange={e =>
                updateWorkOrder(order.id, {
                  odometerAtService: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              placeholder={t('workOrders.odometerAtServicePlaceholder')}
            />
          </div>
        )}

        {order.notes && (
          <p className="mt-2 text-xs text-fg-3">
            {t('workOrders.notesField')} <span className="text-fg-2">{order.notes}</span>
          </p>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4">
        {order.items.length === 0 ? (
          <p className="text-sm text-fg-3 text-center py-8">
            {readOnly ? t('workOrders.noItemsYet') : t('workOrders.ticketEmpty')}
          </p>
        ) : (
          <>
            {groups.products.length > 0 &&
              renderGroup(t('workOrders.productsSectionLabel'), groups.products, groups.productsSubtotal)}
            {groups.services.length > 0 &&
              renderGroup(t('workOrders.servicesSectionLabel'), groups.services, groups.servicesSubtotal)}
          </>
        )}
      </div>

      {/* Totals + charge */}
      <div className="shrink-0 pt-3 border-t border-border-1 text-sm">
        <div className="flex justify-between text-text-secondary">
          <span>{t('workOrders.subtotalLabel')}</span>
          <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
        </div>

        {readOnly ? (
          <>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-danger">
                <span>{t('workOrders.discountLabel')}</span>
                <span className="tabular-nums">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-text-secondary">
              <span>{t('workOrders.taxLabel', { percent: order.taxPercent })}</span>
              <span className="tabular-nums">{formatCurrency(order.taxAmount)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <label className="text-text-secondary shrink-0">{t('workOrders.discountAmountLabel')}</label>
              <div className="w-28">
                <Input
                  // type="text", not "number" — a native number input's own
                  // parsing/sanitization can fight a controlled value bound to
                  // an empty string (the exact "can't type anything" symptom),
                  // especially once a `max` is added. Digits are filtered by
                  // hand below instead, same job with none of that.
                  type="text"
                  inputMode="numeric"
                  mono
                  className="text-right"
                  // The store clamps discountAmount to the order's subtotal
                  // (workOrderStore.ts's calculateTotals) — with no items on
                  // the ticket yet, subtotal is 0, so any discount typed
                  // commits as 0 and the box goes right back to blank. That
                  // clamp is correct; typing into the box while it's
                  // guaranteed to be discarded is what isn't — disable it
                  // instead, with the same disabled+title-hint pattern the
                  // sold-out product tile uses (CheckoutCatalog.tsx).
                  disabled={order.subtotal === 0}
                  title={order.subtotal === 0 ? t('workOrders.discountNeedsItemsHint') : undefined}
                  value={discountText}
                  onChange={e => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
                    // Updates the box on every keystroke so typing feels
                    // instant — but the store write (and everything that
                    // follows it: persist to SQLite, sync outbox) only fires
                    // once typing pauses. The store clamps to subtotal itself,
                    // so an empty box is passed through as 0 rather than
                    // clamped here too.
                    setDiscountText(digitsOnly)
                    discountCommit.call(digitsOnly === '' ? 0 : parseInt(digitsOnly, 10))
                  }}
                  // Commits immediately rather than waiting out the debounce,
                  // then normalizes stray leftovers — an over-large or
                  // leading-zero entry snaps to what actually got stored (and
                  // a zero discount settles back to blank, not "0"). Reads
                  // straight from the store rather than the `order` prop:
                  // flush()'s store write is synchronous, but the prop won't
                  // reflect it until React's next render, which hasn't
                  // happened yet inside this same handler.
                  onBlur={() => {
                    discountCommit.flush()
                    const fresh = useWorkOrderStore.getState().workOrders.find(w => w.id === order.id)
                    setDiscountText(discountDisplay(fresh?.discountAmount ?? order.discountAmount))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                  placeholder="0"
                />
              </div>
            </div>
            <PercentRow
              resetKey={order.id}
              label={t('workOrders.taxPercentLabel')}
              value={order.taxPercent}
              amount={order.taxAmount > 0 ? formatCurrency(order.taxAmount) : ''}
              amountClassName="text-text-secondary"
              onChange={percent => setTaxPercent(order.id, percent)}
            />
          </>
        )}

        <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-border-1">
          <span className="text-text-secondary">{t('workOrders.totalLabel')}</span>
          <span className="font-mono text-xl font-bold text-fg-1 tabular-nums">{formatCurrency(order.total)}</span>
        </div>

        {readOnly ? (
          <>
            {/* A cancelled order never took payment — only a completed one has a method to show. */}
            {order.paymentMethod !== 'pending' && (
              <p className="mt-2 text-xs text-fg-3">
                {t('workOrders.paymentMethodField')}{' '}
                <span className="text-fg-1">{t(`workOrders.${PAYMENT_METHOD_LABEL_KEYS[order.paymentMethod]}`)}</span>
              </p>
            )}
            <Button variant="secondary" size="touch" icon={Printer} onClick={onPrint} className="w-full mt-3">
              {t('workOrders.printReceiptButton')}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="touch"
            onClick={onCharge}
            disabled={order.items.length === 0}
            className="w-full mt-3"
          >
            {t('workOrders.chargeAmount', { amount: formatCurrency(order.total) })}
          </Button>
        )}
      </div>
    </div>
  )
}

function TicketLine({
  item,
  readOnly,
  onEdit,
  onQtyChange,
  onRemove,
}: {
  item: WorkOrderItem
  readOnly: boolean
  onEdit: () => void
  onQtyChange: (delta: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const taggedType = item.serviceItemTypeId
    ? serviceItemTypes.find(it => it.id === item.serviceItemTypeId)
    : undefined

  return (
    <div className="py-2 border-b border-border-1 last:border-b-0">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={readOnly}
          className={`flex-1 min-w-0 text-left rounded-radius-xs focus-ring ${
            readOnly ? 'cursor-default' : 'cursor-pointer hover:text-accent'
          }`}
        >
          <span className="block text-sm text-fg-1 leading-snug">{item.description}</span>
          {taggedType && (
            <span className="mt-1 inline-block px-1.5 py-0.5 rounded-radius-full bg-accent-muted text-accent text-2xs">
              {serviceItemTypeLabel(taggedType.name)}
            </span>
          )}
        </button>
        <span className="shrink-0 font-mono text-sm text-fg-1 tabular-nums">{formatCurrency(item.lineTotal)}</span>
      </div>

      {readOnly ? (
        <p className="mt-0.5 font-mono text-2xs text-fg-3 tabular-nums">
          {item.quantity} × {formatCurrency(item.unitPrice)}
        </p>
      ) : (
        <div className="flex items-center gap-1 mt-1.5">
          <IconButton size="sm" label={t('workOrders.decreaseQty')} onClick={() => onQtyChange(-1)}>
            <Minus size={14} />
          </IconButton>
          <span className="w-8 text-center font-mono text-sm text-fg-1 tabular-nums">{item.quantity}</span>
          <IconButton size="sm" label={t('workOrders.increaseQty')} onClick={() => onQtyChange(1)}>
            <Plus size={14} />
          </IconButton>
          <span className="ml-2 font-mono text-2xs text-fg-3 tabular-nums">× {formatCurrency(item.unitPrice)}</span>
          <IconButton
            size="sm"
            label={t('workOrders.removeAction')}
            onClick={onRemove}
            className="ml-auto text-danger hover:text-danger"
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}
    </div>
  )
}

/** Inline "Discount %" / "Tax %" row: percent field on the left, resulting amount on the right. */
function PercentRow({
  resetKey,
  label,
  value,
  amount,
  amountClassName,
  onChange,
}: {
  /** Identifies which order this row belongs to (order.id) — reseeds the
   *  typed text when it changes, same as the discount field's order.id
   *  effect, so switching tickets doesn't leave a stale rate on screen. */
  resetKey: string
  label: string
  value: number
  amount: string
  amountClassName: string
  onChange: (percent: number) => void
}) {
  // Same free-typed-text treatment as the discount field above, for the same
  // reason: bound straight to `value`, clearing the box re-renders it as "0"
  // and the cashier has to delete that zero before typing a new rate.
  // Decimals are allowed here (a 2.5% rate is real), unlike whole-Rupiah
  // discounts.
  const display = (percent: number) => (percent === 0 ? '' : String(percent))
  const [text, setText] = useState(display(value))
  useEffect(() => {
    setText(display(value))
  }, [resetKey])

  // Same debounced-commit treatment as the discount field, and for the same
  // reason: `onChange` here ultimately triggers a store write that persists
  // through a full SQLite flush (see server/db.ts), which committing on
  // every keystroke made slow enough to drop keystrokes.
  const commit = useDebouncedCallback(onChange, COMMIT_DEBOUNCE_MS)

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="text-text-secondary shrink-0">{label}</label>
      <div className="flex items-center gap-2">
        <div className="w-16">
          <Input
            type="text"
            inputMode="decimal"
            mono
            className="text-right"
            value={text}
            placeholder="0"
            onChange={e => {
              // One optional decimal point, digits either side — nothing else.
              const cleaned = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
              setText(cleaned)
              commit.call(parseFloat(cleaned) || 0)
            }}
            // Commits immediately rather than waiting out the debounce, then
            // normalizes the text (e.g. a trailing "." or leading zeros) to
            // match what was actually committed. Unlike the discount field,
            // no server-side clamp can change this number, so the just-typed
            // value itself is the correct thing to reformat from — no need
            // to read the store back.
            onBlur={() => {
              commit.flush()
              setText(display(parseFloat(text) || 0))
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        </div>
        <span className={`tabular-nums w-24 text-right ${amountClassName}`}>{amount}</span>
      </div>
    </div>
  )
}
