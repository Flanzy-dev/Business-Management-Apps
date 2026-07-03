import { useState } from 'react'
import { Calendar, Clock, Plus, User, Car, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppointmentStore } from '../store/appointmentStore'
import { useCustomerStore } from '../store/customerStore'
import { useVehicleStore } from '../store/vehicleStore'

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

  const getVehicleDisplay = (vehicleId: string | null) => {
    if (!vehicleId) return 'No vehicle'
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return 'Unknown'
    return `${vehicle.year || ''} ${vehicle.make} ${vehicle.model}`.trim()
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + direction)
    setSelectedDate(newDate)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-accent-blue/20 text-accent-blue'
      case 'arrived': return 'bg-accent-amber/20 text-accent-amber'
      case 'in-progress': return 'bg-accent-mint/20 text-accent-mint'
      case 'completed': return 'bg-accent-mint/20 text-accent-mint'
      case 'cancelled': return 'bg-accent-critical/20 text-accent-critical'
      case 'no-show': return 'bg-accent-critical/20 text-accent-critical'
      default: return 'bg-surface-sunken text-text-secondary'
    }
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
          className="flex items-center gap-2 bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
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
            className="w-10 h-10 rounded-tile bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-mint transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 py-2 bg-surface-card border border-border-subtle rounded-tile min-w-[280px] text-center">
            <span className="text-text-primary font-medium">{formatDate(selectedDate)}</span>
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="w-10 h-10 rounded-tile bg-surface-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-mint transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={() => setSelectedDate(new Date())}
          className="px-3 py-2 text-sm text-accent-mint hover:opacity-80"
        >
          Today
        </button>
        <div className="flex bg-surface-card border border-border-subtle rounded-tile overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 text-sm ${viewMode === 'day' ? 'bg-accent-mint/20 text-accent-mint' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Day
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-sm ${viewMode === 'week' ? 'bg-accent-mint/20 text-accent-mint' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled Appointments */}
        <div className="lg:col-span-2">
          <div className="bg-surface-card rounded-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-accent-mint" />
              <h2 className="text-card-title text-text-primary">Scheduled Appointments</h2>
            </div>

            {scheduled.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>No scheduled appointments for this day</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 text-accent-mint hover:opacity-80"
                >
                  + Schedule one now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map(apt => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-4 p-4 bg-surface-sunken rounded-tile hover:border-accent-mint/30 border border-transparent transition-colors"
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
                    <span className={`px-2 py-1 text-xs rounded-pill font-medium ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Walk-in Queue */}
        <div>
          <div className="bg-surface-card rounded-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} className="text-accent-amber" />
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
                    className="flex items-center gap-3 p-3 bg-surface-sunken rounded-tile"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-amber/20 text-accent-amber flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium truncate">
                        {getCustomerName(apt.customerId)}
                      </div>
                      <div className="text-caption truncate">{getVehicleDisplay(apt.vehicleId)}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-pill font-medium ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-4 py-2 border border-border-subtle rounded-tile text-text-secondary hover:text-text-primary hover:border-accent-mint transition-colors text-sm"
            >
              + Add Walk-in
            </button>
          </div>
        </div>
      </div>

      {/* Modal placeholder */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-card w-full max-w-md p-6">
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
