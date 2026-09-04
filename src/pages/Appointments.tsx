import { useMemo, useState } from 'react'
import { Calendar, Clock, Plus, User, Car, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { AppointmentDialog } from '../components/appointments/AppointmentDialog'
import { useAppointmentStore } from '../store/appointmentStore'
import { useCustomerStore } from '../store/customerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { StatusBadge } from '../components/ui/Badge'
import { formatTime, formatDateLong, startOfWeek } from '../lib/dates'
import { vehicleLabel } from '../lib/entities'
import { useTranslation } from '../lib/i18n'

const ACTIVE = (s: string) => s !== 'completed' && s !== 'cancelled' && s !== 'no-show'

function sameDay(iso: string, day: Date): boolean {
  return new Date(iso).toDateString() === day.toDateString()
}
// Shares startOfWeek with the Reports/Dashboard period filter (lib/dates.ts)
// so "this week" means the same date span everywhere in the app.
function inWeekOf(iso: string, day: Date): boolean {
  const start = startOfWeek(day)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

export default function Appointments() {
  const { t } = useTranslation()
  const appointments = useAppointmentStore((s) => s.appointments)
  const customers = useCustomerStore((s) => s.customers)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [dialog, setDialog] = useState<{ open: boolean; walkIn: boolean }>({ open: false, walkIn: false })

  // Scheduled appointments actually respect the date navigator and the
  // Day/Week toggle now — previously both controls only changed a label.
  const scheduled = useMemo(
    () =>
      appointments
        .filter((a) => !a.isWalkIn && ACTIVE(a.status))
        .filter((a) => (viewMode === 'week' ? inWeekOf(a.scheduledAt, selectedDate) : sameDay(a.scheduledAt, selectedDate)))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [appointments, viewMode, selectedDate],
  )

  // Walk-ins are a live "who is waiting" list, not a calendar — never scoped
  // to the selected date.
  const walkIns = useMemo(
    () => appointments.filter((a) => a.isWalkIn && ACTIVE(a.status)),
    [appointments],
  )

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return t('appointments.walkInOwner')
    return customers.find((c) => c.id === customerId)?.name || t('appointments.unknownCustomer')
  }
  const getVehicleDisplay = (vehicleId: string | null) =>
    vehicleId ? vehicleLabel(vehicles.find((v) => v.id === vehicleId)) : t('appointments.noVehicle')

  const navigateDate = (direction: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + direction)
    setSelectedDate(d)
  }

  const openDialog = (walkIn: boolean) => setDialog({ open: true, walkIn })

  return (
    <div>
      <PageHeader
        title={t('appointments.title')}
        caption={t('appointments.caption', { scheduled: scheduled.length, walkIns: walkIns.length })}
        action={
          <Button variant="primary" icon={Plus} onClick={() => openDialog(false)}>
            {t('appointments.newAppointment')}
          </Button>
        }
      />

      {/* Date Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            aria-label={t('appointments.prevDay')}
            className="w-10 h-10 rounded-radius-sm bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent transition-colors focus-ring"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 py-2 bg-surface-card border border-border-subtle rounded-radius-sm min-w-[280px] text-center">
            <span className="text-text-primary font-medium">{formatDateLong(selectedDate)}</span>
          </div>
          <button
            onClick={() => navigateDate(1)}
            aria-label={t('appointments.nextDay')}
            className="w-10 h-10 rounded-radius-sm bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent transition-colors focus-ring"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={() => setSelectedDate(new Date())}
          className="px-3 py-2 text-sm text-accent hover:opacity-80 focus-ring"
        >
          {t('appointments.today')}
        </button>
        <div className="flex bg-surface-card border border-border-subtle rounded-radius-sm overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 text-sm ${viewMode === 'day' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {t('appointments.dayView')}
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-sm ${viewMode === 'week' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {t('appointments.weekView')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled Appointments */}
        <div className="lg:col-span-2">
          <div className="bg-surface-card rounded-radius-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-accent" />
              <h2 className="text-card-title text-text-primary">{t('appointments.scheduledAppointmentsHeading')}</h2>
            </div>

            {scheduled.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>{viewMode === 'week' ? t('appointments.noScheduledForWeek') : t('appointments.noScheduledForDay')}</p>
                <button
                  onClick={() => openDialog(false)}
                  className="mt-4 text-accent hover:opacity-80 focus-ring"
                >
                  {t('appointments.scheduleOneNow')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 bg-surface-sunken rounded-radius-sm hover:border-accent/30 border border-transparent transition-colors"
                  >
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-semibold text-text-primary tabular-nums">{formatTime(apt.scheduledAt)}</div>
                      <div className="text-caption">{t('appointments.minutesSuffix', { count: apt.duration })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-text-secondary" />
                        <span className="text-text-primary font-medium truncate">{getCustomerName(apt.customerId)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Car size={14} className="text-text-secondary" />
                        <span className="text-caption truncate">{getVehicleDisplay(apt.vehicleId)}</span>
                      </div>
                      {apt.serviceType && <div className="text-caption mt-1">{apt.serviceType}</div>}
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Walk-in Queue */}
        <div>
          <div className="bg-surface-card rounded-radius-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} className="text-warning" />
              <h2 className="text-card-title text-text-primary">{t('appointments.walkInQueueHeading')}</h2>
            </div>

            {walkIns.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <p className="text-sm">{t('appointments.noWalkInsWaiting')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {walkIns.map((apt, index) => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
                    <div className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium truncate">{getCustomerName(apt.customerId)}</div>
                      <div className="text-caption truncate">{getVehicleDisplay(apt.vehicleId)}</div>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => openDialog(true)}
              className="w-full mt-4 py-2 border border-border-subtle rounded-radius-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors text-sm focus-ring"
            >
              {t('appointments.addWalkIn')}
            </button>
          </div>
        </div>
      </div>

      <AppointmentDialog
        open={dialog.open}
        walkIn={dialog.walkIn}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  )
}
