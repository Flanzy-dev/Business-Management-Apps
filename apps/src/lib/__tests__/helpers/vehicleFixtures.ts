// Minimal rows of every store that points at a vehicle, for the vehicle
// identity / references / merge tests. Not a .test.ts file, so vitest treats
// it as a plain module.
import type { Vehicle } from '../../../store/vehicleStore'
import type { WorkOrder } from '../../../store/workOrderStore'
import type { ScheduleRule } from '../../../store/scheduleRuleStore'
import type { ServiceEvent } from '../../../store/serviceEventStore'
import type { Appointment } from '../../../store/appointmentStore'
import type { ReminderFollowUp } from '../../../store/reminderFollowUpStore'

export function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    customerId: 'c-1',
    companyId: null,
    make: '',
    model: '',
    year: null,
    vin: '',
    licensePlate: 'H 4321 AB',
    color: '',
    currentMileage: null,
    engineType: '',
    engineSize: '',
    oilTypeRequired: '',
    oilCapacity: '',
    transmissionType: '',
    transmissionFluidType: '',
    driveType: '',
    differentialFluidType: '',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    orderNumber: 1001,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2024-01-01T05:00:00.000Z',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: '2024-01-01T05:00:00.000Z',
    completedAt: '2024-01-01T05:00:00.000Z',
    ...overrides,
  }
}

export function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'r-1',
    vehicleId: 'v-1',
    itemTypeId: 'oil',
    intervalKm: 5000,
    baseOdometer: 100_000,
    intervalMonths: null,
    baseDate: '2024-01-01',
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function serviceEvent(overrides: Partial<ServiceEvent> = {}): ServiceEvent {
  return {
    id: 'e-1',
    vehicleId: 'v-1',
    workOrderId: 'wo-1',
    date: '2024-01-01',
    odometerAtArrival: null,
    odometerAtService: null,
    items: [],
    notes: '',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a-1',
    vehicleId: 'v-1',
    customerId: 'c-1',
    companyId: null,
    scheduledAt: '2026-11-01T02:00:00.000Z',
    duration: 60,
    serviceType: null,
    isWalkIn: false,
    status: 'scheduled',
    notes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

export function followUp(overrides: Partial<ReminderFollowUp> = {}): ReminderFollowUp {
  const vehicleId = overrides.vehicleId ?? 'v-1'
  return {
    id: vehicleId,
    vehicleId,
    contactedAt: '2026-09-01T00:00:00.000Z',
    snoozeUntil: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}
