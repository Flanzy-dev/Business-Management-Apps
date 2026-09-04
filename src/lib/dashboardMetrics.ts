// Pure derivations behind Dashboard.tsx's widgets. No store access, same
// pattern as finance.ts/reminders.ts — callers read stores and pass arrays
// in, with `now` injected so a test can pin the clock. Text formatting
// (translated day/month/unit labels) stays in the component; everything
// here returns plain data so it's testable without i18n.
import type { WorkOrder } from '../store/workOrderStore'
import type { Customer } from '../store/customerStore'
import type { Bay } from '../store/bayStore'
import type { Worker } from '../store/workerStore'
import type { Appointment } from '../store/appointmentStore'
import type { DateRange } from './dates'
import { pctDelta, filterCompletedOrders } from './finance'
import { groupOrderItemsByType } from './orderItemGroups'

function sameDay(iso: string, target: string): boolean {
  return new Date(iso).toDateString() === target
}

interface PeriodOrderTotals {
  revenue: number
  vehiclesServiced: number
  partsUsed: number
}

function orderTotalsInRange(orders: WorkOrder[], range: DateRange): PeriodOrderTotals {
  const inRange = filterCompletedOrders(orders, range)
  return {
    revenue: inRange.reduce((sum, wo) => sum + wo.total, 0),
    vehiclesServiced: inRange.length,
    partsUsed: inRange.reduce((sum, wo) => sum + wo.items.reduce((s, i) => s + i.quantity, 0), 0),
  }
}

/** Customers whose createdAt falls in the half-open [start, end) range. */
function customersCreatedInRange(customers: Customer[], range: DateRange): number {
  return customers.filter((c) => {
    const d = new Date(c.createdAt)
    return d >= range.start && d < range.end
  }).length
}

export interface PeriodKpis {
  revenue: number
  revenueDelta: number | null
  vehiclesServiced: number
  vehiclesDelta: number | null
  partsUsed: number
  partsDelta: number | null
  newCustomers: number
  newCustomersDelta: number | null
}

/**
 * KPI tiles for an arbitrary period vs the period immediately before it.
 * Deltas go through finance.ts's pctDelta — null (not 0) when the previous
 * period had no activity, matching what the P&L report already does for the
 * same idea, rather than a locally-invented "0%". Range filtering reuses the
 * same half-open [start, end) convention as filterCompletedOrders.
 */
export function computePeriodKpis(
  orders: WorkOrder[],
  customers: Customer[],
  range: DateRange,
  previousRange: DateRange,
): PeriodKpis {
  const current = orderTotalsInRange(orders, range)
  const previous = orderTotalsInRange(orders, previousRange)
  const newCustomers = customersCreatedInRange(customers, range)
  const prevNewCustomers = customersCreatedInRange(customers, previousRange)

  return {
    revenue: current.revenue,
    revenueDelta: pctDelta(current.revenue, previous.revenue),
    vehiclesServiced: current.vehiclesServiced,
    vehiclesDelta: pctDelta(current.vehiclesServiced, previous.vehiclesServiced),
    partsUsed: current.partsUsed,
    partsDelta: pctDelta(current.partsUsed, previous.partsUsed),
    newCustomers,
    newCustomersDelta: pctDelta(newCustomers, prevNewCustomers),
  }
}

export interface BayCapacity {
  occupiedBays: number
  totalBays: number
  bayCapacityPct: number
}

export function computeBayCapacity(bays: Bay[]): BayCapacity {
  const occupiedBays = bays.filter((b) => b.status !== 'available').length
  return {
    occupiedBays,
    totalBays: bays.length,
    bayCapacityPct: bays.length > 0 ? Math.round((occupiedBays / bays.length) * 100) : 0,
  }
}

export interface BayStatusRow {
  id: string
  name: string
  status: Bay['status']
  vehicleInfo?: string
  workerName?: string
}

