// Shared entity-display helpers. Pure functions (no hooks) that take the store
// arrays explicitly, so the label/owner-resolution logic lives in one place
// instead of being re-implemented in every page. Callers keep thin one-line
// closures that bind their own store data to these.
import type { Vehicle } from '../store/vehicleStore'
import type { Customer } from '../store/customerStore'
import type { Company } from '../store/companyStore'
import type { Worker } from '../store/workerStore'

/** "2021 Toyota Avanza" — vehicle year/make/model, no plate. */
export function vehicleLabel(v?: Vehicle | null): string {
  if (!v) return 'Unknown vehicle'
  return `${v.year || ''} ${v.make} ${v.model}`.trim()
}

/** "2021 Toyota Avanza - B 1234 XYZ" — vehicle label with plate appended. */
export function vehicleLabelWithPlate(v?: Vehicle | null): string {
  if (!v) return 'Unknown vehicle'
  return `${v.year || ''} ${v.make} ${v.model} - ${v.licensePlate}`.trim()
}

/** Owning customer's name, else owning company's name, else "No owner". */
export function ownerName(
  v: Vehicle | null | undefined,
  customers: Customer[],
  companies: Company[],
): string {
  if (!v) return 'Unknown'
  if (v.customerId) return customers.find(c => c.id === v.customerId)?.name || 'Unknown'
  if (v.companyId) return companies.find(c => c.id === v.companyId)?.companyName || 'Unknown'
  return 'No owner'
}

/** Worker name, "-" when unassigned, "Unknown" when the id no longer resolves. */
export function workerName(workerId: string | null, workers: Worker[]): string {
  if (!workerId) return '-'
  return workers.find(w => w.id === workerId)?.name || 'Unknown'
}

/** License plate, "-" when absent. */
export function vehiclePlate(v?: Vehicle | null): string {
  return v?.licensePlate || '-'
}
