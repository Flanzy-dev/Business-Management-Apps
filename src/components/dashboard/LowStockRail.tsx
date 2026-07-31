import { AlertTriangle, Package } from 'lucide-react'

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
  const criticalItems = items.filter(i => i.qtyOnHand <= Math.floor(i.reorderPoint / 2))
  const warningItems = items.filter(i => i.qtyOnHand > Math.floor(i.reorderPoint / 2))

  return (
    <div className={className}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
          <Package size={32} className="mb-2 opacity-50" />
          <p className="text-sm">All stock levels healthy</p>
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
                <p className="text-sm text-text-primary truncate">{item.name}</p>
                {item.sku && <p className="text-caption font-mono">{item.sku}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-danger tabular-nums">
                  {item.qtyOnHand} {item.unit || 'units'}
                </p>
                <p className="text-caption">of {item.reorderPoint}</p>
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
                <p className="text-sm text-text-primary truncate">{item.name}</p>
                {item.sku && <p className="text-caption font-mono">{item.sku}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-warning tabular-nums">
                  {item.qtyOnHand} {item.unit || 'units'}
                </p>
                <p className="text-caption">of {item.reorderPoint}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {onViewAll && items.length > 0 && (
        <button
          onClick={onViewAll}
          className="w-full mt-3 py-2 text-sm text-accent hover:opacity-80 transition-opacity"
        >
          View Inventory →
        </button>
      )}
    </div>
  )
}
