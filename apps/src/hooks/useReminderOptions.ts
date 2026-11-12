import { useMemo } from 'react'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useSettingsStore, DEFAULT_SERVICE_INTERVAL_KM, DEFAULT_SERVICE_INTERVAL_MONTHS } from '../store/settingsStore'
import { readingsByVehicle } from '../lib/schedule/odometerProjection'
import type { ReminderOptions } from '../lib/schedule/reminders'

/**
 * What the reminder list needs beyond vehicles and rules: every car's odometer
 * history (so a car that hasn't come back is carried forward) and the shop's
 * default service interval (for a car with no schedule of its own).
 *
 * Built from completed orders only, selected with a shallow compare, so editing
 * an open order at the till never rebuilds the readings for the whole shop.
 */
export function useReminderOptions(): ReminderOptions {
  const completed = useStoreWithEqualityFn(
    useWorkOrderStore,
    (s) => s.workOrders.filter((wo) => wo.status === 'completed'),
    shallow
  )
  // `??` because an install that predates these fields has a stored settings
  // object without them (see settingsStore.ts).
  const intervalKm = useSettingsStore((s) => s.settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM)
  const intervalMonths = useSettingsStore((s) => s.settings.defaultServiceIntervalMonths ?? DEFAULT_SERVICE_INTERVAL_MONTHS)

  const readings = useMemo(() => readingsByVehicle(completed), [completed])
  return useMemo(() => ({ readings, fallback: { intervalKm, intervalMonths } }), [readings, intervalKm, intervalMonths])
}