export interface BayLookups {
  workOrderById: Map<string, WorkOrder>
  vehicleLabelOf: (vehicleId: string) => string | undefined
  workerById: Map<string, Worker>
}

export function buildBayStatusBoard(bays: Bay[], lookups: BayLookups): BayStatusRow[] {
  return bays.map((bay) => {
    const workOrder = bay.currentWorkOrderId ? lookups.workOrderById.get(bay.currentWorkOrderId) : null
    const worker = bay.assignedWorkerId ? lookups.workerById.get(bay.assignedWorkerId) : null
    return {
      id: bay.id,
      name: bay.name,
      status: bay.status,
      vehicleInfo: workOrder ? lookups.vehicleLabelOf(workOrder.vehicleId) : undefined,
      workerName: worker?.name,
    }
  })
}

export interface TechnicianQueueRow {
  id: string
  name: string
  status: 'available' | 'busy'
  bayName?: string
  vehicleInfo?: string
  /** null = no estimated end time to report against. */
  minutesRemaining: number | null
  /** 0-100, clamped to 5-95 while in service (never reads as fully done or
   *  not-yet-started); null when there's nothing in progress to show. */
  progressPct: number | null
}

/**
 * Who's on which bay, with raw minutes-remaining and progress — the
 * component formats these into translated strings (overdue/Xm/Xh Ym).
 * `now` is a parameter rather than read internally so the progress bar can
 * actually advance: a memo keyed on `now` re-runs on a tick, where reading
 * Date.now() inside the memo body would freeze until an unrelated dep changed.
 */
export function buildTechnicianQueue(
  workers: Worker[],
  bays: Bay[],
  lookups: BayLookups,
  now: Date = new Date()
): TechnicianQueueRow[] {
  return workers.map((worker) => {
    const assignedBay = bays.find((b) => b.assignedWorkerId === worker.id)
    const workOrder = assignedBay?.currentWorkOrderId ? lookups.workOrderById.get(assignedBay.currentWorkOrderId) : null

    let minutesRemaining: number | null = null
    if (assignedBay?.estimatedEndTime) {
      const diffMs = new Date(assignedBay.estimatedEndTime).getTime() - now.getTime()
      minutesRemaining = diffMs <= 0 ? -1 : Math.ceil(diffMs / 60000)
      // -1 is the sentinel for "overdue" — never a real minute count, since
      // Math.ceil of a positive diff is always >= 1.
    }

    let progressPct: number | null = null
    if (assignedBay?.status === 'in-service' && workOrder && assignedBay.estimatedEndTime) {
      const start = new Date(workOrder.createdAt).getTime()
      const end = new Date(assignedBay.estimatedEndTime).getTime()
      if (end > start) {
        const pct = Math.round(((now.getTime() - start) / (end - start)) * 100)
        progressPct = Math.min(95, Math.max(5, pct))
      }
    }

    return {
      id: worker.id,
      name: worker.name,
      status: assignedBay && assignedBay.status !== 'available' ? ('busy' as const) : ('available' as const),
      bayName: assignedBay?.name,
      vehicleInfo: workOrder ? lookups.vehicleLabelOf(workOrder.vehicleId) : undefined,
      minutesRemaining,
      progressPct,
    }
  })
}

export interface ServiceMixEntry {
  name: string
  count: number
  share: number
}

/** Top services by frequency across completed orders — service lines only
 *  (no productId; see orderItemGroups.ts's split), keyed by the line
 *  description before its ' - ' detail suffix. Products from the inventory
 *  tab are counted by Service Mix's sibling widgets, not here. */
