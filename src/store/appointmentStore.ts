import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Appointment {
  id: string
  vehicleId: string | null
  customerId: string | null
  companyId: string | null
  scheduledAt: string
  duration: number
  serviceType: string | null
  isWalkIn: boolean
  status: 'scheduled' | 'arrived' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface AppointmentStore {
  appointments: Appointment[]
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) => Appointment
  updateAppointment: (id: string, updates: Partial<Appointment>) => void
  deleteAppointment: (id: string) => void
  setStatus: (id: string, status: Appointment['status']) => void
  getAppointmentsForDate: (date: Date) => Appointment[]
  getWalkIns: () => Appointment[]
  getScheduled: () => Appointment[]
}

export const useAppointmentStore = create<AppointmentStore>()(
  persist(
    (set, get) => ({
      appointments: [],

      addAppointment: (appointmentData) => {
        const appointment: Appointment = {
          ...appointmentData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ appointments: [...state.appointments, appointment] }))
        return appointment
      },

      updateAppointment: (id, updates) => {
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
          ),
        }))
      },

      deleteAppointment: (id) => {
        set((state) => ({ appointments: state.appointments.filter((a) => a.id !== id) }))
      },

      setStatus: (id, status) => {
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a
          ),
        }))
      },

      getAppointmentsForDate: (date) => {
        const dateStr = date.toDateString()
        return get().appointments.filter(
          (a) => new Date(a.scheduledAt).toDateString() === dateStr
        )
      },

      getWalkIns: () => {
        return get().appointments.filter(
          (a) => a.isWalkIn && !['completed', 'cancelled', 'no-show'].includes(a.status)
        )
      },

      getScheduled: () => {
        return get().appointments.filter(
          (a) => !a.isWalkIn && !['completed', 'cancelled', 'no-show'].includes(a.status)
        )
      },
    }),
    {
      name: 'appointment-storage',
    }
  )
)
