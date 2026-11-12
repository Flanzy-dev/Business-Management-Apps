import { CalendarClock } from 'lucide-react'
import type { Appointment } from '../../store/appointmentStore'
import { StatusBadge } from '../ui/Badge'
import { formatTime } from '../../lib/format/dates'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'

interface TodayScheduleRailProps {
  appointments: Appointment[]
  getOwnerLabel: (appointment: Appointment) => string
  getVehicleLabel: (appointment: Appointment) => string
  onViewAll?: () => void
  className?: string
}

export function TodayScheduleRail({
  appointments,
  getOwnerLabel,
  getVehicleLabel,
  onViewAll,
  className = '',
}: TodayScheduleRailProps) {
  const { t } = useTranslation()

  return (
    <div className={className}>
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
          <CalendarClock size={32} className="mb-2 opacity-50" />
          <p className="text-sm">{t('dashboardWidgets.noAppointmentsToday')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
              <span className="font-mono text-sm text-text-primary tabular-nums shrink-0 w-16">
                {a.isWalkIn ? t('dashboardWidgets.walkIn') : formatTime(a.scheduledAt)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate" title={getOwnerLabel(a)}>{getOwnerLabel(a)}</p>
                <p className="text-caption truncate">
                  {getVehicleLabel(a)}
                  {a.serviceType ? ` · ${a.serviceType}` : ''}
                </p>
              </div>
              <StatusBadge status={a.status} className="shrink-0" />
            </div>
          ))}
        </div>
      )}
      {onViewAll && (
        <Button variant="link" onClick={onViewAll} className="w-full mt-3">
          {t('dashboardWidgets.viewAppointments')}
        </Button>
      )}
    </div>
  )
}
