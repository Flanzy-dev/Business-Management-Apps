import { Pencil, CalendarClock, History, Plus } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { VehicleDueStatus } from '../../lib/vehicles/vehicleDueSummary'
import { dueStatusLabel, dueStatusBadgeTone } from '../../lib/vehicles/vehicleDueSummary'
import type { useExpandOrEdit } from '../../lib/app/rowInteraction'
import { formatDistance } from '../../lib/format/numbers'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { RowActions } from '../ui/RowActions'
import { Button } from '../ui/Button'
import { VehicleDueLines } from './VehicleDueLines'
import { VehicleDetailsPanel } from './VehicleDetailsPanel'

/** One vehicle card on the Vehicles page — the collapsed summary row, and,
 *  when expanded, its due-status lines and full spec panel. */
export function VehicleRow({
  vehicle,
  ownerLabel,
  dueStatus,
  itemTypeName,
  expanded,
  rowHandlers,
  onEdit,
  onDelete,
  onShowHistory,
  onNewOrder,
  onToggle,
}: {
  vehicle: Vehicle
  ownerLabel: string
  dueStatus: VehicleDueStatus
  itemTypeName: (id: string) => string
  expanded: boolean
  /** Spread onto the row's wrapper — see useExpandOrEdit (click to expand, double-click to edit). */
  rowHandlers: ReturnType<ReturnType<typeof useExpandOrEdit>>
  onEdit: () => void
  onDelete: () => void
  onShowHistory: () => void
  onNewOrder: () => void
  /** Expand/collapse from the keyboard (Enter/Space); the pointer path goes through rowHandlers. */
  onToggle: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface-card border border-border-2 rounded-radius-md overflow-hidden">
      <div className="flex items-center hover:bg-surface-sunken transition-colors">
        {/* The summary toggles the details: click or tap, or Enter/Space when
            focused; double-click edits. Actions sit beside it, not inside, so
            a button is never nested in this role="button". */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          className="group flex-1 min-w-0 p-4 flex justify-between items-center gap-3 cursor-pointer active:bg-bg-4 focus-ring rounded-radius-md"
          {...rowHandlers}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
            e.preventDefault()
            onToggle()
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text-primary">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.color && <span className="text-text-secondary ml-2">({vehicle.color})</span>}
              </h3>
              <Badge tone={dueStatusBadgeTone(dueStatus)} dot>
                {dueStatusLabel(dueStatus)}
              </Badge>
            </div>
            <p className="text-sm text-text-secondary">
              {vehicle.licensePlate && (
                <span className="font-mono">
                  {t('vehicles.plateLabel')} {vehicle.licensePlate}
                </span>
              )}
              {vehicle.licensePlate && vehicle.currentMileage != null && ' • '}
              {vehicle.currentMileage != null && <span className="tabular-nums">{formatDistance(vehicle.currentMileage)}</span>}
              {' • '}
              <span className="text-accent">{ownerLabel}</span>
            </p>
          </div>
          <Pencil size={14} className="shrink-0 text-fg-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 pr-3">
          <Button variant="secondary" size="sm" icon={Plus} onClick={onNewOrder}>
            {t('vehicles.newOrderAction')}
          </Button>
          <RowActions
            leadingItems={[{ label: t('vehicles.serviceHistoryAction'), icon: History, onClick: onShowHistory }]}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-subtle p-4 bg-surface-sunken">
          <h4 className="font-medium text-text-primary flex items-center gap-2 mb-4">
            <CalendarClock size={16} className="text-text-secondary" /> {t('vehicles.dueHeading')}
          </h4>
          <VehicleDueLines status={dueStatus} itemTypeName={itemTypeName} currentOdometer={vehicle.currentMileage ?? 0} />
          <VehicleDetailsPanel vehicle={vehicle} />
        </div>
      )}
    </div>
  )
}
