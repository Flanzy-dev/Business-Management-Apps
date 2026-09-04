import { History } from 'lucide-react'
import { useActivityLogStore, type ActivityLogAction } from '../../store/activityLogStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { manualStockChanges } from '../../lib/stockLedger'
import { getDeviceId } from '../../lib/deviceId'
import { unitLabel } from '../../lib/entities'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'

type ActivityRow = {
  id: string
  at: string
  text: string
  mode?: 'admin' | 'worker'
  deviceId: string
}

/**
 * Settings' accountability log — admin-only by construction (Settings is
 * already <RequireAdmin>-wrapped in App.tsx). Merges two append-only sources
 * that were never meant to be one store (mixing them would let two records
 * of the same event drift apart — see inventoryOps.ts's "lot, movement and
 * expense are one event" rule):
 *
 * - useActivityLogStore: who added, edited, or deleted a customer/company/
 *   vehicle (Worker mode can still do these; this is the record of it).
 * - useStockMovementStore, filtered to manualStockChanges: who recorded a
 *   stock arrival or adjustment — the audit trail for the checkout catalog's
 *   double-click-to-receive-stock action, which Worker mode can also do.
 *
 * Both carry `deviceId`; stock movements additionally carry `mode` (deletions
 * always did, via ActivityLogEntry.mode). Capped at 100, same "cap + scroll"
 * call as the Inventory table — this can only grow and a first cut doesn't
 * need full pagination.
 */
export function ActivityLogCard() {
  const { t } = useTranslation()
  const deletions = useActivityLogStore((s) => s.entries)
  const movements = useStockMovementStore((s) => s.movements)
  const products = useInventoryStore((s) => s.products)

  const activityEntityLabel = (type: 'customer' | 'company' | 'vehicle') =>
    type === 'customer'
      ? t('settings.activityLogEntityCustomer')
      : type === 'company'
        ? t('settings.activityLogEntityCompany')
        : t('settings.activityLogEntityVehicle')

  const entryKeyForAction: Record<ActivityLogAction, string> = {
    create: 'settings.activityLogEntryCreated',
    update: 'settings.activityLogEntryUpdated',
    delete: 'settings.activityLogEntryDeleted',
  }

  const entityRows: ActivityRow[] = deletions.map((entry) => ({
    id: entry.id,
    at: entry.createdAt,
    text: t(entryKeyForAction[entry.action], { entityType: activityEntityLabel(entry.entityType), label: entry.label }),
    mode: entry.mode,
    deviceId: entry.deviceId,
  }))

  const stockRows: ActivityRow[] = manualStockChanges(movements).map((m) => {
    // The product may since have been deleted — same fallback-to-id rule as
    // ActivityLogEntry.label snapshotting a name at the moment of deletion.
    const product = products.find((p) => p.id === m.productId)
    const productLabel = product?.name ?? m.productId
    const key = m.delta >= 0 ? 'settings.activityLogStockReceived' : 'settings.activityLogStockRemoved'
    return {
      id: m.id,
      at: m.occurredAt,
      text: t(key, {
        qty: Math.abs(m.delta),
        unit: product ? unitLabel(product.unit) : '',
        product: productLabel,
      }),
      mode: m.mode,
      deviceId: m.deviceId,
    }
  })

  const rows = [...entityRows, ...stockRows]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 100)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.activityLogTitle')}</CardTitle>
        <p className="text-caption">{t('settings.activityLogDescription')}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={History} title={t('settings.activityLogEmpty')} />
        ) : (
          <div className="max-h-[360px] overflow-auto space-y-1">
            {rows.map((row) => {
              const isThisDevice = row.deviceId === getDeviceId()
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-2 px-1 border-b border-border-1 last:border-0 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-fg-1 truncate">{row.text}</p>
                    <p className="text-2xs text-fg-3">{formatDate(row.at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge tone={row.mode === 'admin' ? 'accent' : row.mode === 'worker' ? 'neutral' : 'neutral'}>
                      {row.mode === 'admin'
                        ? t('auth.mode.adminLabel')
                        : row.mode === 'worker'
                          ? t('auth.mode.workerLabel')
                          : t('settings.activityLogModeUnknown')}
                    </Badge>
                    <span className="font-mono text-2xs text-fg-3">
                      {isThisDevice ? t('settings.thisDeviceLabel') : row.deviceId}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
