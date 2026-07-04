import { useState } from 'react'
import { Calendar, Clock, Plus, User, Car, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppointmentStore } from '../store/appointmentStore'
import { useCustomerStore } from '../store/customerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { StatusBadge } from '../components/ui/Badge'
import { formatTime, formatDateLong } from '../lib/dates'
import { vehicleLabel } from '../lib/entities'

export default function Appointments() {
  const { appointments } = useAppointmentStore()
  const { customers } = useCustomerStore()
  const { vehicles } = useVehicleStore()
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)

  const scheduled = appointments.filter(a => !a.isWalkIn && a.status !== 'completed' && a.status !== 'cancelled')
  const walkIns = appointments.filter(a => a.isWalkIn && a.status !== 'completed' && a.status !== 'cancelled')

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'Walk-in'
    const customer = customers.find(c => c.id === customerId)
    return customer?.name || 'Unknown'
  }

  const getVehicleDisplay = (vehicleId: string | null) =>
    vehicleId ? vehicleLabel(vehicles.find(v => v.id === vehicleId)) : 'No vehicle'

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + direction)
    setSelectedDate(newDate)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Appointments</h1>
          <p className="text-caption">{scheduled.length} scheduled, {walkIns.length} walk-ins waiting</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
        >
          <Plus size={18} />
          New Appointment
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="w-10 h-10 rounded-radius-sm bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 py-2 bg-surface-card border border-border-subtle rounded-radius-sm min-w-[280px] text-center">
            <span className="text-text-primary font-medium">{formatDateLong(selectedDate)}</span>
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="w-10 h-10 rounded-radius-sm bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={() => setSelectedDate(new Date())}
          className="px-3 py-2 text-sm text-accent hover:opacity-80"
        >
          Today
        </button>
        <div className="flex bg-surface-card border border-border-subtle rounded-radius-sm overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 text-sm ${viewMode === 'day' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Day
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-sm ${viewMode === 'week' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled Appointments */}
        <div className="lg:col-span-2">
          <div className="bg-surface-card rounded-radius-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-accent" />
              <h2 className="text-card-title text-text-primary">Scheduled Appointments</h2>
            </div>

            {scheduled.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>No scheduled appointments for this day</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 text-accent hover:opacity-80"
                >
                  + Schedule one now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map(apt => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 bg-surface-sunken rounded-radius-sm hover:border-accent/30 border border-transparent transition-colors"
                  >
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-semibold text-text-primary tabular-nums">
                        {formatTime(apt.scheduledAt)}
                      </div>
                      <div className="text-caption">{apt.duration}min</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-text-secondary" />
                        <span className="text-text-primary font-medium truncate">
                          {getCustomerName(apt.customerId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Car size={14} className="text-text-secondary" />
                        <span className="text-caption truncate">{getVehicleDisplay(apt.vehicleId)}</span>
                      </div>
                      {apt.serviceType && (
                        <div className="text-caption mt-1">{apt.serviceType}</div>
                      )}
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
              <h2 className="text-card-title text-text-primary">Walk-in Queue</h2>
            </div>

            {walkIns.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <p className="text-sm">No walk-ins waiting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {walkIns.map((apt, index) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium truncate">
                        {getCustomerName(apt.customerId)}
                      </div>
                      <div className="text-caption truncate">{getVehicleDisplay(apt.vehicleId)}</div>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-4 py-2 border border-border-subtle rounded-radius-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors text-sm"
            >
              + Add Walk-in
            </button>
          </div>
        </div>
      </div>

      {/* Modal placeholder */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
          <div className="bg-surface-card rounded-radius-md w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4">New Appointment</h2>
            <p className="text-text-secondary mb-4">Appointment creation form coming soon.</p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
