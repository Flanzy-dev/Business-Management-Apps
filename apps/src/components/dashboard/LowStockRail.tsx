import { AlertTriangle, Package } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'

interface LowStockItem {
  id: string
  name: string
  sku: string | null
  qtyOnHand: number
  reorderPoint: number
  unit: string | null
}

interface LowStockRailProps {
  items: LowStockItem[]
  onViewAll?: () => void
  className?: string
}

export function LowStockRail({ items, onViewAll, className = '' }: LowStockRailProps) {
  const { t } = useTranslation()
  const criticalItems = items.filter(i => i.qtyOnHand <= Math.floor(i.reorderPoint / 2))
  const warningItems = items.filter(i => i.qtyOnHand > Math.floor(i.reorderPoint / 2))

  return (
    <div className={className}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
          <Package size={32} className="mb-2 opacity-50" />
          <p className="text-sm">{t('dashboardWidgets.allStockHealthy')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {criticalItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-danger-muted rounded-radius-sm border border-danger/30"
            >
              <AlertTriangle size={16} className="text-danger shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate" title={item.name}>{item.name}</p>
                {item.sku && <p className="text-caption font-mono">{item.sku}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-medium text-danger tabular-nums">
                  {item.qtyOnHand} {item.unit || t('dashboardWidgets.units')}
                </p>
                <p className="text-caption">{t('dashboardWidgets.ofReorderPoint', { n: item.reorderPoint })}</p>
              </div>
            </div>
          ))}
          {warningItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm"
            >
              <Package size={16} className="text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate" title={item.name}>{item.name}</p>
                {item.sku && <p className="text-caption font-mono">{item.sku}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-medium text-warning tabular-nums">
                  {item.qtyOnHand} {item.unit || t('dashboardWidgets.units')}
                </p>
                <p className="text-caption">{t('dashboardWidgets.ofReorderPoint', { n: item.reorderPoint })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {onViewAll && items.length > 0 && (
        <Button variant="link" onClick={onViewAll} className="w-full mt-3">
          {t('dashboardWidgets.viewInventory')}
        </Button>
      )}
    </div>
  )
}
