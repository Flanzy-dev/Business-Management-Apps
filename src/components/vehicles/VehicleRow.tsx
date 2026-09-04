import { Pencil, CalendarClock, History } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { VehicleDueStatus } from '../../lib/vehicleDueSummary'
import { dueStatusLabel, dueStatusBadgeTone } from '../../lib/vehicleDueSummary'
import type { useExpandOrEdit } from '../../lib/rowInteraction'
import { formatDistance } from '../../lib/units'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { RowActions } from '../ui/RowActions'
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
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface-card rounded-radius-md overflow-hidden">
      <div className="group p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken active:bg-bg-4 transition-colors" {...rowHandlers}>
        <div>
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
        <div className="flex items-center gap-3">
          <Pencil size={14} className="text-fg-3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
          <div onClick={(e) => e.stopPropagation()}>
            <RowActions
              leadingItems={[{ label: t('vehicles.serviceHistoryAction'), icon: History, onClick: onShowHistory }]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-subtle p-4 bg-surface-sunken">
          <h4 className="font-medium text-text-primary flex items-center gap-2 mb-4">
            <CalendarClock size={16} className="text-text-secondary" /> {t('vehicles.dueHeading')}
          </h4>
          <VehicleDueLines status={dueStatus} itemTypeName={itemTypeName} />
          <VehicleDetailsPanel vehicle={vehicle} />
        </div>
      )}
    </div>
  )
}