export function computeServiceMix(orders: WorkOrder[], limit = 5): ServiceMixEntry[] {
  const counts = new Map<string, number>()
  for (const wo of orders) {
    if (wo.status !== 'completed') continue
    for (const item of groupOrderItemsByType(wo.items).services) {
      const name = item.description.split(' - ')[0]
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, share: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export interface ThroughputDay {
  date: Date
  scheduled: number
  walkIn: number
}

/** Trailing 7 days (oldest first) of non-cancelled appointments, split
 *  scheduled vs walk-in. Returns the Date itself; the component formats the
 *  weekday label via its own locale. */
export function computeThroughput(appointments: Appointment[], now: Date = new Date()): ThroughputDay[] {
  const days: ThroughputDay[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toDateString()
    const daysAppointments = appointments.filter((a) => a.status !== 'cancelled' && sameDay(a.scheduledAt, dateStr))
    days.push({
      date: d,
      scheduled: daysAppointments.filter((a) => !a.isWalkIn).length,
      walkIn: daysAppointments.filter((a) => a.isWalkIn).length,
    })
  }
  return days
}

export interface RepeatCustomerBuckets {
  /** Repeat orders (owner had an earlier completed order) per week-of-month. */
  thisMonth: [number, number, number, number]
  lastMonth: [number, number, number, number]
  /** All completed orders per week-of-month — the denominator for a rate. */
  thisMonthTotal: [number, number, number, number]
  lastMonthTotal: [number, number, number, number]
}

/**
 * Completed orders from returning owners (owner had an earlier completed
 * order), bucketed by week-of-month, this month vs last month.
 */
export function computeRepeatCustomerBuckets(orders: WorkOrder[], now: Date = new Date()): RepeatCustomerBuckets {
  const completed = [...orders]
    .filter((wo) => wo.status === 'completed')
    .sort((a, b) => new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime())
  const seenVehicles = new Set<string>()
  const thisMonth: [number, number, number, number] = [0, 0, 0, 0]
  const lastMonth: [number, number, number, number] = [0, 0, 0, 0]
  const thisMonthTotal: [number, number, number, number] = [0, 0, 0, 0]
  const lastMonthTotal: [number, number, number, number] = [0, 0, 0, 0]
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  for (const wo of completed) {
    const isRepeat = seenVehicles.has(wo.vehicleId)
    seenVehicles.add(wo.vehicleId)
    const d = new Date(wo.completedAt || wo.createdAt)
    const week = Math.min(3, Math.floor((d.getDate() - 1) / 7))
    const inThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    const inLastMonth =
      d.getFullYear() === prevMonthDate.getFullYear() && d.getMonth() === prevMonthDate.getMonth()
    if (inThisMonth) thisMonthTotal[week]++
    else if (inLastMonth) lastMonthTotal[week]++
    if (!isRepeat) continue
    if (inThisMonth) thisMonth[week]++
    else if (inLastMonth) lastMonth[week]++
  }
  return { thisMonth, lastMonth, thisMonthTotal, lastMonthTotal }
}

export interface AppointmentTrendPoint {
  monthIndex: number // 0-11
  appointments: number
}

/** Appointments per calendar month, current year, non-cancelled. */
export function computeAppointmentTrend(appointments: Appointment[], now: Date = new Date()): AppointmentTrendPoint[] {
  const year = now.getFullYear()
  const counts = new Array(12).fill(0)
  for (const a of appointments) {
    if (a.status === 'cancelled') continue
    const d = new Date(a.scheduledAt)
    if (d.getFullYear() === year) counts[d.getMonth()]++
  }
  return counts.map((appointments, monthIndex) => ({ monthIndex, appointments }))
}

/**
 * Non-cancelled appointments scheduled on `now`'s calendar day, earliest
 * first. Walk-ins are included — AppointmentDialog stamps them
 * scheduledAt: now, and "who's in today / still waiting" is exactly what the
 * dashboard's Today's Schedule card is for. Raw rows; the component formats
 * the time and owner labels.
 */
export function computeTodaysAppointments(appointments: Appointment[], now: Date = new Date()): Appointment[] {
  const today = now.toDateString()
  return appointments
    .filter((a) => a.status !== 'cancelled' && sameDay(a.scheduledAt, today))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
}
