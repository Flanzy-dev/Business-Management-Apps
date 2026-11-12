import { useMemo, useState } from 'react'
import { Calendar, Clock, Plus, User, Car, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Tabs } from '../../components/ui/Tabs'
import { PageHeader } from '../../components/ui/PageHeader'
import { AppointmentDialog } from '../../components/appointments/AppointmentDialog'
import { useAppointmentStore } from '../../store/appointmentStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import type { Appointment } from '../../store/appointmentStore'
import { findOwner, ownerOf } from '../../lib/vehicles/vehicleOwner'
import { useVehicleStore } from '../../store/vehicleStore'
import { StatusBadge } from '../../components/ui/Badge'
import { formatTime, formatDateLong, startOfWeek } from '../../lib/format/dates'
import { vehicleLabel } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'

const ACTIVE = (s: string) => s !== 'completed' && s !== 'cancelled' && s !== 'no-show'

function sameDay(iso: string, day: Date): boolean {
  return new Date(iso).toDateString() === day.toDateString()
}
// Shares startOfWeek with the Reports/Dashboard period filter (lib/format/dates.ts)
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
  const companies = useCompanyStore((s) => s.companies)
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

  // Customer OR company — this used to read customerId alone, so every fleet
  // (company) booking was labelled a walk-in.
  const getOwnerName = (a: Appointment) => {
    const owner = ownerOf(a)
    if (!owner) return t('appointments.walkInOwner')
    return findOwner(owner, { customers, companies })?.name || t('appointments.unknownCustomer')
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
      {/* Wraps on a tablet rather than overflowing (the date can be long in Indonesian). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-6">
        <div className="flex items-center gap-2">
          <IconButton size="lg" label={t('appointments.prevDay')} onClick={() => navigateDate(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <div className="px-4 py-2 bg-surface-card border border-border-subtle rounded-radius-sm md:min-w-[280px] text-center">
            <span className="text-text-primary font-medium">{formatDateLong(selectedDate)}</span>
          </div>
          <IconButton size="lg" label={t('appointments.nextDay')} onClick={() => navigateDate(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </div>
        <Button variant="ghost" onClick={() => setSelectedDate(new Date())} className="text-accent">
          {t('appointments.today')}
        </Button>
        <Tabs
          variant="pill"
          className="ml-auto"
          label={t('appointments.viewLabel')}
          value={viewMode}
          onChange={(v) => setViewMode(v as typeof viewMode)}
          tabs={[
            { value: 'day', label: t('appointments.dayView') },
            { value: 'week', label: t('appointments.weekView') },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled Appointments */}
        <div className="lg:col-span-2">
          <div className="bg-surface-card border border-border-2 rounded-radius-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-accent" />
              <h2 className="text-card-title text-text-primary">{t('appointments.scheduledAppointmentsHeading')}</h2>
            </div>

            {scheduled.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>{viewMode === 'week' ? t('appointments.noScheduledForWeek') : t('appointments.noScheduledForDay')}</p>
                <Button variant="secondary" icon={Plus} onClick={() => openDialog(false)} className="mt-4">
                  {t('appointments.scheduleOneNow')}
                </Button>
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
                        <span className="text-text-primary font-medium truncate" title={getOwnerName(apt)}>{getOwnerName(apt)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Car size={14} className="text-text-secondary" />
                        <span className="text-caption truncate" title={getVehicleDisplay(apt.vehicleId)}>{getVehicleDisplay(apt.vehicleId)}</span>
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
          <div className="bg-surface-card border border-border-2 rounded-radius-md p-6">
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
                      <div className="text-text-primary text-sm font-medium truncate" title={getOwnerName(apt)}>{getOwnerName(apt)}</div>
                      <div className="text-caption truncate" title={getVehicleDisplay(apt.vehicleId)}>{getVehicleDisplay(apt.vehicleId)}</div>
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
